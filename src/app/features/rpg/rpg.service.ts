import { Injectable, computed, inject, signal } from '@angular/core';
import { SaveService } from '../../core/storage/save.service';
import { BattleService } from '../battle/battle.service';
import { SeededRng } from '../../core/utils/rng';
import { getMap } from '../../game/rpg/maps';
import { ahead, canEnter, isTallGrass, npcAt, signAt, warpAt } from '../../game/rpg/movement';
import { rollEncounter } from '../../game/rpg/encounters';
import { ITEMS } from '../../game/rpg/items-catalog';
import { titleCase } from '../../core/ui/format';
import { defaultSave, isValidSave } from '../../game/rpg/save';
import {
  PARTY_MAX,
  depositToBox,
  healParty,
  makePartyMon,
  partyAlive,
  rename as renameMon,
  setLead,
  withdrawFromBox,
} from '../../game/rpg/party';
import type { Direction, ItemId, MapDef, PartyMon, RpgSave, ScriptNode } from '../../game/rpg/rpg-types';

const SAVE_KEY = 'rpg:save';

export type RpgPhase = 'title' | 'overworld' | 'battle' | 'dialogue' | 'menu' | 'shop' | 'starter';

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
    // Guided intro → choose a starter immediately (no hunting for the Lab).
    this.runScript([
      { say: 'Welcome to your PokéVerse adventure!' },
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
    if (!g.badges.length) return '▶ Head south to Route 1 → the Oakhaven Gym';
    return '★ Champion of the demo — explore freely!';
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
      return { moved: true, warped: true, grass: false };
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
      return { moved: true, warped: false, grass: grassItem };
    }

    this.game.set(next);
    const grass = isTallGrass(m, t.x, t.y);

    // Roll a wild encounter — only once the player actually has a Pokémon.
    if (grass && m.encounter && next.party.length > 0) {
      const rng = new SeededRng(`${Date.now()}-${t.x}-${t.y}-${Math.random()}`);
      const roll = rollEncounter(m.encounter, rng);
      if (roll) {
        if (!next.flags['first-battle']) this.setFlag('first-battle');
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
    const t = ahead(g.x, g.y, g.facing);
    const npc = npcAt(m, t.x, t.y);
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
      if (npc.script.length) {
        this.runScript(npc.script);
        return;
      }
      this.showToast(`${npc.id} has nothing to say.`);
      return;
    }
    const sign = signAt(m, t.x, t.y);
    if (sign) this.showToast(sign);
  }

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
    this.battleSetup.set({
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
    this.showToast(`${trainer.name}: ${trainer.intro}`, 3200);
    this.phase.set('battle');
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
    const mon = g.party[index];
    if (!mon) return 'No Pokémon there.';
    const t = { ...mon };
    const name = titleCase(t.nickname ?? t.species);
    let msg = '';
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

  showToast(text: string, ms = 2600): void {
    this.toast.set(text);
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(null), ms);
  }
}
