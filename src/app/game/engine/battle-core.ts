/**
 * The shared turn mechanics behind {@link Battle} (1-v-1) and {@link TeamBattle} (party
 * battles): move execution (status gates, accuracy, immunities, the damage pipeline,
 * secondary effects, drain/recoil, contact triggers), end-of-turn residuals and the small
 * state atoms (status, stat stages, weather, terrain, hazards, healing).
 *
 * The core owns no battle state. A host supplies the RNG, the rules, the field and the
 * currently active {@link BattleSide} per side, plus a few hooks for what differs between the
 * two formats (when a faint ends the match, how a KO is logged). Every random branch goes
 * through the host's {@link SeededRng}, so a seed always replays the same event log.
 */
import type { SeededRng } from '../../core/utils/rng';
import {
  CRIT_CHANCE,
  MAX_ROLL,
  MIN_ROLL,
  battlerGrounded,
  computeDamage,
  computeMoveDamage,
  moveEffectiveness,
  sideTypes,
} from './damage';
import { abilityById } from './abilities';
import { itemById } from './items';
import { applyBoost, applyBoosts, stageMultiplier, type BoostableStat } from './stat-stages';
import {
  canApplyStatus,
  paralysisSpeedFactor,
  residualDamage,
  residualMessage,
  resolveMoveGate,
  rollSleepTurns,
  statusSetMessage,
  type StatusCondition,
} from './status';
import {
  takesWeatherChip,
  weatherChipDamage,
  weatherChipMessage,
  weatherSetMessage,
  type Weather,
} from './weather';
import {
  terrainBlocksPriority,
  terrainBlocksStatus,
  terrainHeal,
  terrainSetMessage,
  type Terrain,
} from './terrain';
import { addHazard, hazardSetMessage, type HazardKind } from './hazards';
import {
  SCREEN_TURNS,
  TAILWIND_TURNS,
  TRICK_ROOM_TURNS,
  screenAllowed,
  screenEndMessage,
  screenSetMessage,
  type ScreenKind,
} from './field-effects';
import type { BattleRules } from './rules';
import type { BattleEvent, BattleMove, BattleSide, Field, SideIndex } from './battle-types';

/** What differs between the duel and the party format. */
export interface CoreHost {
  readonly rng: SeededRng;
  readonly rules?: BattleRules;
  readonly field: Field;
  /** The side's currently fighting Pokémon. */
  active(side: SideIndex): BattleSide;
  /** True once the match is decided (residuals stop mid-turn). */
  finished(): boolean;
  /** Right after a damaging move's hit loop (the party format logs a KO immediately). */
  onHits?(defender: SideIndex, events: BattleEvent[]): void;
  /** After a move fully resolved (the duel ends on a faint here). */
  onMoveDone?(attacker: SideIndex, defender: SideIndex, events: BattleEvent[]): void;
  /** After indirect damage landed on a side (the party format logs the faint). */
  onIndirect?(side: SideIndex, events: BattleEvent[]): void;
  /** After residual damage: handle a faint; return true when the side's residuals stop. */
  afterResidual(side: SideIndex, events: BattleEvent[]): boolean;
  /** A pivot move (U-turn, Volt Switch) hit: the party format queues a switch for the user. */
  onPivot?(side: SideIndex, events: BattleEvent[]): void;
}

/** Used when a Pokémon has no PP left in any move. */
export const STRUGGLE: BattleMove = {
  name: 'Struggle',
  type: 'normal',
  power: 50,
  accuracy: 0,
  damageClass: 'physical',
  recoil: 0.25,
  flags: { contact: true },
};

/** Duration of Taunt and Encore, in turns. */
const TAUNT_TURNS = 3;
const ENCORE_TURNS = 3;

function hasPp(s: BattleSide, i: number): boolean {
  const pp = s.pp[i];
  return pp === undefined || !Number.isFinite(pp) || pp > 0;
}

const STAT_LABEL: Record<BoostableStat, string> = {
  attack: 'Attack',
  defense: 'Defense',
  'special-attack': 'Sp. Atk',
  'special-defense': 'Sp. Def',
  speed: 'Speed',
  accuracy: 'accuracy',
  evasion: 'evasion',
};

export function other(side: SideIndex): SideIndex {
  return side === 0 ? 1 : 0;
}

/** Critical-hit probability for an extra crit-stage count. */
export function critChanceForStage(stage: number): number {
  const table = [CRIT_CHANCE, 1 / 8, 1 / 2, 1];
  return table[Math.max(0, Math.min(3, stage))]!;
}

export function stageChangeText(name: string, stat: BoostableStat, delta: number): string {
  const label = STAT_LABEL[stat];
  if (delta >= 2) return `${name}'s ${label} rose sharply!`;
  if (delta === 1) return `${name}'s ${label} rose!`;
  if (delta === -1) return `${name}'s ${label} fell!`;
  return `${name}'s ${label} harshly fell!`;
}

export class BattleCore {
  constructor(private readonly host: CoreHost) {}

  private get rng(): SeededRng {
    return this.host.rng;
  }

  private get field(): Field {
    return this.host.field;
  }

  private active(side: SideIndex): BattleSide {
    return this.host.active(side);
  }

  /* ------------------------------------------------------------ ordering */

  /** Speed after paralysis, Choice Scarf, Tailwind, weather-speed abilities and stages. */
  effectiveSpeed(side: SideIndex): number {
    const s = this.active(side);
    let spe = s.battler.stats.speed * stageMultiplier('speed', s.stages.speed);
    spe *= paralysisSpeedFactor(s.status);
    const item = itemById(s.battler.item);
    if (item?.statMultiplier?.stat === 'speed') spe *= item.statMultiplier.factor;
    const ability = abilityById(s.battler.ability);
    if (ability?.weatherSpeed && ability.weatherSpeed === this.field.weather) spe *= 2;
    if (this.field.tailwind[side] > 0) spe *= 2;
    return spe;
  }

  /** Faster side first — or the slower one under Trick Room. */
  bySpeed(): SideIndex[] {
    const a = this.effectiveSpeed(0);
    const b = this.effectiveSpeed(1);
    const first0 = this.field.trickRoom > 0 ? a <= b : a >= b;
    return first0 ? [0, 1] : [1, 0];
  }

  /** A move's priority bracket for a side (Prankster lifts status moves). */
  priorityOf(side: SideIndex, move: BattleMove): number {
    const ability = abilityById(this.active(side).battler.ability);
    const status = move.power <= 0 || move.damageClass === 'status';
    return (move.priority ?? 0) + (ability?.prankster && status ? 1 : 0);
  }

  /** Order sides for a turn: priority, then adjusted speed, then a seeded coin flip. */
  orderSides(sides: SideIndex[], moveOf: (side: SideIndex) => BattleMove): SideIndex[] {
    const trick = this.field.trickRoom > 0;
    return [...sides].sort((a, b) => {
      const pa = this.priorityOf(a, moveOf(a));
      const pb = this.priorityOf(b, moveOf(b));
      if (pa !== pb) return pb - pa;
      const sa = this.effectiveSpeed(a);
      const sb = this.effectiveSpeed(b);
      if (sa !== sb) return trick ? sa - sb : sb - sa;
      return this.rng.next() < 0.5 ? -1 : 1;
    });
  }

  /* ----------------------------------------------------------- move choice */

  /** The move a side is locked into (charging, Encore, Choice lock), or null when it is free to choose. */
  forcedMoveIndex(side: SideIndex): number | null {
    const s = this.active(side);
    const v = s.volatiles;
    if (v.charging !== null) return v.charging;
    if (v.encore && hasPp(s, v.encore.index)) return v.encore.index;
    const locked = v.lockedMove;
    if (locked !== null && itemById(s.battler.item)?.choiceLock && hasPp(s, locked)) return locked;
    return null;
  }

  /** True when no move has PP left, so the side can only Struggle. */
  mustStruggle(side: SideIndex): boolean {
    const s = this.active(side);
    return !s.battler.moves.some((_, i) => hasPp(s, i));
  }

  /** The move a side must actually use: charging, Encore and Choice locks override the request. */
  resolveMoveIndex(side: SideIndex, requested: number): number {
    const s = this.active(side);
    const forced = this.forcedMoveIndex(side);
    if (forced !== null) return forced;
    if (hasPp(s, requested)) return requested;
    const fallback = s.battler.moves.findIndex((_, i) => hasPp(s, i));
    return fallback; // -1 → Struggle
  }

  /** The move behind a resolved index (-1 is Struggle). */
  moveFor(side: SideIndex, index: number): BattleMove {
    return index < 0 ? STRUGGLE : this.active(side).battler.moves[index]!;
  }

  /** Turn start: flinch and Protect only last for the turn they were set. */
  beginTurn(): void {
    for (const side of [0, 1] as const) {
      const v = this.active(side).volatiles;
      v.flinch = false;
      v.protect = false;
    }
  }

  /** Terastallize the side's active Pokémon (the host limits it to once per team). */
  terastallize(side: SideIndex, events: BattleEvent[]): void {
    const s = this.active(side);
    if (s.terastallized) return;
    const type = s.battler.teraType ?? s.battler.types[0];
    if (!type) return;
    s.terastallized = type;
    events.push({
      kind: 'tera',
      side,
      type,
      text: `${s.battler.name} Terastallized into the ${type.charAt(0).toUpperCase()}${type.slice(1)} type!`,
    });
  }

  /* --------------------------------------------------------- entry phase */

  /** Weather / terrain setters, Intimidate and Download for the Pokémon that just entered. */
  fireEntryAbility(side: SideIndex, events: BattleEvent[]): void {
    const s = this.active(side);
    const ability = abilityById(s.battler.ability);
    if (!ability) return;
    if (ability.weatherOnEntry) this.setWeather(ability.weatherOnEntry, s, events);
    if (ability.terrainOnEntry) this.setTerrain(ability.terrainOnEntry, events);
    if (ability.intimidate) {
      this.changeStage(other(side), 'attack', -ability.intimidate, events, true);
      events.push({
        kind: 'ability',
        side,
        ability: ability.id,
        text: `${s.battler.name}'s Intimidate cut the foe's Attack!`,
      });
    }
    if (ability.download) {
      const foe = this.active(other(side));
      const stat =
        foe.battler.stats.defense < foe.battler.stats['special-defense']
          ? 'attack'
          : 'special-attack';
      this.changeStage(side, stat, 1, events);
      events.push({
        kind: 'ability',
        side,
        ability: ability.id,
        text: `${s.battler.name}'s Download analysed the foe!`,
      });
    }
  }

  /* --------------------------------------------------------- move engine */

  /**
   * Run one move for `side`. `moveIndex` must already be resolved through
   * {@link resolveMoveIndex} (it may be -1 for Struggle).
   */
  executeMove(side: SideIndex, moveIndex: number, events: BattleEvent[]): void {
    const attackerSide = this.active(side);
    const defenderIndex = other(side);
    const defenderSide = this.active(defenderIndex);
    const move = this.moveFor(side, moveIndex);
    const name = attackerSide.battler.name;
    const av = attackerSide.volatiles;

    // --- Pre-move gates -----------------------------------------------------
    if (av.flinch) {
      events.push({ kind: 'flinch', side, text: `${name} flinched!` });
      return;
    }
    if (av.recharging) {
      av.recharging = false;
      events.push({ kind: 'status', text: `${name} must recharge!` });
      return;
    }
    const gate = resolveMoveGate(
      name,
      attackerSide.status,
      attackerSide.sleepTurns,
      this.rng.next(),
    );
    attackerSide.status = gate.status;
    attackerSide.sleepTurns = gate.sleepTurns;
    if (gate.message && (gate.status === 'none' || !gate.canMove)) {
      if (gate.status === 'none') events.push({ kind: 'cure', side, text: gate.message });
      else events.push({ kind: 'status', text: gate.message });
    }
    if (!gate.canMove) return;

    if (av.confusionTurns > 0 && this.confusionBlocks(side, events)) return;

    const isStatus = move.power <= 0 || move.damageClass === 'status';
    if (av.taunt > 0 && isStatus) {
      events.push({ kind: 'status', text: `${name} can't use ${move.name} after the taunt!` });
      return;
    }

    // --- Two-turn moves: charge now, strike next turn ------------------------
    const striking = move.charge !== undefined && av.charging === moveIndex;
    if (move.charge && !striking && move.charge.skipWeather !== this.field.weather) {
      this.spendPp(attackerSide, moveIndex);
      av.charging = moveIndex;
      av.lastMove = moveIndex;
      events.push({ kind: 'move', side, attacker: name, move: move.name });
      events.push({ kind: 'status', text: `${name} is charging up!` });
      return;
    }
    if (striking) av.charging = null;
    else this.spendPp(attackerSide, moveIndex);

    av.lastMove = moveIndex >= 0 ? moveIndex : null;
    if (!move.protect) av.protectCount = 0;
    if (
      moveIndex >= 0 &&
      itemById(attackerSide.battler.item)?.choiceLock &&
      av.lockedMove === null
    ) {
      av.lockedMove = moveIndex;
    }

    events.push({ kind: 'move', side, attacker: name, move: move.name });

    // --- Protect ------------------------------------------------------------
    if (move.protect) {
      this.useProtect(attackerSide, events);
      return;
    }
    if (defenderSide.volatiles.protect && this.isAimedAtFoe(move)) {
      events.push({ kind: 'status', text: `${defenderSide.battler.name} protected itself!` });
      return;
    }

    // --- Status / non-damaging moves ---------------------------------------
    if (isStatus) {
      if (move.accuracy > 0 && this.rng.next() * 100 >= move.accuracy) {
        events.push({ kind: 'miss', side, attacker: name, move: move.name });
        return;
      }
      this.applyStatusMove(side, defenderIndex, move, events);
      return;
    }

    // --- Psychic Terrain blocks increased-priority moves vs grounded --------
    if (
      terrainBlocksPriority(
        this.field.terrain,
        this.priorityOf(side, move),
        battlerGrounded(defenderSide),
      )
    ) {
      events.push({
        kind: 'status',
        text: `${defenderSide.battler.name} is protected by the terrain!`,
      });
      return;
    }

    // --- Accuracy -----------------------------------------------------------
    if (move.accuracy > 0) {
      const acc =
        (move.accuracy * stageMultiplier('accuracy', attackerSide.stages.accuracy)) /
        stageMultiplier('evasion', defenderSide.stages.evasion);
      if (this.rng.next() * 100 >= acc) {
        events.push({ kind: 'miss', side, attacker: name, move: move.name });
        return;
      }
    }

    // --- Defender ability immunities (absorb) / Air Balloon ----------------
    if (this.tryAbsorb(side, defenderIndex, move, events)) return;

    // --- Damage (with multi-hit) -------------------------------------------
    const hits = move.multiHit ? this.rng.int(move.multiHit[0], move.multiHit[1]) : 1;
    let totalDamage = 0;
    let connected = false;
    for (let h = 0; h < hits; h++) {
      if (defenderSide.currentHp <= 0) break;
      const flat = this.flatDamage(attackerSide, defenderSide, move);
      let crit = false;
      let dealt: number;
      let effectiveness: number;
      if (flat) {
        // Seismic Toss & co: no crit, no roll — only type immunity applies.
        dealt = flat.damage;
        effectiveness = flat.effectiveness;
      } else {
        crit = this.rng.chance(critChanceForStage(move.critStage ?? 0));
        const roll = MIN_ROLL + this.rng.next() * (MAX_ROLL - MIN_ROLL);
        const result = computeMoveDamage({
          attacker: attackerSide,
          defender: defenderSide,
          field: this.field,
          move,
          crit,
          roll,
          rules: this.host.rules,
          flashFire: attackerSide.volatiles.flashFire,
          defenderScreens: this.field.screens[defenderIndex],
        });
        dealt = result.damage;
        effectiveness = result.effectiveness;
        crit = result.crit;
      }

      // A Substitute soaks the hit (sound moves slip past).
      if (defenderSide.volatiles.substitute > 0 && !move.flags?.sound) {
        this.hitSubstitute(defenderIndex, dealt, events);
        connected = true;
        if (defenderSide.volatiles.substitute <= 0) break; // a multi-hit move stops once it breaks
        continue;
      }

      // Sturdy / Focus Sash: survive a full-HP OHKO at 1 HP.
      if (dealt >= defenderSide.currentHp && defenderSide.currentHp === defenderSide.maxHp) {
        const defAbility = this.defenderAbility(attackerSide, defenderSide);
        const defItem = itemById(defenderSide.battler.item);
        if (defAbility?.sturdy) {
          dealt = defenderSide.maxHp - 1;
          events.push({
            kind: 'ability',
            side: defenderIndex,
            ability: defAbility.id,
            text: `${defenderSide.battler.name} endured the hit with Sturdy!`,
          });
        } else if (defItem?.focusSash && !defenderSide.itemUsed) {
          dealt = defenderSide.maxHp - 1;
          defenderSide.itemUsed = true;
          events.push({
            kind: 'item',
            side: defenderIndex,
            item: defItem.id,
            text: `${defenderSide.battler.name} hung on with its Focus Sash!`,
          });
        }
      }

      defenderSide.currentHp = Math.max(0, defenderSide.currentHp - dealt);
      totalDamage += dealt;
      connected = true;
      events.push({
        kind: 'damage',
        side: defenderIndex,
        amount: dealt,
        effectiveness,
        crit,
        remainingHp: defenderSide.currentHp,
        maxHp: defenderSide.maxHp,
      });

      this.afterHit(defenderIndex, effectiveness, events);
      this.applyContactEffects(side, defenderIndex, move, events);
      if (defenderSide.currentHp <= 0 || attackerSide.currentHp <= 0) break;
    }

    this.host.onHits?.(defenderIndex, events);
    if (!connected) return;

    if (
      defenderSide.currentHp <= 0 &&
      attackerSide.currentHp > 0 &&
      abilityById(attackerSide.battler.ability)?.moxie
    ) {
      this.changeStage(side, 'attack', 1, events);
    }

    // --- Drain / recoil / Life Orb -----------------------------------------
    if (move.drain && totalDamage > 0) {
      this.heal(
        side,
        Math.max(1, Math.floor(totalDamage * move.drain)),
        events,
        `${name} drained energy!`,
      );
    }
    if (move.recoil && totalDamage > 0) {
      this.indirectDamage(
        side,
        Math.max(1, Math.floor(totalDamage * move.recoil)),
        events,
        `${name} is hit with recoil!`,
      );
    }
    const atkItem = itemById(attackerSide.battler.item);
    const atkAbility = abilityById(attackerSide.battler.ability);
    if (
      atkItem?.recoil &&
      totalDamage > 0 &&
      !atkAbility?.magicGuard &&
      !atkAbility?.sheerForce &&
      attackerSide.currentHp > 0
    ) {
      this.indirectDamage(
        side,
        Math.max(1, Math.floor(attackerSide.maxHp * atkItem.recoil)),
        events,
        `${name} is hurt by its Life Orb!`,
      );
    }

    // --- Knock Off ----------------------------------------------------------
    if (move.knockOff && totalDamage > 0) this.knockOffItem(defenderIndex, events);

    // --- Secondary effect (Sheer Force trades it for power) -----------------
    if (
      move.secondary &&
      !atkAbility?.sheerForce &&
      totalDamage > 0 &&
      defenderSide.currentHp > 0 &&
      this.rng.next() * 100 < move.secondary.chance
    ) {
      this.applySecondary(side, defenderIndex, move, events);
    }

    // --- Recharge / pivot ---------------------------------------------------
    if (move.recharge && attackerSide.currentHp > 0) av.recharging = true;
    if (move.pivot && attackerSide.currentHp > 0) this.host.onPivot?.(side, events);

    this.host.onMoveDone?.(side, defenderIndex, events);
  }

  /* ----------------------------------------------------- move sub-routines */

  private spendPp(s: BattleSide, index: number): void {
    const move = index >= 0 ? s.battler.moves[index] : undefined;
    if (move?.pp !== undefined && Number.isFinite(s.pp[index])) {
      s.pp[index] = Math.max(0, s.pp[index]! - 1);
    }
  }

  /** The defender's ability as seen by an attacker (Mold Breaker ignores it). */
  private defenderAbility(attacker: BattleSide, defender: BattleSide) {
    return abilityById(attacker.battler.ability)?.moldBreaker
      ? undefined
      : abilityById(defender.battler.ability);
  }

  /** Moves that act on the foe (and so are stopped by Protect and Substitute). */
  private isAimedAtFoe(move: BattleMove): boolean {
    if (move.power > 0 && move.damageClass !== 'status') return true;
    if (move.target === 'self') return false;
    return !!(
      move.inflictStatus ||
      move.inflictConfusion ||
      move.taunt ||
      move.encore ||
      move.leechSeed ||
      (move.boosts && move.target === 'opponent')
    );
  }

  private useProtect(s: BattleSide, events: BattleEvent[]): void {
    const v = s.volatiles;
    const works = v.protectCount === 0 || this.rng.next() < 1 / 3 ** v.protectCount;
    if (!works) {
      v.protectCount = 0;
      events.push({ kind: 'status', text: 'But it failed!' });
      return;
    }
    v.protect = true;
    v.protectCount += 1;
    events.push({ kind: 'status', text: `${s.battler.name} protected itself!` });
  }

  /** Confusion gate: returns true when the Pokémon hurt itself instead of moving. */
  private confusionBlocks(side: SideIndex, events: BattleEvent[]): boolean {
    const s = this.active(side);
    const v = s.volatiles;
    v.confusionTurns -= 1;
    if (v.confusionTurns <= 0) {
      v.confusionTurns = 0;
      events.push({ kind: 'status', text: `${s.battler.name} snapped out of its confusion!` });
      return false;
    }
    events.push({ kind: 'status', text: `${s.battler.name} is confused!` });
    if (this.rng.next() >= 1 / 3) return false;
    // Self-hit: a typeless 40-power physical attack against its own Defense.
    const atk = Math.max(
      1,
      Math.floor(s.battler.stats.attack * stageMultiplier('attack', s.stages.attack)),
    );
    const def = Math.max(
      1,
      Math.floor(s.battler.stats.defense * stageMultiplier('defense', s.stages.defense)),
    );
    const roll = MIN_ROLL + this.rng.next() * (MAX_ROLL - MIN_ROLL);
    const hit = computeDamage({
      level: s.battler.level,
      power: 40,
      attack: atk,
      defense: def,
      stab: 1,
      typeEffectiveness: 1,
      crit: false,
      roll,
    });
    s.currentHp = Math.max(0, s.currentHp - hit.damage);
    events.push({
      kind: 'damage',
      side,
      amount: hit.damage,
      effectiveness: 1,
      crit: false,
      remainingHp: s.currentHp,
      maxHp: s.maxHp,
    });
    events.push({ kind: 'status', text: `${s.battler.name} hurt itself in its confusion!` });
    this.host.onIndirect?.(side, events);
    this.host.onMoveDone?.(side, other(side), events);
    return true;
  }

  /** Fixed-damage moves (Seismic Toss, Night Shade, Super Fang) or null for normal damage. */
  private flatDamage(
    attacker: BattleSide,
    defender: BattleSide,
    move: BattleMove,
  ): { damage: number; effectiveness: number } | null {
    if (move.fixedDamage === undefined && move.fractionDamage === undefined) return null;
    const effectiveness = moveEffectiveness(move, sideTypes(defender), this.host.rules);
    if (effectiveness === 0) return { damage: 0, effectiveness };
    const damage =
      move.fixedDamage !== undefined
        ? move.fixedDamage === 'level'
          ? attacker.battler.level
          : move.fixedDamage
        : Math.max(1, Math.floor(defender.currentHp * (move.fractionDamage ?? 0)));
    return { damage, effectiveness };
  }

  private hitSubstitute(defenderIndex: SideIndex, dealt: number, events: BattleEvent[]): void {
    const s = this.active(defenderIndex);
    s.volatiles.substitute = Math.max(0, s.volatiles.substitute - dealt);
    if (s.volatiles.substitute <= 0) {
      events.push({
        kind: 'substitute',
        side: defenderIndex,
        up: false,
        text: `${s.battler.name}'s substitute faded!`,
      });
    } else {
      events.push({ kind: 'status', text: `The substitute took the hit for ${s.battler.name}!` });
    }
  }

  /** Reactions to a landed hit: Weakness Policy, Air Balloon. */
  private afterHit(defenderIndex: SideIndex, effectiveness: number, events: BattleEvent[]): void {
    const d = this.active(defenderIndex);
    if (d.currentHp <= 0 || d.itemUsed) return;
    const item = itemById(d.battler.item);
    if (item?.airBalloon) {
      d.itemUsed = true;
      events.push({
        kind: 'item',
        side: defenderIndex,
        item: item.id,
        text: `${d.battler.name}'s Air Balloon popped!`,
      });
    } else if (item?.weaknessPolicy && effectiveness > 1) {
      d.itemUsed = true;
      events.push({
        kind: 'item',
        side: defenderIndex,
        item: item.id,
        text: `${d.battler.name}'s Weakness Policy was triggered!`,
      });
      this.applyMoveBoosts(defenderIndex, { attack: 2, 'special-attack': 2 }, events);
    }
  }

  private knockOffItem(defenderIndex: SideIndex, events: BattleEvent[]): void {
    const d = this.active(defenderIndex);
    const item = d.battler.item;
    if (!item || d.itemUsed || d.currentHp <= 0) return;
    // Replace the battler copy so the team's original build keeps its item.
    d.battler = { ...d.battler, item: undefined };
    d.volatiles.lockedMove = null;
    events.push({
      kind: 'item',
      side: defenderIndex,
      item,
      text: `${d.battler.name} lost its ${itemById(item)?.name ?? 'item'}!`,
    });
  }

  private tryAbsorb(
    side: SideIndex,
    defenderIndex: SideIndex,
    move: BattleMove,
    events: BattleEvent[],
  ): boolean {
    const defenderSide = this.active(defenderIndex);
    // Air Balloon: floating holders dodge Ground moves until the balloon pops.
    if (
      move.type === 'ground' &&
      itemById(defenderSide.battler.item)?.airBalloon &&
      !defenderSide.itemUsed
    ) {
      events.push({
        kind: 'item',
        side: defenderIndex,
        item: 'air-balloon',
        text: `${defenderSide.battler.name} floats away from it with its Air Balloon!`,
      });
      return true;
    }
    const ability = this.defenderAbility(this.active(side), defenderSide);
    if (!ability?.absorb || ability.absorb.type !== move.type) return false;
    const { effect } = ability.absorb;
    if (effect === 'flash-fire') {
      defenderSide.volatiles.flashFire = true;
      events.push({
        kind: 'ability',
        side: defenderIndex,
        ability: ability.id,
        text: `${defenderSide.battler.name}'s Flash Fire raised its power!`,
      });
    } else if (effect === 'heal25') {
      this.heal(
        defenderIndex,
        Math.floor(defenderSide.maxHp / 4),
        events,
        `${defenderSide.battler.name}'s ${ability.name} restored HP!`,
      );
    } else {
      events.push({
        kind: 'ability',
        side: defenderIndex,
        ability: ability.id,
        text: `${defenderSide.battler.name} avoids it with ${ability.name}!`,
      });
    }
    return true;
  }

  private applyContactEffects(
    side: SideIndex,
    defenderIndex: SideIndex,
    move: BattleMove,
    events: BattleEvent[],
  ): void {
    if (!move.flags?.contact) return;
    const attackerSide = this.active(side);
    const defenderSide = this.active(defenderIndex);
    if (attackerSide.currentHp <= 0) return;
    const defAbility = this.defenderAbility(attackerSide, defenderSide);
    const defItem = itemById(defenderSide.battler.item);

    if (defAbility?.contactStatus && this.rng.next() * 100 < defAbility.contactStatus.chance) {
      this.inflictStatus(side, defAbility.contactStatus.status, events);
    }
    if (defAbility?.roughSkin) {
      this.indirectDamage(
        side,
        Math.max(1, Math.floor(attackerSide.maxHp * defAbility.roughSkin)),
        events,
        `${attackerSide.battler.name} was hurt by Rough Skin!`,
      );
    }
    if (defItem?.rockyHelmet && attackerSide.currentHp > 0) {
      this.indirectDamage(
        side,
        Math.max(1, Math.floor(attackerSide.maxHp * defItem.rockyHelmet)),
        events,
        `${attackerSide.battler.name} was hurt by the Rocky Helmet!`,
      );
    }
  }

  private applySecondary(
    side: SideIndex,
    defenderIndex: SideIndex,
    move: BattleMove,
    events: BattleEvent[],
  ): void {
    const sec = move.secondary!;
    if (sec.status) this.inflictStatus(defenderIndex, sec.status, events);
    if (sec.confusion) this.confuse(defenderIndex, events);
    if (sec.boosts) {
      const target = sec.boostTarget === 'self' ? side : defenderIndex;
      this.applyMoveBoosts(target, sec.boosts, events, target !== side);
    }
    if (sec.flinch) {
      // Cleared at the start of every turn, so it only bites if the target moves later this turn.
      this.active(defenderIndex).volatiles.flinch = true;
    }
  }

  private applyStatusMove(
    side: SideIndex,
    defenderIndex: SideIndex,
    move: BattleMove,
    events: BattleEvent[],
  ): void {
    const attackerSide = this.active(side);
    const defenderSide = this.active(defenderIndex);
    let didSomething = false;

    // A Substitute shields the foe from every status effect aimed at it.
    if (this.isAimedAtFoe(move) && defenderSide.volatiles.substitute > 0 && !move.flags?.sound) {
      events.push({ kind: 'status', text: 'But it failed!' });
      return;
    }

    if (move.boosts) {
      const target = move.target === 'opponent' ? defenderIndex : side;
      didSomething =
        this.applyMoveBoosts(target, move.boosts, events, target !== side) || didSomething;
    }
    if (move.inflictStatus) {
      didSomething = this.inflictStatus(defenderIndex, move.inflictStatus, events) || didSomething;
    }
    if (move.inflictConfusion) {
      didSomething = this.confuse(defenderIndex, events) || didSomething;
    }
    if (move.setsWeather) {
      this.setWeather(move.setsWeather, attackerSide, events);
      didSomething = true;
    }
    if (move.setsTerrain) {
      this.setTerrain(move.setsTerrain, events);
      didSomething = true;
    }
    if (move.setsHazard) {
      this.layHazard(defenderIndex, move.setsHazard, events);
      didSomething = true;
    }
    if (move.healing) {
      const before = attackerSide.currentHp;
      this.heal(
        side,
        Math.floor(attackerSide.maxHp * move.healing),
        events,
        `${attackerSide.battler.name} regained health!`,
      );
      didSomething = attackerSide.currentHp !== before || didSomething;
    }
    if (move.setsScreen) {
      didSomething = this.raiseScreen(side, move.setsScreen, events) || didSomething;
    }
    if (move.setsTailwind) didSomething = this.raiseTailwind(side, events) || didSomething;
    if (move.setsTrickRoom) {
      this.toggleTrickRoom(events);
      didSomething = true;
    }
    if (move.substitute) didSomething = this.makeSubstitute(side, events) || didSomething;
    if (move.taunt) didSomething = this.taunt(defenderIndex, events) || didSomething;
    if (move.encore) didSomething = this.encore(defenderIndex, events) || didSomething;
    if (move.leechSeed) didSomething = this.seed(defenderIndex, events) || didSomething;

    if (!didSomething) {
      events.push({ kind: 'status', text: `${attackerSide.battler.name} used ${move.name}.` });
    }
  }

  /* ------------------------------------------------- field & volatile moves */

  private sideLabel(side: SideIndex): string {
    return side === 0 ? 'your side' : 'the foe';
  }

  private raiseScreen(side: SideIndex, kind: ScreenKind, events: BattleEvent[]): boolean {
    const screens = this.field.screens[side];
    if (!screenAllowed(kind, this.field.weather) || screens[kind] > 0) {
      events.push({ kind: 'status', text: 'But it failed!' });
      return false;
    }
    screens[kind] = SCREEN_TURNS;
    events.push({ kind: 'field', text: screenSetMessage(kind, this.sideLabel(side)) });
    return true;
  }

  private raiseTailwind(side: SideIndex, events: BattleEvent[]): boolean {
    if (this.field.tailwind[side] > 0) {
      events.push({ kind: 'status', text: 'But it failed!' });
      return false;
    }
    this.field.tailwind[side] = TAILWIND_TURNS;
    events.push({ kind: 'field', text: `A tailwind blew in behind ${this.sideLabel(side)}!` });
    return true;
  }

  private toggleTrickRoom(events: BattleEvent[]): void {
    if (this.field.trickRoom > 0) {
      this.field.trickRoom = 0;
      events.push({ kind: 'field', text: 'The twisted dimensions returned to normal!' });
    } else {
      this.field.trickRoom = TRICK_ROOM_TURNS;
      events.push({ kind: 'field', text: 'The dimensions were twisted — slowest moves first!' });
    }
  }

  private makeSubstitute(side: SideIndex, events: BattleEvent[]): boolean {
    const s = this.active(side);
    const cost = Math.max(1, Math.floor(s.maxHp / 4));
    if (s.volatiles.substitute > 0 || s.currentHp <= cost) {
      events.push({ kind: 'status', text: 'But it failed!' });
      return false;
    }
    s.currentHp -= cost;
    s.volatiles.substitute = cost;
    events.push({
      kind: 'damage',
      side,
      amount: cost,
      effectiveness: 1,
      crit: false,
      remainingHp: s.currentHp,
      maxHp: s.maxHp,
    });
    events.push({
      kind: 'substitute',
      side,
      up: true,
      text: `${s.battler.name} put in a substitute!`,
    });
    return true;
  }

  private taunt(side: SideIndex, events: BattleEvent[]): boolean {
    const s = this.active(side);
    if (s.volatiles.taunt > 0) {
      events.push({ kind: 'status', text: 'But it failed!' });
      return false;
    }
    s.volatiles.taunt = TAUNT_TURNS;
    events.push({ kind: 'status', text: `${s.battler.name} fell for the taunt!` });
    return true;
  }

  private encore(side: SideIndex, events: BattleEvent[]): boolean {
    const s = this.active(side);
    const last = s.volatiles.lastMove;
    if (last === null || s.volatiles.encore) {
      events.push({ kind: 'status', text: 'But it failed!' });
      return false;
    }
    s.volatiles.encore = { index: last, turns: ENCORE_TURNS };
    events.push({ kind: 'status', text: `${s.battler.name} must do an encore!` });
    return true;
  }

  private seed(side: SideIndex, events: BattleEvent[]): boolean {
    const s = this.active(side);
    if (s.volatiles.leechSeed || sideTypes(s).includes('grass')) {
      events.push({ kind: 'status', text: 'But it failed!' });
      return false;
    }
    s.volatiles.leechSeed = true;
    events.push({ kind: 'status', text: `${s.battler.name} was seeded!` });
    return true;
  }

  /** Confuse a side for 2–5 turns (fails when it already is or hides behind a Substitute). */
  confuse(side: SideIndex, events: BattleEvent[]): boolean {
    const s = this.active(side);
    if (s.volatiles.confusionTurns > 0 || s.volatiles.substitute > 0) return false;
    s.volatiles.confusionTurns = this.rng.int(2, 5);
    events.push({ kind: 'status', text: `${s.battler.name} became confused!` });
    return true;
  }

  /* ----------------------------------------------------------- end of turn */

  endOfTurn(events: BattleEvent[]): void {
    const field = this.field;

    for (const side of this.bySpeed()) {
      const s = this.active(side);
      if (s.currentHp <= 0 || this.host.finished()) continue;
      const ability = abilityById(s.battler.ability);
      const item = itemById(s.battler.item);
      const magicGuard = ability?.magicGuard === true;

      // Weather chip
      if (!magicGuard && takesWeatherChip(field.weather, sideTypes(s))) {
        const dmg = weatherChipDamage(field.weather, s.maxHp, sideTypes(s));
        this.indirectDamage(side, dmg, events, weatherChipMessage(s.battler.name, field.weather));
        if (this.host.afterResidual(side, events)) continue;
      }

      // Grassy Terrain heal
      const heal = terrainHeal(field.terrain, s.maxHp, battlerGrounded(s));
      if (heal > 0 && s.currentHp < s.maxHp) {
        this.heal(side, heal, events, `${s.battler.name} is healed by the terrain!`);
      }

      // Speed Boost
      if (ability?.speedBoost) {
        this.changeStage(side, 'speed', 1, events);
      }

      // Leftovers / Black Sludge
      if (item?.leftovers && s.currentHp < s.maxHp) {
        if (item.id === 'black-sludge' && !sideTypes(s).includes('poison')) {
          this.indirectDamage(
            side,
            Math.max(1, Math.floor(s.maxHp / 16)),
            events,
            `${s.battler.name} is hurt by the Black Sludge!`,
          );
          if (this.host.afterResidual(side, events)) continue;
        } else {
          this.heal(
            side,
            Math.max(1, Math.floor(s.maxHp * item.leftovers)),
            events,
            `${s.battler.name} restored a little HP!`,
          );
        }
      }

      // Status residual
      if (!magicGuard && (s.status === 'burn' || s.status === 'poison' || s.status === 'toxic')) {
        if (s.status === 'toxic') s.toxicCounter += 1;
        const dmg = residualDamage(s.status, s.maxHp, s.toxicCounter);
        this.indirectDamage(side, dmg, events, residualMessage(s.battler.name, s.status));
        if (this.host.afterResidual(side, events)) continue;
      }

      // Leech Seed drain
      if (s.volatiles.leechSeed && !magicGuard) {
        const dmg = Math.max(1, Math.floor(s.maxHp / 8));
        this.indirectDamage(
          side,
          dmg,
          events,
          `${s.battler.name}'s health is sapped by Leech Seed!`,
        );
        if (this.active(other(side)).currentHp > 0) this.heal(other(side), dmg, events, '');
        if (this.host.afterResidual(side, events)) continue;
      }

      // Orbs (self-inflict at end of first eligible turn)
      if (item?.selfStatus && s.status === 'none') {
        this.inflictStatus(side, item.selfStatus, events, true);
      }
      // Lum-style cure
      if (item?.curesStatus && s.status !== 'none' && !s.itemUsed) {
        const cures = item.curesStatus === 'all' || item.curesStatus === s.status;
        if (cures) {
          s.status = 'none';
          s.toxicCounter = 0;
          s.itemUsed = true;
          events.push({
            kind: 'cure',
            side,
            text: `${s.battler.name}'s ${item.name} cured its status!`,
          });
        }
      }
      // Sitrus pinch heal
      if (item?.pinchHeal && !s.itemUsed && s.currentHp > 0 && s.currentHp <= s.maxHp / 2) {
        s.itemUsed = true;
        this.heal(
          side,
          Math.floor(s.maxHp * item.pinchHeal),
          events,
          `${s.battler.name} restored HP with its Berry!`,
        );
      }
    }

    // Volatile countdowns (Taunt, Encore) for whoever is still standing
    for (const side of [0, 1] as const) {
      const v = this.active(side).volatiles;
      if (v.taunt > 0) {
        v.taunt -= 1;
        if (v.taunt === 0) {
          events.push({
            kind: 'status',
            text: `${this.active(side).battler.name} shook off the taunt!`,
          });
        }
      }
      if (v.encore && --v.encore.turns <= 0) {
        v.encore = null;
        events.push({ kind: 'status', text: `${this.active(side).battler.name}'s encore ended!` });
      }
    }

    // Side conditions: screens and Tailwind wear off, Trick Room ends
    for (const side of [0, 1] as const) {
      const screens = field.screens[side];
      for (const kind of Object.keys(screens) as ScreenKind[]) {
        if (screens[kind] > 0 && --screens[kind] === 0) {
          events.push({ kind: 'field', text: screenEndMessage(kind, this.sideLabel(side)) });
        }
      }
      if (field.tailwind[side] > 0 && --field.tailwind[side] === 0) {
        events.push({
          kind: 'field',
          text: `The tailwind behind ${this.sideLabel(side)} petered out.`,
        });
      }
    }
    if (field.trickRoom > 0 && --field.trickRoom === 0) {
      events.push({ kind: 'field', text: 'The twisted dimensions returned to normal!' });
    }

    // Field counters
    if (field.weatherTurns > 0) {
      field.weatherTurns -= 1;
      if (field.weatherTurns === 0 && field.weather !== 'none') {
        field.weather = 'none';
        events.push({ kind: 'weather', weather: 'none', text: 'The weather cleared up.' });
      }
    }
    if (field.terrainTurns > 0) {
      field.terrainTurns -= 1;
      if (field.terrainTurns === 0 && field.terrain !== 'none') {
        field.terrain = 'none';
        events.push({ kind: 'terrain', terrain: 'none', text: 'The terrain faded.' });
      }
    }
  }

  /* --------------------------------------------------------------- atoms */

  inflictStatus(
    side: SideIndex,
    status: StatusCondition,
    events: BattleEvent[],
    force = false,
  ): boolean {
    const s = this.active(side);
    const ability = abilityById(s.battler.ability);
    if (ability?.statusImmunity === 'all' || ability?.statusImmunity === status) return false;
    if (!force) {
      if (!canApplyStatus(status, sideTypes(s), s.status)) return false;
      if (terrainBlocksStatus(this.field.terrain, status, battlerGrounded(s))) return false;
    } else if (s.status !== 'none') {
      return false;
    }
    s.status = status;
    s.toxicCounter = 0;
    if (status === 'sleep') s.sleepTurns = rollSleepTurns((a, b) => this.rng.int(a, b));
    events.push({
      kind: 'status-set',
      side,
      status,
      text: statusSetMessage(s.battler.name, status),
    });
    return true;
  }

  applyMoveBoosts(
    side: SideIndex,
    boosts: Partial<Record<BoostableStat, number>>,
    events: BattleEvent[],
    fromFoe = false,
  ): boolean {
    let any = false;
    const s = this.active(side);
    for (const stat of Object.keys(boosts) as BoostableStat[]) {
      if (fromFoe && (boosts[stat] ?? 0) < 0 && this.blocksDrops(s, side, events)) continue;
      const before = s.stages[stat];
      s.stages = applyBoosts(s.stages, { [stat]: boosts[stat] });
      const delta = s.stages[stat] - before;
      if (delta !== 0) {
        any = true;
        events.push({
          kind: 'stage-change',
          side,
          stat,
          delta,
          text: stageChangeText(s.battler.name, stat, delta),
        });
      }
    }
    return any;
  }

  changeStage(
    side: SideIndex,
    stat: BoostableStat,
    delta: number,
    events: BattleEvent[],
    fromFoe = false,
  ): void {
    const s = this.active(side);
    if (fromFoe && delta < 0 && this.blocksDrops(s, side, events)) return;
    const before = s.stages[stat];
    s.stages = applyBoost(s.stages, stat, delta).stages;
    if (s.stages[stat] !== before) {
      events.push({
        kind: 'stage-change',
        side,
        stat,
        delta: s.stages[stat] - before,
        text: stageChangeText(s.battler.name, stat, s.stages[stat] - before),
      });
    }
  }

  /** Clear Body: a foe's stat drops bounce off (logged). */
  private blocksDrops(s: BattleSide, side: SideIndex, events: BattleEvent[]): boolean {
    const ability = abilityById(s.battler.ability);
    if (!ability?.clearBody) return false;
    events.push({
      kind: 'ability',
      side,
      ability: ability.id,
      text: `${s.battler.name}'s Clear Body prevents stat loss!`,
    });
    return true;
  }

  setWeather(weather: Weather, setter: BattleSide, events: BattleEvent[]): void {
    if (this.field.weather === weather) return;
    const item = itemById(setter.battler.item);
    this.field.weather = weather;
    this.field.weatherTurns = item?.weatherRock === weather ? 8 : 5;
    events.push({ kind: 'weather', weather, text: weatherSetMessage(weather) });
  }

  setTerrain(terrain: Terrain, events: BattleEvent[]): void {
    if (this.field.terrain === terrain) return;
    this.field.terrain = terrain;
    this.field.terrainTurns = 5;
    events.push({ kind: 'terrain', terrain, text: terrainSetMessage(terrain) });
  }

  layHazard(targetSide: SideIndex, kind: HazardKind, events: BattleEvent[]): void {
    const res = addHazard(this.field.hazards[targetSide], kind);
    this.field.hazards[targetSide] = res.state;
    if (res.added) {
      const label = targetSide === 0 ? 'your side' : 'the foe';
      events.push({
        kind: 'hazard',
        side: targetSide,
        hazard: kind,
        text: hazardSetMessage(kind, label),
      });
    }
  }

  heal(side: SideIndex, amount: number, events: BattleEvent[], text: string): void {
    const s = this.active(side);
    if (amount <= 0 || s.currentHp >= s.maxHp) return;
    s.currentHp = Math.min(s.maxHp, s.currentHp + amount);
    events.push({ kind: 'heal', side, amount, remainingHp: s.currentHp, maxHp: s.maxHp, text });
  }

  indirectDamage(side: SideIndex, amount: number, events: BattleEvent[], text: string): void {
    if (amount <= 0) return;
    const s = this.active(side);
    // Magic Guard blocks every kind of indirect damage (recoil, Rough Skin, Rocky Helmet, chip, hazards …)
    if (abilityById(s.battler.ability)?.magicGuard) return;
    s.currentHp = Math.max(0, s.currentHp - amount);
    events.push({
      kind: 'damage',
      side,
      amount,
      effectiveness: 1,
      crit: false,
      remainingHp: s.currentHp,
      maxHp: s.maxHp,
    });
    if (text) events.push({ kind: 'status', text });
    this.host.onIndirect?.(side, events);
  }
}
