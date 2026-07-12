import { Injectable, computed, inject, signal } from '@angular/core';
import { SaveService } from '../../core/storage/save.service';
import { BattleService } from '../battle/battle.service';
import { PokeApiClient } from '../../core/api/pokeapi.client';
import { idFromUrl } from '../../core/api/pokeapi-endpoints';
import { evolutionAt, levelUpEvolutions } from '../../game/rpg/evolution';
import { SeededRng } from '../../core/utils/rng';
import { getMap } from '../../game/rpg/maps';
import { DELTA, ahead, isTallGrass, ledgeLanding, signAt, tileAt, warpAt } from '../../game/rpg/movement';
import { canEnterRuntime, initNpcPositions, npcAtRuntime, stepWanderers, type NpcPositions } from '../../game/rpg/npc-walk';
import { TILE } from '../../game/rpg/tiles';
import { rollEncounter } from '../../game/rpg/encounters';
import { timeBand } from '../../game/rpg/time';
import { FIELD_STEP_INTERVAL, applyFieldPoison } from '../../game/rpg/field';
import { ITEMS, bagIdForHeld } from '../../game/rpg/items-catalog';
import { titleCase } from '../../core/ui/format';
import { ToastService } from '../../core/ui/toast/toast.service';
import { buryFainted, consumeEncounter } from '../../game/rpg/nuzlocke';
import { defaultSave, isValidSave } from '../../game/rpg/save';
import {
  PARTY_MAX,
  depositToBox,
  giveHeldItem,
  healParty,
  makePartyMon,
  partyAlive,
  rename as renameMon,
  setLead,
  takeHeldItem,
  withdrawFromBox,
} from '../../game/rpg/party';
import type { Direction, FallenMon, ItemId, MapDef, PartyMon, RpgSave, ScriptNode } from '../../game/rpg/rpg-types';

const SAVE_KEY = 'rpg:save';

export type RpgPhase = 'title' | 'overworld' | 'battle' | 'dialogue' | 'menu' | 'shop' | 'starter' | 'evolve';

/** Title-screen preview of one save slot. */
export type SlotInfo =
  | { readonly slot: 1 | 2 | 3; readonly empty: true }
  | {
      readonly slot: 1 | 2 | 3;
      readonly empty: false;
      readonly name: string;
      readonly badges: number;
      readonly party: number;
      readonly topLevel: number;
      readonly map: string;
      readonly nuzlocke: boolean;
      readonly fallen: number;
    };

/** A cinematic transition style played as a battle begins. */
export type EncounterFx = 'flash' | 'spiral' | 'split' | 'alert';

/** A queued evolution to play after a battle. */
export interface EvoEntry {
  readonly uid: string;
  readonly from: string;
  readonly fromId: number;
  readonly to: string;
  readonly toId: number;
  readonly level: number;
}

/** A pending battle the RpgBattleComponent picks up. */
export interface BattleSetup {
  readonly kind: 'wild' | 'trainer';
  readonly foeSpecies: string; // wild: the species; trainer: first team member (display)
  readonly foeLevel: number;
  readonly foeCatchRate: number;
  /** Trainer-only. */
  readonly trainerName?: string;
  readonly team?: readonly { readonly species: string; readonly level: number }[];
  readonly reward?: number;
  readonly winFlag?: string;
  readonly defeatText?: string;
  readonly badge?: string;
  readonly ending?: string;
  /** Wild-only: a rare sparkling variant (kept for life when caught). */
  readonly shiny?: boolean;
  /** Wild-only: the encounter was reeled in with the Old Rod. */
  readonly fishing?: boolean;
}

/** Active dialogue box state (null when no box is shown). */
export interface DialogueState {
  readonly speaker?: string;
  readonly text: string;
  readonly choices?: readonly string[];
}

/** Result of attempting a step, so the overworld can animate / react. */
export interface StepResult {
  readonly moved: boolean;
  readonly warped: boolean;
  readonly grass: boolean;
  /** The step was a two-tile ledge hop. */
  readonly hopped?: boolean;
}

/** Shiny odds per wild roll (grass and fishing alike) — demo-friendly. */
const SHINY_ODDS = 1 / 128;

/**
 * Classic RPG mode state hub. Holds the single {@link RpgSave}, the current map,
 * and the player's grid position; resolves movement, warps and interactions; and
 * persists to localStorage via {@link SaveService}. Battle/dialogue flows hook in
 * during later phases.
 */
@Injectable({ providedIn: 'root' })
export class RpgService {
  private readonly store = inject(SaveService);
  private readonly battle = inject(BattleService);
  private readonly api = inject(PokeApiClient);
  private readonly globalToast = inject(ToastService);
  /** Evolutions queued by the last battle, played in the `evolve` phase. */
  readonly evolutions = signal<EvoEntry[]>([]);

  readonly phase = signal<RpgPhase>('title');
  readonly game = signal<RpgSave | null>(null);
  /** Which of the three save slots the session plays in (slot 1 = legacy key). */
  readonly slot = signal<1 | 2 | 3>(1);
  /** Title-screen previews for all three slots. */
  readonly slots = signal<SlotInfo[]>(this.readSlots());
  readonly hasSave = signal<boolean>(this.readSave() !== null);
  /** The active battle's setup (null outside battle). */
  readonly battleSetup = signal<BattleSetup | null>(null);
  /** A cinematic transition overlay played as a battle begins (null when idle). */
  readonly encounterFx = signal<EncounterFx | null>(null);
  private fxTimer: ReturnType<typeof setTimeout> | null = null;
  /** Walkable steps since the last field-status (poison) tick. */
  private fieldSteps = 0;
  readonly party = computed<PartyMon[]>(() => this.game()?.party ?? []);
  readonly bag = computed<Partial<Record<ItemId, number>>>(() => this.game()?.bag ?? {});
  readonly money = computed<number>(() => this.game()?.money ?? 0);
  readonly badges = computed<string[]>(() => this.game()?.badges ?? []);
  /** Active dialogue box (set by the script VM). */
  readonly dialogue = signal<DialogueState | null>(null);
  private scriptStack: { nodes: readonly ScriptNode[]; i: number }[] = [];
  private choiceBranches: readonly (readonly ScriptNode[])[] = [];
  /** A transient one-line message (signs, pickups, …). */
  readonly toast = signal<string | null>(null);
  private toastTimer: ReturnType<typeof setTimeout> | null = null;
  /** Beaten trainer whose rematch offer is on screen (consumed by the script VM). */
  private pendingRematch: import('../../game/rpg/rpg-types').TrainerDef | null = null;
  /** Runtime NPC positions (wanderers move; everyone else mirrors the map def). */
  readonly npcPos = signal<NpcPositions>({});
  private npcMapId: string | null = null;

  readonly map = computed<MapDef | null>(() => {
    const g = this.game();
    return g ? getMap(g.map) ?? null : null;
  });
  readonly player = computed(() => {
    const g = this.game();
    return g ? { x: g.x, y: g.y, facing: g.facing } : null;
  });

  /* ------------------------------------------------------------- lifecycle */

  newGame(name = 'Red', slot: 1 | 2 | 3 = this.slot(), nuzlocke = false): void {
    this.slot.set(slot);
    const g = defaultSave(name, nuzlocke);
    this.game.set(g);
    this.persist();
    this.phase.set('overworld');
    // Guided intro → choose a starter immediately (no hunting for the Lab).
    this.runScript([
      { say: 'Welcome to your PokéVerse adventure!' },
      ...(nuzlocke
        ? [
            { say: '💀 This is a NUZLOCKE run. The rules are law:', speaker: 'Prof. Oak' },
            { say: '1) Only the FIRST wild Pokémon on each route may be caught.' },
            { say: '2) A fainted partner is gone forever.' },
            { say: '3) If your whole party falls, the run — and this save — ends.' },
          ]
        : []),
      { say: 'Prof. Oak: Take one of these three partners — choose well!', speaker: 'Prof. Oak' },
      { starter: true },
    ]);
  }

  /** Current objective for the on-screen banner, derived from progress flags. */
  readonly objective = computed<string>(() => {
    const g = this.game();
    if (!g) return '';
    if (!g.flags['starter'] || g.party.length === 0) return '▶ Choose your first Pokémon';
    if (!g.flags['first-battle']) return '▶ Step into the tall grass to find a wild Pokémon';
    if (!g.flags['beat-bugcatcher']) return '▶ Catch & train, then beat a Trainer';
    if (!g.badges.includes('Hive Badge')) return '▶ Head south to Route 1 → the Oakhaven Gym';
    if (!g.badges.includes('Boulder Badge')) return '▶ Through Route 2 & the cave → the Stonehollow Gym';
    if (!g.badges.includes('Knuckle Badge')) return '▶ South past the ranger → Route 3 → the Sunreach Gym';
    if (!g.badges.includes('Tide Badge')) return '▶ South from Sunreach → Route 4 → the Mistfall Gym';
    return '★ Four badges! Champion of the demo — explore freely!';
  });

  /** Build a Pokémon from species/level and add it to the party (or box if full). */
  async grantPokemon(species: string, level: number): Promise<PartyMon | null> {
    const g = this.game();
    if (!g) return null;
    try {
      const b = await this.battle.buildBattler(species, level);
      const mon = makePartyMon(b.name, b.id, level, b.stats.hp);
      const next = { ...g };
      if (next.party.length < PARTY_MAX) next.party = [...next.party, mon];
      else next.box = [...next.box, mon];
      this.markCaught(next, b.id);
      this.game.set(next);
      this.persist();
      return mon;
    } catch {
      return null;
    }
  }

  continue(slot: 1 | 2 | 3 = this.slot()): void {
    this.slot.set(slot);
    const g = this.readSave(slot);
    if (g) {
      this.game.set(g);
      this.phase.set('overworld');
    }
  }

  exitToTitle(): void {
    this.persist();
    this.phase.set('title');
    this.slots.set(this.readSlots());
  }

  /** Wipe a slot (two-tap confirm lives in the title UI). */
  deleteSlot(slot: 1 | 2 | 3): void {
    this.store.remove(this.keyFor(slot));
    this.slots.set(this.readSlots());
    this.hasSave.set(this.slots().some((s) => !s.empty));
  }

  persist(): void {
    const g = this.game();
    if (!g) return;
    this.store.write(this.keyFor(this.slot()), g);
    this.hasSave.set(true);
    if (this.phase() === 'title') this.slots.set(this.readSlots());
  }

  /** Slot 1 stays on the legacy key so existing adventures keep working. */
  private keyFor(slot: number): string {
    return slot === 1 ? SAVE_KEY : `${SAVE_KEY}:${slot}`;
  }

  private readSave(slot: 1 | 2 | 3 = this.slot()): RpgSave | null {
    const g = this.store.read<RpgSave | null>(this.keyFor(slot), null);
    return g && isValidSave(g) ? g : null;
  }

  private readSlots(): SlotInfo[] {
    return ([1, 2, 3] as const).map((slot) => {
      const g = this.readSave(slot);
      if (!g) return { slot, empty: true as const };
      return {
        slot,
        empty: false as const,
        name: g.name,
        badges: g.badges.length,
        party: g.party.length,
        topLevel: g.party.reduce((m, p) => Math.max(m, p.level), 0),
        map: getMap(g.map)?.name ?? g.map,
        nuzlocke: !!g.nuzlocke,
        fallen: g.nuzlocke?.fallen.length ?? 0,
      };
    });
  }

  /* ------------------------------------------------------------- movement */

  /** Turn to face a direction without moving. */
  face(dir: Direction): void {
    const g = this.game();
    if (!g || g.facing === dir) return;
    this.game.set({ ...g, facing: dir });
  }

  /** Ensure runtime NPC positions exist for the current map. */
  private ensureNpcs(m: MapDef): void {
    if (this.npcMapId === m.id) return;
    this.npcMapId = m.id;
    this.npcPos.set(initNpcPositions(m));
  }

  /** Whether the tile ahead in `dir` can be entered (or ledge-hopped over). */
  canStep(dir: Direction): boolean {
    const g = this.game();
    const m = this.map();
    if (!g || !m) return false;
    this.ensureNpcs(m);
    const t = ahead(g.x, g.y, dir);
    const hop = ledgeLanding(m, t.x, t.y, dir);
    if (hop) return canEnterRuntime(m, this.npcPos(), hop.x, hop.y);
    return canEnterRuntime(m, this.npcPos(), t.x, t.y);
  }

  /**
   * Commit a step in `dir`: updates facing + position, applies any warp, reports
   * whether we entered tall grass (the overworld rolls encounters in P2).
   */
  commitStep(dir: Direction): StepResult {
    const g = this.game();
    const m = this.map();
    if (!g || !m) return { moved: false, warped: false, grass: false };

    this.ensureNpcs(m);
    let t = ahead(g.x, g.y, dir);
    // One-way ledges: pressing down hops over the edge, landing below it.
    const hop = ledgeLanding(m, t.x, t.y, dir);
    let hopped = false;
    if (hop && canEnterRuntime(m, this.npcPos(), hop.x, hop.y)) {
      t = hop;
      hopped = true;
    } else if (!canEnterRuntime(m, this.npcPos(), t.x, t.y)) {
      this.face(dir);
      return { moved: false, warped: false, grass: false };
    }

    let next: RpgSave = { ...g, x: t.x, y: t.y, facing: dir };
    const warp = warpAt(m, t.x, t.y);
    if (warp?.requiresBadge && !g.badges.includes(warp.requiresBadge)) {
      this.face(dir);
      this.showToast(`Ranger: “The road ahead is closed until you hold the ${warp.requiresBadge}.”`, 3000);
      return { moved: false, warped: false, grass: false };
    }
    if (warp) {
      if (warp.to === '@return') {
        const r = g.doorReturn ?? { map: g.respawn.map, x: g.respawn.x, y: g.respawn.y, facing: 'down' as Direction };
        next = { ...next, map: r.map, x: r.x, y: r.y, facing: r.facing };
      } else {
        const target = getMap(warp.to);
        // Entering an interior: remember the outdoor tile just below the door.
        const doorReturn = target && !target.outdoor ? { map: g.map, x: t.x, y: t.y + 1, facing: 'down' as Direction } : g.doorReturn;
        next = { ...next, map: warp.to, x: warp.toX, y: warp.toY, facing: warp.toFacing ?? dir, doorReturn };
      }
      this.game.set(next);
      this.persist();
      return { moved: true, warped: true, grass: false, hopped };
    }

    // Pick up a ground item once (persisted so the flag sticks).
    const gi = m.items.find((it) => it.x === t.x && it.y === t.y && !next.flags[it.flag]);
    if (gi) {
      next = {
        ...next,
        bag: { ...next.bag, [gi.item]: (next.bag[gi.item] ?? 0) + gi.qty },
        flags: { ...next.flags, [gi.flag]: true },
      };
      this.game.set(next);
      this.persist();
      this.showToast(`Found ${ITEMS[gi.item].name}${gi.qty > 1 ? ' ×' + gi.qty : ''}!`);
      const grassItem = isTallGrass(m, t.x, t.y);
      return { moved: true, warped: false, grass: grassItem, hopped };
    }

    this.game.set(next);
    const grass = isTallGrass(m, t.x, t.y);

    // Repel: each step burns one charge and suppresses wild rolls.
    const repelActive = (next.repelSteps ?? 0) > 0;
    if (repelActive) {
      next = { ...next, repelSteps: (next.repelSteps ?? 0) - 1 };
      this.game.set(next);
      if (next.repelSteps === 0) this.showToast('The Repel wore off.');
    }

    // Field status tick — poisoned party members lose a little HP as you walk.
    if (++this.fieldSteps >= FIELD_STEP_INTERVAL) {
      this.fieldSteps = 0;
      const fp = applyFieldPoison(next.party);
      if (fp.hurt.length) {
        next = { ...next, party: fp.party };
        this.game.set(next);
        this.persist();
        this.showToast(`${fp.hurt[0]} is hurt by poison!`);
      }
    }

    // Roll a wild encounter — tall grass, or every step in a cave (everywhere).
    if (!repelActive && (grass || m.encounter?.everywhere) && m.encounter && next.party.length > 0) {
      const rng = new SeededRng(`${Date.now()}-${t.x}-${t.y}-${Math.random()}`);
      const roll = rollEncounter(m.encounter, rng, timeBand());
      if (roll) {
        if (!next.flags['first-battle']) this.setFlag('first-battle');
        this.startEncounter({
          kind: 'wild',
          foeSpecies: roll.species,
          foeLevel: roll.level,
          foeCatchRate: roll.catchRate,
          shiny: rng.chance(SHINY_ODDS),
        });
      }
    }

    // Wandering villagers amble after the player moves.
    this.npcPos.set(stepWanderers(m, this.npcPos(), { x: t.x, y: t.y }, Math.random));

    // A trainer may spot the player along its line of sight.
    if (this.phase() === 'overworld' && next.party.length > 0) this.checkTrainerSight(next, m);

    return { moved: true, warped: false, grass, hopped };
  }

  /** Start a trainer battle if any unbeaten line-of-sight trainer can see the player. */
  private checkTrainerSight(g: RpgSave, m: MapDef): void {
    const positions = this.npcPos();
    for (const npc of m.npcs) {
      const tr = npc.trainer;
      if (npc.kind !== 'trainer' || !tr || !tr.sight || g.flags[tr.flag]) continue;
      const at = positions[npc.id] ?? npc;
      const d = DELTA[at.facing];
      for (let step = 1; step <= tr.sight; step++) {
        const tx = at.x + d.dx * step;
        const ty = at.y + d.dy * step;
        const tile = tileAt(m, tx, ty);
        if (!tile || !TILE[tile].walkable || npcAtRuntime(m, positions, tx, ty)) break;
        if (g.x === tx && g.y === ty) {
          this.startTrainer(tr);
          return;
        }
      }
    }
  }

  /* --------------------------------------------------------------- battle */

  /** Persist a party array (HP/XP/level writeback, catches). */
  applyParty(party: PartyMon[]): void {
    const g = this.game();
    if (!g) return;
    this.game.set({ ...g, party });
    this.persist();
  }

  /* ------------------------------------------------------------- nuzlocke */

  /** Whether the active save is a Nuzlocke run. */
  readonly nuzlocke = computed(() => !!this.game()?.nuzlocke);
  /** Partners lost so far (memorial size). */
  readonly fallenCount = computed(() => this.game()?.nuzlocke?.fallen.length ?? 0);
  /** Whether the *current* wild battle may throw balls (rule 1). */
  readonly nuzCatchAllowed = signal(true);

  /**
   * Nuzlocke-aware party writeback: on a Nuzlocke save the fainted are moved
   * to the memorial and leave the party; classic saves persist unchanged.
   * Returns the survivors and whoever was lost (for the battle result lines).
   */
  applyPartyWithBurial(party: PartyMon[]): { survivors: PartyMon[]; lost: FallenMon[] } {
    const g = this.game();
    if (!g?.nuzlocke) {
      this.applyParty(party);
      return { survivors: party, lost: [] };
    }
    const r = buryFainted(g.nuzlocke, party);
    this.game.set({ ...g, party: r.survivors, nuzlocke: r.state });
    this.persist();
    return { survivors: r.survivors, lost: r.lost };
  }

  /** Rule 3: the whole party fell — the run is over and the save is erased. */
  nuzlockeGameOver(): void {
    const fallen = this.fallenCount();
    const name = this.game()?.name ?? 'Trainer';
    this.deleteSlot(this.slot());
    this.game.set(null);
    this.battleSetup.set(null);
    this.phase.set('title');
    this.globalToast.show({
      title: `${name}'s Nuzlocke run is over`,
      text: `${fallen} partner${fallen === 1 ? '' : 's'} fell along the way. The save has been laid to rest — honor them with a fresh start.`,
      icon: 'skull',
      kind: 'info',
    });
  }

  /** Add a freshly-caught mon to the party (or box) and record the dex entry. */
  addCaught(mon: PartyMon): 'party' | 'box' {
    const g = this.game();
    if (!g) return 'box';
    const next = { ...g };
    let where: 'party' | 'box';
    if (next.party.length < PARTY_MAX) {
      next.party = [...next.party, mon];
      where = 'party';
    } else {
      next.box = [...next.box, mon];
      where = 'box';
    }
    this.markCaught(next, mon.dexId);
    this.game.set(next);
    this.persist();
    return where;
  }

  markSeen(dexId: number): void {
    const g = this.game();
    if (!g || g.seen.includes(dexId)) return;
    this.game.set({ ...g, seen: [...g.seen, dexId] });
  }

  private markCaught(save: RpgSave, dexId: number): void {
    if (!save.seen.includes(dexId)) save.seen = [...save.seen, dexId];
    if (!save.caught.includes(dexId)) save.caught = [...save.caught, dexId];
  }

  /** End the current battle and return to the overworld. */
  endBattle(): void {
    this.battleSetup.set(null);
    this.phase.set('overworld');
  }

  /**
   * Kick off a battle behind a cinematic transition overlay. The battle phase
   * mounts immediately (freezing movement) while the flash/wipe plays on top and
   * auto-clears once the battle scene has faded in behind it.
   */
  startEncounter(setup: BattleSetup): void {
    // Nuzlocke rule 1: the first wild battle on a map is its only catch
    // chance — spent the moment the battle starts, whatever its outcome.
    const g = this.game();
    if (setup.kind === 'wild' && g?.nuzlocke) {
      const r = consumeEncounter(g.nuzlocke, g.map);
      this.nuzCatchAllowed.set(r.catchAllowed);
      if (r.state !== g.nuzlocke) {
        this.game.set({ ...g, nuzlocke: r.state });
        this.persist();
      }
    } else {
      this.nuzCatchAllowed.set(true);
    }
    this.battleSetup.set(setup);
    const styles: EncounterFx[] = setup.kind === 'trainer' ? ['alert'] : ['flash', 'spiral', 'split'];
    this.encounterFx.set(styles[Math.floor(Math.random() * styles.length)]);
    this.phase.set('battle');
    if (this.fxTimer) clearTimeout(this.fxTimer);
    this.fxTimer = setTimeout(() => this.encounterFx.set(null), 950);
  }

  /** Whole party fainted — heal for free and return to the last Center. */
  whiteout(): void {
    const g = this.game();
    if (!g) return;
    this.game.set({
      ...g,
      party: healParty(g.party),
      map: g.respawn.map,
      x: g.respawn.x,
      y: g.respawn.y,
      facing: 'down',
    });
    this.persist();
    this.battleSetup.set(null);
    this.phase.set('overworld');
    this.showToast('You scurried back to safety, all healed up.');
  }

  /** Heal the whole party (Pokémon Center). */
  healAtCenter(): void {
    const g = this.game();
    if (!g) return;
    this.game.set({ ...g, party: healParty(g.party) });
    this.persist();
  }

  partyCanFight(): boolean {
    return partyAlive(this.party());
  }

  readonly box = computed(() => this.game()?.box ?? []);

  setLead(index: number): void {
    const g = this.game();
    if (!g) return;
    this.game.set({ ...g, party: setLead(g.party, index) });
    this.persist();
  }

  deposit(index: number): void {
    const g = this.game();
    if (!g) return;
    const r = depositToBox(g.party, g.box, index);
    if (!r.ok) {
      this.showToast('You need at least one Pokémon with you.');
      return;
    }
    this.game.set({ ...g, party: r.party, box: r.box });
    this.persist();
  }

  withdraw(index: number): void {
    const g = this.game();
    if (!g) return;
    const r = withdrawFromBox(g.party, g.box, index);
    if (!r.ok) {
      this.showToast('Your team is full (6).');
      return;
    }
    this.game.set({ ...g, party: r.party, box: r.box });
    this.persist();
  }

  rename(uid: string, name: string): void {
    const g = this.game();
    if (!g) return;
    this.game.set({ ...g, party: renameMon(g.party, uid, name), box: renameMon(g.box, uid, name) });
    this.persist();
  }

  /** Interact with whatever the player faces (signs, nurse, clerk; NPCs/dialogue in P4). */
  interact(): void {
    const g = this.game();
    const m = this.map();
    if (!g || !m) return;
    this.ensureNpcs(m);
    const t = ahead(g.x, g.y, g.facing);
    const npc = npcAtRuntime(m, this.npcPos(), t.x, t.y);
    if (npc) {
      if (npc.kind === 'heal') {
        this.healAtCenter();
        this.showToast('Your Pokémon are bursting with energy!');
        return;
      }
      if (npc.kind === 'shop') {
        this.phase.set('shop');
        return;
      }
      if (npc.kind === 'professor' && !this.hasFlag('starter')) {
        this.phase.set('starter');
        return;
      }
      if (npc.kind === 'trainer' && npc.trainer && !this.hasFlag(npc.trainer.flag)) {
        this.startTrainer(npc.trainer);
        return;
      }
      // Beaten trainers offer a rematch at half reward (badge/epilogue only once).
      if (npc.kind === 'trainer' && npc.trainer && this.hasFlag(npc.trainer.flag)) {
        this.pendingRematch = npc.trainer;
        this.runScript([
          { say: `${npc.trainer.name}: Back again? I've been training for a rematch!`, speaker: npc.trainer.name },
          {
            choice: 'Accept the rematch?',
            options: [
              { label: 'Bring it on', then: [{ rematch: true }] },
              { label: 'Not now', then: [{ say: `${npc.trainer.name}: Come find me when you're ready.`, speaker: npc.trainer.name }] },
            ],
          },
        ]);
        return;
      }
      if (npc.script.length) {
        this.runScript(npc.script);
        return;
      }
      this.showToast(`${npc.id} has nothing to say.`);
      return;
    }
    const sign = signAt(m, t.x, t.y);
    if (sign) {
      this.showToast(sign);
      return;
    }
    // Facing open water: cast the Old Rod (if we have it) and maybe hook a wild.
    if (tileAt(m, t.x, t.y) === 'water') this.tryFish(m);
  }

  /** Cast the Old Rod at the faced water tile; resolves to a bite or a shrug. */
  private tryFish(m: MapDef): void {
    const g = this.game();
    if (!g) return;
    if (this.itemCount('old-rod') <= 0) {
      this.showToast('The water is calm. A fishing rod might change that…');
      return;
    }
    if (!m.fishing || g.party.length === 0) {
      this.showToast('Not even a nibble.');
      return;
    }
    if (!g.flags['cast-rod']) this.setFlag('cast-rod');
    this.showToast('You cast the Old Rod… …', 1400);
    if (this.fishTimer) clearTimeout(this.fishTimer);
    this.fishTimer = setTimeout(() => {
      if (this.phase() !== 'overworld' || this.map()?.id !== m.id) return;
      const rng = new SeededRng(`fish-${Date.now()}-${Math.random()}`);
      const roll = rollEncounter(m.fishing!, rng);
      if (!roll) {
        this.showToast('Not even a nibble.');
        return;
      }
      this.setFlag('hooked');
      this.showToast('A bite!');
      this.startEncounter({
        kind: 'wild',
        foeSpecies: roll.species,
        foeLevel: roll.level,
        foeCatchRate: roll.catchRate,
        fishing: true,
        shiny: rng.chance(SHINY_ODDS),
      });
    }, 900);
  }
  private fishTimer: ReturnType<typeof setTimeout> | null = null;

  /* ------------------------------------------------------------- flags */

  hasFlag(flag: string): boolean {
    return !!this.game()?.flags[flag];
  }
  setFlag(flag: string): void {
    const g = this.game();
    if (!g) return;
    this.game.set({ ...g, flags: { ...g.flags, [flag]: true } });
    this.persist();
  }
  awardBadge(badge: string): void {
    const g = this.game();
    if (!g || g.badges.includes(badge)) return;
    this.game.set({ ...g, badges: [...g.badges, badge] });
    this.persist();
  }

  /* ----------------------------------------------------- dialogue VM */

  /** Run a dialogue/event script; pauses on `say`/`choice`, executes the rest. */
  runScript(nodes: readonly ScriptNode[]): void {
    this.scriptStack = [{ nodes, i: 0 }];
    this.phase.set('dialogue');
    this.advance();
  }

  /** Advance past the current line; resolves the next pause or ends the script. */
  advance(): void {
    if (this.dialogue()?.choices) return; // must pick a choice
    this.dialogue.set(null);
    while (this.scriptStack.length) {
      const top = this.scriptStack[this.scriptStack.length - 1];
      if (top.i >= top.nodes.length) {
        this.scriptStack.pop();
        continue;
      }
      const node = top.nodes[top.i++];
      if (this.execNode(node) === 'pause') return;
      if (this.phase() !== 'dialogue') return; // a node changed phase (battle/shop)
    }
    if (this.phase() === 'dialogue') this.phase.set('overworld');
  }

  choose(index: number): void {
    const branch = this.choiceBranches[index] ?? [];
    this.choiceBranches = [];
    this.dialogue.set(null);
    this.scriptStack.push({ nodes: branch, i: 0 });
    this.advance();
  }

  private execNode(node: ScriptNode): 'pause' | void {
    if ('say' in node) {
      this.dialogue.set({ speaker: node.speaker, text: node.say });
      return 'pause';
    }
    if ('choice' in node) {
      this.choiceBranches = node.options.map((o) => o.then);
      this.dialogue.set({ text: node.choice, choices: node.options.map((o) => o.label) });
      return 'pause';
    }
    if ('ifFlag' in node) {
      this.scriptStack.push({ nodes: this.hasFlag(node.ifFlag) ? node.then : node.else ?? [], i: 0 });
      return;
    }
    if ('giveItem' in node) {
      this.addItem(node.giveItem, node.qty ?? 1);
      return;
    }
    if ('setFlag' in node) {
      this.setFlag(node.setFlag);
      return;
    }
    if ('badge' in node) {
      this.awardBadge(node.badge);
      return;
    }
    if ('starter' in node) {
      this.dialogue.set(null);
      this.scriptStack = [];
      this.phase.set('starter');
      return;
    }
    if ('heal' in node) {
      this.healAtCenter();
      return;
    }
    if ('rematch' in node) {
      const t = this.pendingRematch;
      this.pendingRematch = null;
      if (t) {
        this.dialogue.set(null);
        this.scriptStack = [];
        this.startTrainer({
          ...t,
          reward: Math.max(10, Math.floor(t.reward / 2)),
          intro: 'Show me how much stronger you have become!',
          badge: undefined,
          ending: undefined,
        });
      }
      return;
    }
    if ('openShop' in node) {
      this.dialogue.set(null);
      this.phase.set('shop');
      return;
    }
  }

  /* ---------------------------------------------------------- starter */

  async chooseStarter(species: string): Promise<void> {
    if (this.hasFlag('starter')) return;
    const mon = await this.grantPokemon(species, 5);
    if (mon) {
      this.setFlag('starter');
      this.runScript([{ say: `${titleCase(species)} — excellent choice! Your adventure begins!`, speaker: 'Prof. Oak' }]);
    } else {
      this.phase.set('overworld');
    }
  }

  /* ---------------------------------------------------------- trainer */

  startTrainer(trainer: import('../../game/rpg/rpg-types').TrainerDef): void {
    if (!trainer.team.length) return;
    this.showToast(`${trainer.name}: ${trainer.intro}`, 3200);
    this.startEncounter({
      kind: 'trainer',
      foeSpecies: trainer.team[0].species,
      foeLevel: trainer.team[0].level,
      foeCatchRate: 0,
      trainerName: trainer.name,
      team: trainer.team,
      reward: trainer.reward,
      winFlag: trainer.flag,
      defeatText: trainer.defeat,
      badge: trainer.badge,
      ending: trainer.ending,
    });
  }

  /** Reward + flag (+ badge) after beating a trainer (called by the battle component). */
  finishTrainer(reward: number, flag?: string, badge?: string): void {
    const g = this.game();
    if (!g) return;
    this.game.set({ ...g, money: g.money + reward });
    if (flag) this.setFlag(flag);
    if (badge) this.awardBadge(badge);
    this.persist();
  }

  /* -------------------------------------------------------- evolution */

  /** The level-up evolution a species qualifies for at `level`, or null (cache-first). */
  async evolutionFor(species: string, level: number): Promise<{ to: string; toId: number; minLevel: number } | null> {
    try {
      const sp = await this.api.species(species);
      const chain = await this.api.evolutionChain(idFromUrl(sp.evolution_chain.url));
      return evolutionAt(levelUpEvolutions(chain), species, level);
    } catch {
      return null;
    }
  }

  startEvolutions(list: EvoEntry[]): void {
    this.evolutions.set(list);
    this.phase.set('evolve');
  }

  /** Apply one evolution to a party member (recompute max HP, keep HP ratio, dex). */
  async applyEvolution(uid: string, to: string, toId: number): Promise<void> {
    const g = this.game();
    if (!g) return;
    const idx = g.party.findIndex((m) => m.uid === uid);
    if (idx < 0) return;
    const mon = g.party[idx];
    let maxHp = mon.maxHp;
    try {
      const built = await this.battle.buildBattler(to, mon.level);
      maxHp = built.stats.hp;
    } catch {
      /* keep old maxHp */
    }
    const ratio = mon.maxHp > 0 ? mon.currentHp / mon.maxHp : 1;
    const evolved = { ...mon, species: to, dexId: toId, maxHp, currentHp: Math.max(1, Math.round(maxHp * ratio)) };
    const next = { ...g, party: g.party.map((m, i) => (i === idx ? evolved : m)) };
    this.markCaught(next, toId);
    this.game.set(next);
    this.persist();
  }

  /** Leave the evolution sequence and return to the overworld. */
  finishEvolutions(): void {
    this.evolutions.set([]);
    this.battleSetup.set(null);
    this.phase.set('overworld');
  }

  /* --------------------------------------------------------------- menus */

  openMenu(): void {
    if (this.phase() === 'overworld') this.phase.set('menu');
  }
  closeMenu(): void {
    if (this.phase() === 'menu' || this.phase() === 'shop') this.phase.set('overworld');
  }

  /* ---------------------------------------------------------------- bag */

  itemCount(id: ItemId): number {
    return this.game()?.bag[id] ?? 0;
  }

  addItem(id: ItemId, qty = 1): void {
    const g = this.game();
    if (!g) return;
    const bag = { ...g.bag, [id]: (g.bag[id] ?? 0) + qty };
    this.game.set({ ...g, bag });
    this.persist();
  }

  /** Remove one of an item; returns false if none were held. */
  consumeItem(id: ItemId): boolean {
    const g = this.game();
    if (!g || (g.bag[id] ?? 0) <= 0) return false;
    const bag = { ...g.bag, [id]: (g.bag[id] ?? 0) - 1 };
    if (bag[id] === 0) delete bag[id];
    this.game.set({ ...g, bag });
    this.persist();
    return true;
  }

  spend(amount: number): boolean {
    const g = this.game();
    if (!g || g.money < amount) return false;
    this.game.set({ ...g, money: g.money - amount });
    this.persist();
    return true;
  }

  /**
   * Use a healing/status/revive item on a party member from the field menu.
   * Returns a result message, or a reason string when it has no effect.
   */
  useFieldItem(id: ItemId, index: number): string {
    const g = this.game();
    const def = ITEMS[id];
    if (!g || !def || (g.bag[id] ?? 0) <= 0) return 'You have none of those.';
    // Field-wide items apply to the world, not a party member.
    if (def.repel) {
      if ((g.repelSteps ?? 0) > 0) return 'A Repel is already working.';
      const bag = { ...g.bag, [id]: (g.bag[id] ?? 0) - 1 };
      if (bag[id] === 0) delete bag[id];
      this.game.set({ ...g, bag, repelSteps: def.repel });
      this.persist();
      return `Wild Pokémon will keep away for ${def.repel} steps.`;
    }
    const mon = g.party[index];
    if (!mon) return 'No Pokémon there.';
    const t = { ...mon };
    const name = titleCase(t.nickname ?? t.species);
    let msg = '';
    if (def.held) {
      if (mon.heldItem === def.held) return `${name} is already holding that.`;
      const r = giveHeldItem(g.party, index, def.held);
      const bag = { ...g.bag, [id]: (g.bag[id] ?? 0) - 1 };
      if (bag[id] === 0) delete bag[id];
      const backId = r.replaced ? bagIdForHeld(r.replaced) : null;
      if (backId) bag[backId] = (bag[backId] ?? 0) + 1;
      this.game.set({ ...g, party: r.party, bag });
      this.persist();
      return backId
        ? `${name} now holds the ${def.name} — the ${ITEMS[backId].name} went back in the Bag.`
        : `${name} is now holding the ${def.name}.`;
    }
    if (def.revive) {
      if (t.currentHp > 0) return 'It would have no effect.';
      t.currentHp = Math.max(1, Math.floor(t.maxHp * def.revive));
      t.status = 'none';
      msg = `${name} was revived!`;
    } else if (def.heal !== undefined) {
      if (t.currentHp <= 0) return `${name} has fainted — use a Revive.`;
      if (t.currentHp >= t.maxHp) return 'HP is already full.';
      t.currentHp = Math.min(t.maxHp, t.currentHp + (def.heal === Infinity ? t.maxHp : def.heal));
      msg = `${name} recovered HP!`;
    } else if (def.cure) {
      if (t.status === 'none' || (def.cure !== 'all' && t.status !== def.cure)) return 'It would have no effect.';
      t.status = 'none';
      msg = `${name}'s status was healed!`;
    } else {
      return 'You cannot use that here.';
    }
    const party = g.party.map((m, i) => (i === index ? t : m));
    const bag = { ...g.bag, [id]: (g.bag[id] ?? 0) - 1 };
    if (bag[id] === 0) delete bag[id];
    this.game.set({ ...g, party, bag });
    this.persist();
    return msg;
  }

  /** Unequip a party member's held item back into the Bag. */
  takeHeld(index: number): void {
    const g = this.game();
    if (!g) return;
    const r = takeHeldItem(g.party, index);
    if (!r.taken) return;
    const backId = bagIdForHeld(r.taken);
    const bag = backId ? { ...g.bag, [backId]: (g.bag[backId] ?? 0) + 1 } : g.bag;
    this.game.set({ ...g, party: r.party, bag });
    this.persist();
    const mon = g.party[index];
    this.showToast(`Took the ${backId ? ITEMS[backId].name : 'item'} from ${titleCase(mon.nickname ?? mon.species)}.`);
  }

  showToast(text: string, ms = 2600): void {
    this.toast.set(text);
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(null), ms);
  }
}
