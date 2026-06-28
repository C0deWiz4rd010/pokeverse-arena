import { Injectable, computed, inject, signal } from '@angular/core';
import { SaveService } from '../../core/storage/save.service';
import { BattleService } from '../battle/battle.service';
import { SeededRng } from '../../core/utils/rng';
import { getMap } from '../../game/rpg/maps';
import { ahead, canEnter, isTallGrass, npcAt, signAt, warpAt } from '../../game/rpg/movement';
import { rollEncounter } from '../../game/rpg/encounters';
import { defaultSave, isValidSave } from '../../game/rpg/save';
import { PARTY_MAX, healParty, makePartyMon, partyAlive } from '../../game/rpg/party';
import type { Direction, MapDef, PartyMon, RpgSave } from '../../game/rpg/rpg-types';

const SAVE_KEY = 'rpg:save';

export type RpgPhase = 'title' | 'overworld' | 'battle' | 'dialogue' | 'menu' | 'shop';

/** A pending battle the RpgBattleComponent picks up. */
export interface BattleSetup {
  readonly kind: 'wild';
  readonly foeSpecies: string;
  readonly foeLevel: number;
  readonly foeCatchRate: number;
}

/** Result of attempting a step, so the overworld can animate / react. */
export interface StepResult {
  readonly moved: boolean;
  readonly warped: boolean;
  readonly grass: boolean;
}

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

  readonly phase = signal<RpgPhase>('title');
  readonly game = signal<RpgSave | null>(null);
  readonly hasSave = signal<boolean>(this.readSave() !== null);
  /** The active battle's setup (null outside battle). */
  readonly battleSetup = signal<BattleSetup | null>(null);
  readonly party = computed<PartyMon[]>(() => this.game()?.party ?? []);
  /** A transient one-line message (signs, pickups, …). */
  readonly toast = signal<string | null>(null);
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  readonly map = computed<MapDef | null>(() => {
    const g = this.game();
    return g ? getMap(g.map) ?? null : null;
  });
  readonly player = computed(() => {
    const g = this.game();
    return g ? { x: g.x, y: g.y, facing: g.facing } : null;
  });

  /* ------------------------------------------------------------- lifecycle */

  newGame(name = 'Red'): void {
    const g = defaultSave(name);
    this.game.set(g);
    this.persist();
    this.phase.set('overworld');
    // TEMP (until P4's Professor event): grant a starter so battles are playable.
    void this.grantPokemon('charmander', 5);
  }

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

  continue(): void {
    const g = this.readSave();
    if (g) {
      this.game.set(g);
      this.phase.set('overworld');
    }
  }

  exitToTitle(): void {
    this.persist();
    this.phase.set('title');
  }

  persist(): void {
    const g = this.game();
    if (!g) return;
    this.store.write(SAVE_KEY, g);
    this.hasSave.set(true);
  }

  private readSave(): RpgSave | null {
    const g = this.store.read<RpgSave | null>(SAVE_KEY, null);
    return g && isValidSave(g) ? g : null;
  }

  /* ------------------------------------------------------------- movement */

  /** Turn to face a direction without moving. */
  face(dir: Direction): void {
    const g = this.game();
    if (!g || g.facing === dir) return;
    this.game.set({ ...g, facing: dir });
  }

  /** Whether the tile ahead in `dir` can be entered. */
  canStep(dir: Direction): boolean {
    const g = this.game();
    const m = this.map();
    if (!g || !m) return false;
    const t = ahead(g.x, g.y, dir);
    return canEnter(m, t.x, t.y);
  }

  /**
   * Commit a step in `dir`: updates facing + position, applies any warp, reports
   * whether we entered tall grass (the overworld rolls encounters in P2).
   */
  commitStep(dir: Direction): StepResult {
    const g = this.game();
    const m = this.map();
    if (!g || !m) return { moved: false, warped: false, grass: false };

    const t = ahead(g.x, g.y, dir);
    if (!canEnter(m, t.x, t.y)) {
      this.face(dir);
      return { moved: false, warped: false, grass: false };
    }

    let next: RpgSave = { ...g, x: t.x, y: t.y, facing: dir };
    const warp = warpAt(m, t.x, t.y);
    if (warp) {
      next = { ...next, map: warp.to, x: warp.toX, y: warp.toY, facing: warp.toFacing ?? dir };
      this.game.set(next);
      this.persist();
      return { moved: true, warped: true, grass: false };
    }

    this.game.set(next);
    const grass = isTallGrass(m, t.x, t.y);

    // Roll a wild encounter — only once the player actually has a Pokémon.
    if (grass && m.encounter && next.party.length > 0) {
      const rng = new SeededRng(`${Date.now()}-${t.x}-${t.y}-${Math.random()}`);
      const roll = rollEncounter(m.encounter, rng);
      if (roll) {
        this.battleSetup.set({
          kind: 'wild',
          foeSpecies: roll.species,
          foeLevel: roll.level,
          foeCatchRate: roll.catchRate,
        });
        this.phase.set('battle');
      }
    }
    return { moved: true, warped: false, grass };
  }

  /* --------------------------------------------------------------- battle */

  /** Persist a party array (HP/XP/level writeback, catches). */
  applyParty(party: PartyMon[]): void {
    const g = this.game();
    if (!g) return;
    this.game.set({ ...g, party });
    this.persist();
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

  /** Interact with whatever the player faces (signs for now; NPCs in P4). */
  interact(): void {
    const g = this.game();
    const m = this.map();
    if (!g || !m) return;
    const t = ahead(g.x, g.y, g.facing);
    const sign = signAt(m, t.x, t.y);
    if (sign) {
      this.showToast(sign);
      return;
    }
    const npc = npcAt(m, t.x, t.y);
    if (npc) this.showToast(`${npc.id} has nothing to say yet.`);
  }

  showToast(text: string, ms = 2600): void {
    this.toast.set(text);
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(null), ms);
  }
}
