/**
 * Party-aware battle engine for 3-v-3 (and N-v-N) matches with real switching.
 *
 * Where {@link Battle} is a 1-v-1 duel, `TeamBattle` owns two parties, a single
 * **persistent field** (weather / terrain / entry hazards survive switches) and
 * per-Pokémon side state (status and HP persist; stat stages reset on switch-out,
 * as in the games). Each turn a side may use a move *or* switch — switches resolve
 * first, trigger entry hazards and switch-in abilities (Intimidate, weather/terrain
 * setters) and heal Regenerator holders on the way out.
 *
 * It shares all the *mechanics* (damage pipeline, status rules, weather/terrain/
 * hazard maths, stage tables) with the rest of the engine via the pure modules,
 * and drives every random branch through a {@link SeededRng} so matches stay
 * reproducible. The headless tournament simulator and the interactive match UI
 * both run on it.
 */
import { SeededRng } from '../../core/utils/rng';
import { battlerGrounded, sideTypes } from './damage';
import { chooseAiMove, estimateDamage, type AiTier } from './ai';
import { BattleCore, other } from './battle-core';
import type { BattleRules } from './rules';
import { freshStages } from './stat-stages';
import { rollSleepTurns, type StatusCondition } from './status';
import type { Weather } from './weather';
import type { Terrain } from './terrain';
import { resolveSwitchInHazards } from './hazards';
import { abilityById } from './abilities';
import { itemById } from './items';
import { effectiveness } from '../../core/utils/type-chart';
import {
  freshField,
  freshVolatiles,
  type Battler,
  type BattleEvent,
  type BattleSide,
  type Field,
  type SideIndex,
} from './battle-types';

/**
 * A side's choice for a turn. `pass` forfeits the side's action (the other side
 * still acts) — used by the RPG battle when the player throws a ball, uses an
 * item, or fails to run, so the opponent gets its free turn.
 */
export type TeamAction =
  | { type: 'move'; index: number; tera?: boolean }
  | { type: 'switch'; to: number }
  | { type: 'pass' };

function makeSide(battler: Battler, startHp?: number): BattleSide {
  const maxHp = battler.stats.hp;
  const hp =
    startHp === undefined || !Number.isFinite(startHp)
      ? maxHp
      : Math.max(0, Math.min(startHp, maxHp));
  return {
    battler,
    currentHp: hp,
    maxHp,
    pp: battler.moves.map((m) => m.pp ?? Infinity),
    status: 'none',
    sleepTurns: 0,
    toxicCounter: 0,
    stages: freshStages(),
    volatiles: freshVolatiles(),
    itemUsed: false,
  };
}

export interface TeamBattleState {
  parties: [BattleSide[], BattleSide[]];
  active: [number, number];
  field: Field;
  turn: number;
  finished: boolean;
  winner: SideIndex | null;
  /** Each team may Terastallize once per battle. */
  teraUsed: [boolean, boolean];
  /** A pivot move (U-turn…) hit: that side owes a switch after the turn. */
  pendingPivot: [boolean, boolean];
}

export class TeamBattle {
  readonly state: TeamBattleState;
  private readonly rng: SeededRng;
  private readonly rules?: BattleRules;
  private readonly aiTier: AiTier;
  private readonly core: BattleCore;
  private started = false;

  constructor(
    teamA: readonly Battler[],
    teamB: readonly Battler[],
    seed: number | string = Date.now(),
    opts: {
      rules?: BattleRules;
      aiTier?: AiTier;
      startHpA?: readonly number[];
      startHpB?: readonly number[];
      /** Pre-existing status conditions carried into battle (RPG field status). */
      startStatusA?: readonly StatusCondition[];
      startStatusB?: readonly StatusCondition[];
      /** A persistent battlefield condition active from the first turn (gym fields). */
      field?: { weather?: Weather; terrain?: Terrain };
    } = {},
  ) {
    this.rng = new SeededRng(seed);
    this.rules = opts.rules;
    this.aiTier = opts.aiTier ?? 'strong';
    const a = teamA.map((m, i) => makeSide(m, opts.startHpA?.[i]));
    const b = teamB.map((m, i) => makeSide(m, opts.startHpB?.[i]));
    this.applyStartStatus(a, opts.startStatusA);
    this.applyStartStatus(b, opts.startStatusB);
    const field = freshField();
    if (opts.field?.weather) {
      field.weather = opts.field.weather;
      field.weatherTurns = 999;
    }
    if (opts.field?.terrain) {
      field.terrain = opts.field.terrain;
      field.terrainTurns = 999;
    }
    this.state = {
      parties: [a, b],
      active: [firstLiving(a), firstLiving(b)],
      field,
      turn: 0,
      finished: false,
      winner: null,
      teraUsed: [false, false],
      pendingPivot: [false, false],
    };
    this.core = new BattleCore({
      rng: this.rng,
      rules: this.rules,
      field: this.state.field,
      active: (side) => this.active(side),
      finished: () => this.state.finished,
      // A KO is logged right where it happens; the match ends once a whole party is down.
      onHits: (defender, events) => this.logFaint(defender, events),
      onIndirect: (side, events) => this.logFaint(side, events),
      afterResidual: (side) => this.active(side).currentHp <= 0,
      onPivot: (side) => {
        if (this.benchedSwitches(side).length > 0) this.state.pendingPivot[side] = true;
      },
    });
  }

  private logFaint(side: SideIndex, events: BattleEvent[]): void {
    const s = this.active(side);
    if (s.currentHp <= 0) events.push({ kind: 'faint', side, name: s.battler.name });
  }

  /** Seed carried-in statuses onto living sides (sleepers get fresh sleep turns). */
  private applyStartStatus(sides: BattleSide[], statuses?: readonly StatusCondition[]): void {
    if (!statuses) return;
    sides.forEach((s, i) => {
      const status = statuses[i];
      if (!status || status === 'none' || s.currentHp <= 0) return;
      s.status = status;
      if (status === 'sleep') s.sleepTurns = rollSleepTurns((a, b) => this.rng.int(a, b));
    });
  }

  active(side: SideIndex): BattleSide {
    return this.state.parties[side][this.state.active[side]]!;
  }

  /** Indices of benched, non-fainted Pokémon a side could switch to. */
  benchedSwitches(side: SideIndex): number[] {
    return this.state.parties[side]
      .map((_s, i) => i)
      .filter((i) => i !== this.state.active[side] && this.state.parties[side][i]!.currentHp > 0);
  }

  /** A side must switch when its active Pokémon fainted (or pivoted out) and the team lives. */
  mustSwitch(side: SideIndex): boolean {
    const owes = this.active(side).currentHp <= 0 || this.state.pendingPivot[side];
    return owes && this.benchedSwitches(side).length > 0;
  }

  /** Whether the side may still Terastallize this battle. */
  canTerastallize(side: SideIndex): boolean {
    return !this.state.teraUsed[side] && this.active(side).currentHp > 0;
  }

  survivors(side: SideIndex): number {
    return this.state.parties[side].filter((s) => s.currentHp > 0).length;
  }

  hp(side: SideIndex): number[] {
    return this.state.parties[side].map((s) => s.currentHp);
  }

  /* ----------------------------------------------------------- AI helpers */

  /** Pick an action for a CPU side: switch when badly outmatched, else best move. */
  chooseAction(side: SideIndex): TeamAction {
    const me = this.active(side);
    const foe = this.active(other(side));
    const swap = this.bestSwitch(side);
    // Only switch when the active is clearly outmatched and a safe pivot exists.
    if (swap !== null && this.outmatched(me, foe) && !this.canKo(side)) {
      return { type: 'switch', to: swap };
    }
    return { type: 'move', index: this.aiMove(side) };
  }

  private aiMove(side: SideIndex): number {
    return chooseAiMove(
      {
        attacker: this.active(side),
        defender: this.active(other(side)),
        field: this.state.field,
        rng: this.rng,
        rules: this.rules,
        attackerIndex: side,
      },
      this.aiTier,
    );
  }

  private canKo(side: SideIndex): boolean {
    const me = this.active(side);
    const foe = this.active(other(side));
    return me.battler.moves.some(
      (mv) =>
        estimateDamage(mv, {
          attacker: me,
          defender: foe,
          field: this.state.field,
          rng: this.rng,
          rules: this.rules,
        }) >= foe.currentHp,
    );
  }

  /** True when the foe has a STAB type that hits the active for ≥2×. */
  private outmatched(me: BattleSide, foe: BattleSide): boolean {
    return foe.battler.types.some((t) => effectiveness(t, me.battler.types) >= 2);
  }

  /** Best benched mon that resists the foe's STAB, or null. */
  private bestSwitch(side: SideIndex): number | null {
    const foe = this.active(other(side));
    let best: number | null = null;
    let bestMult = Infinity;
    for (const i of this.benchedSwitches(side)) {
      const cand = this.state.parties[side][i];
      const worst = Math.max(
        ...foe.battler.types.map((t) => effectiveness(t, cand!.battler.types)),
      );
      if (worst < bestMult) {
        bestMult = worst;
        best = i;
      }
    }
    return bestMult < 1 ? best : null; // only switch to something that actually resists
  }

  /* --------------------------------------------------------------- turn */

  /** Resolve a forced switch (after a faint). */
  forceSwitch(side: SideIndex, to: number): BattleEvent[] {
    const events: BattleEvent[] = [];
    if (this.state.finished) return events;
    const pivoting = this.state.pendingPivot[side];
    this.state.pendingPivot[side] = false;
    this.switchIn(side, to, events, pivoting);
    return events;
  }

  /** Auto-resolve a forced switch with the AI's best pick. */
  autoForceSwitch(side: SideIndex): BattleEvent[] {
    const options = this.benchedSwitches(side);
    const pick = this.bestSwitch(side) ?? options[0]!;
    return this.forceSwitch(side, pick);
  }

  takeTurn(actionA: TeamAction, actionB: TeamAction): BattleEvent[] {
    if (this.state.finished) return [];
    const events: BattleEvent[] = [];
    if (!this.started) {
      this.started = true;
      this.applyEntryAbilities(events);
    }
    this.state.turn += 1;
    events.push({ kind: 'turn', turn: this.state.turn });

    this.core.beginTurn();

    const actions: [TeamAction, TeamAction] = [actionA, actionB];

    // 1) Switches resolve first (slower side switches first matters little; use speed).
    for (const side of this.core.bySpeed()) {
      const act = actions[side];
      if (act.type === 'switch') this.switchIn(side, act.to, events, true);
    }

    // 2) Terastallization happens before the moves of the turn.
    for (const side of this.core.bySpeed()) {
      const act = actions[side];
      if (act.type === 'move' && act.tera && this.canTerastallize(side)) {
        this.state.teraUsed[side] = true;
        this.core.terastallize(side, events);
      }
    }

    // 3) Moves, in priority/speed order (locks and Struggle resolved against the live Pokémon).
    const picks: [number, number] = [0, 0];
    for (const side of [0, 1] as SideIndex[]) {
      const act = actions[side];
      if (act.type === 'move') picks[side] = this.core.resolveMoveIndex(side, act.index);
    }
    const movers = this.core.orderSides(
      ([0, 1] as SideIndex[]).filter((s) => actions[s].type === 'move'),
      (side) => this.core.moveFor(side, picks[side]),
    );
    for (const side of movers) {
      if (this.state.finished) break;
      if (this.active(side).currentHp <= 0) continue;
      this.core.executeMove(side, picks[side], events);
    }

    if (!this.state.finished) this.core.endOfTurn(events);
    this.resolveFaints(events);
    return events;
  }

  /* ----------------------------------------------------------- switching */

  private switchIn(side: SideIndex, to: number, events: BattleEvent[], voluntary: boolean): void {
    const party = this.state.parties[side];
    if (to < 0 || to >= party.length || party[to]!.currentHp <= 0 || to === this.state.active[side])
      return;

    const outgoing = this.active(side);
    if (voluntary && outgoing.currentHp > 0) {
      const ability = abilityById(outgoing.battler.ability);
      if (ability?.regenerator) {
        const heal = Math.floor(outgoing.maxHp / 3);
        outgoing.currentHp = Math.min(outgoing.maxHp, outgoing.currentHp + heal);
      }
      // Stat stages and volatiles reset on switch-out.
      outgoing.stages = freshStages();
      outgoing.volatiles = freshVolatiles();
    }

    this.state.active[side] = to;
    const incoming = this.active(side);
    incoming.stages = freshStages();
    incoming.volatiles = freshVolatiles();
    events.push({
      kind: 'switch',
      side,
      name: incoming.battler.name,
      text: `${incoming.battler.name} was sent out!`,
    });

    this.applySwitchInHazards(side, events);
    if (incoming.currentHp > 0) this.core.fireEntryAbility(side, events);
  }

  private applySwitchInHazards(side: SideIndex, events: BattleEvent[]): void {
    const incoming = this.active(side);
    // Heavy-Duty Boots walk straight past every hazard.
    if (itemById(incoming.battler.item)?.ignoresHazards) return;
    const grounded = battlerGrounded(incoming);
    const hz = this.state.field.hazards[side];
    if (hz['stealth-rock'] === 0 && hz.spikes === 0 && hz['toxic-spikes'] === 0) return;
    if (!grounded && hz['stealth-rock'] === 0) return; // only Stealth Rock hits non-grounded
    const raw = resolveSwitchInHazards(
      hz,
      incoming.battler.name,
      sideTypes(incoming),
      incoming.maxHp,
    );
    // Magic Guard takes no hazard damage (the poison from Toxic Spikes still sticks).
    const res = abilityById(incoming.battler.ability)?.magicGuard ? { ...raw, damage: 0 } : raw;
    if (res.clearsToxicSpikes) this.state.field.hazards[side] = { ...hz, 'toxic-spikes': 0 };
    for (const msg of res.messages) events.push({ kind: 'status', text: msg });
    if (res.damage > 0) {
      incoming.currentHp = Math.max(0, incoming.currentHp - res.damage);
      events.push({
        kind: 'damage',
        side,
        amount: res.damage,
        effectiveness: 1,
        crit: false,
        remainingHp: incoming.currentHp,
        maxHp: incoming.maxHp,
      });
    }
    if (res.status !== 'none' && incoming.currentHp > 0)
      this.core.inflictStatus(side, res.status, events);
  }

  private applyEntryAbilities(events: BattleEvent[]): void {
    for (const side of this.core.bySpeed()) this.core.fireEntryAbility(side, events);
  }

  /** End the match when a whole party is down (faints are logged at the KO site). */
  private resolveFaints(events: BattleEvent[]): void {
    if (this.state.finished) return;
    const aDown = this.survivors(0) === 0;
    const bDown = this.survivors(1) === 0;
    if (aDown || bDown) {
      this.state.finished = true;
      this.state.winner = bDown ? 0 : 1;
      events.push({ kind: 'end', winner: this.state.winner, loser: other(this.state.winner) });
    }
  }
}

function firstLiving(party: BattleSide[]): number {
  const i = party.findIndex((s) => s.currentHp > 0);
  return i < 0 ? 0 : i;
}
