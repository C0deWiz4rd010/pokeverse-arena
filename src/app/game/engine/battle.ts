/**
 * Seeded, turn-based single-battle engine (1-v-1).
 *
 * A `Battle` owns the mutable {@link BattleState} and a {@link SeededRng}; given
 * the same battlers, seed and move choices it always produces the same event log
 * — which makes replays and "daily challenges" trivial. The turn loop follows the
 * main-series structure: entry abilities → action ordering (priority, adjusted
 * speed, seeded tie-break) → move execution (status gates, accuracy, immunities,
 * the full {@link computeMoveDamage} pipeline, secondary effects, drain/recoil,
 * contact triggers) → end-of-turn residuals (weather, terrain, items, status).
 *
 * Pure damage maths live in {@link computeMoveDamage}; this class handles flow.
 */
import { SeededRng } from '../../core/utils/rng';
import {
  CRIT_CHANCE,
  MIN_ROLL,
  MAX_ROLL,
  computeMoveDamage,
  battlerGrounded,
} from './damage';
import { chooseAiMove, type AiTier } from './ai';
import type { BattleRules } from './rules';
import {
  applyBoost,
  applyBoosts,
  stageMultiplier,
  type BoostableStat,
} from './stat-stages';
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
import { abilityById } from './abilities';
import { itemById } from './items';
import {
  freshField,
  freshVolatiles,
  type Battler,
  type BattleEvent,
  type BattleMove,
  type BattleSide,
  type BattleState,
  type SideIndex,
} from './battle-types';
import { freshStages } from './stat-stages';

interface Action {
  side: SideIndex;
  moveIndex: number;
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

/** Critical-hit probability for an extra crit-stage count. */
function critChanceForStage(stage: number): number {
  const table = [CRIT_CHANCE, 1 / 8, 1 / 2, 1];
  return table[Math.max(0, Math.min(3, stage))];
}

export class Battle {
  readonly state: BattleState;
  private readonly rng: SeededRng;
  private readonly rules?: BattleRules;
  private readonly aiTier: AiTier;
  private started = false;

  constructor(
    player: Battler,
    opponent: Battler,
    seed: number | string = Date.now(),
    rules?: BattleRules,
    aiTier: AiTier = 'basic',
  ) {
    this.rng = new SeededRng(seed);
    this.rules = rules;
    this.aiTier = aiTier;
    this.state = {
      sides: [makeSide(player), makeSide(opponent)],
      field: freshField(),
      turn: 0,
      finished: false,
      winner: null,
    };
  }

  get player(): BattleSide {
    return this.state.sides[0];
  }

  get opponent(): BattleSide {
    return this.state.sides[1];
  }

  /** Choose the opponent's move automatically (used by the UI / auto-battle). */
  chooseAiMove(tier: AiTier = this.aiTier): number {
    return this.aiMoveFor(1, 0, tier);
  }

  /** Choose the player's best move automatically (used by headless simulation). */
  autoPlayerMove(tier: AiTier = this.aiTier): number {
    return this.aiMoveFor(0, 1, tier);
  }

  private aiMoveFor(attacker: SideIndex, defender: SideIndex, tier: AiTier): number {
    return chooseAiMove(
      {
        attacker: this.state.sides[attacker],
        defender: this.state.sides[defender],
        field: this.state.field,
        rng: this.rng,
        rules: this.rules,
      },
      tier,
    );
  }

  /**
   * Resolve a full turn: the player uses `playerMoveIndex`, the AI replies, and
   * both moves execute in priority/speed order, followed by end-of-turn
   * residuals. Returns the events produced.
   */
  takeTurn(playerMoveIndex: number, opponentMoveIndex = this.chooseAiMove()): BattleEvent[] {
    if (this.state.finished) return [];
    const events: BattleEvent[] = [];

    if (!this.started) {
      this.started = true;
      this.applyEntryAbilities(events);
    }

    this.state.turn += 1;
    events.push({ kind: 'turn', turn: this.state.turn });

    // Flinch only lasts until the holder's action this turn.
    this.player.volatiles.flinch = false;
    this.opponent.volatiles.flinch = false;

    const actions: Action[] = [
      { side: 0, moveIndex: playerMoveIndex },
      { side: 1, moveIndex: opponentMoveIndex },
    ];
    for (const action of this.orderActions(actions)) {
      if (this.state.finished) break;
      if (this.state.sides[action.side].currentHp <= 0) continue;
      this.executeMove(action, events);
    }

    if (!this.state.finished) this.endOfTurn(events);
    return events;
  }

  /* ----------------------------------------------------------- entry phase */

  private applyEntryAbilities(events: BattleEvent[]): void {
    for (const side of this.bySpeed()) {
      const s = this.state.sides[side];
      const ability = abilityById(s.battler.ability);
      if (!ability) continue;
      if (ability.weatherOnEntry) {
        this.setWeather(ability.weatherOnEntry, s, events);
      }
      if (ability.terrainOnEntry) {
        this.setTerrain(ability.terrainOnEntry, events);
      }
      if (ability.intimidate) {
        const foe = this.state.sides[other(side)];
        this.changeStage(other(side), 'attack', -ability.intimidate, events, foe);
        events.push({ kind: 'ability', side, ability: ability.id, text: `${s.battler.name}'s Intimidate cut the foe's Attack!` });
      }
    }
  }

  /* -------------------------------------------------------- turn internals */

  private orderActions(actions: Action[]): Action[] {
    return [...actions].sort((a, b) => {
      const pa = this.moveOf(a).priority ?? 0;
      const pb = this.moveOf(b).priority ?? 0;
      if (pa !== pb) return pb - pa;
      const sa = this.effectiveSpeed(a.side);
      const sb = this.effectiveSpeed(b.side);
      if (sa !== sb) return sb - sa;
      return this.rng.next() < 0.5 ? -1 : 1;
    });
  }

  /** Speed after paralysis, Choice Scarf, weather-speed abilities and stages. */
  private effectiveSpeed(side: SideIndex): number {
    const s = this.state.sides[side];
    let spe = s.battler.stats.speed * stageMultiplier('speed', s.stages.speed);
    spe *= paralysisSpeedFactor(s.status);
    const item = itemById(s.battler.item);
    if (item?.statMultiplier?.stat === 'speed') spe *= item.statMultiplier.factor;
    const ability = abilityById(s.battler.ability);
    if (ability?.weatherSpeed && ability.weatherSpeed === this.state.field.weather) spe *= 2;
    return spe;
  }

  private executeMove(action: Action, events: BattleEvent[]): void {
    const side = action.side;
    const attackerSide = this.state.sides[side];
    const defenderIndex = other(side);
    const defenderSide = this.state.sides[defenderIndex];
    const move = attackerSide.battler.moves[action.moveIndex];

    // --- Pre-move gates -----------------------------------------------------
    if (attackerSide.volatiles.flinch) {
      events.push({ kind: 'flinch', side, text: `${attackerSide.battler.name} flinched!` });
      return;
    }
    const gate = resolveMoveGate(attackerSide.battler.name, attackerSide.status, attackerSide.sleepTurns, this.rng.next());
    attackerSide.status = gate.status;
    attackerSide.sleepTurns = gate.sleepTurns;
    if (gate.message && (gate.status === 'none' || !gate.canMove)) {
      if (gate.status === 'none') events.push({ kind: 'cure', side, text: gate.message });
      else events.push({ kind: 'status', text: gate.message });
    }
    if (!gate.canMove) return;

    if (move.pp !== undefined && Number.isFinite(attackerSide.pp[action.moveIndex])) {
      attackerSide.pp[action.moveIndex] = Math.max(0, attackerSide.pp[action.moveIndex] - 1);
    }

    events.push({ kind: 'move', side, attacker: attackerSide.battler.name, move: move.name });

    // --- Status / non-damaging moves ---------------------------------------
    if (move.power <= 0 || move.damageClass === 'status') {
      if (move.accuracy > 0 && this.rng.next() * 100 >= move.accuracy) {
        events.push({ kind: 'miss', side, attacker: attackerSide.battler.name, move: move.name });
        return;
      }
      this.applyStatusMove(side, defenderIndex, move, events);
      return;
    }

    // --- Psychic Terrain blocks increased-priority moves vs grounded --------
    if (terrainBlocksPriority(this.state.field.terrain, move.priority ?? 0, battlerGrounded(defenderSide))) {
      events.push({ kind: 'status', text: `${defenderSide.battler.name} is protected by the terrain!` });
      return;
    }

    // --- Accuracy -----------------------------------------------------------
    if (move.accuracy > 0) {
      const acc =
        move.accuracy *
        stageMultiplier('accuracy', attackerSide.stages.accuracy) /
        stageMultiplier('evasion', defenderSide.stages.evasion);
      if (this.rng.next() * 100 >= acc) {
        events.push({ kind: 'miss', side, attacker: attackerSide.battler.name, move: move.name });
        return;
      }
    }

    // --- Defender ability immunities (absorb) ------------------------------
    if (this.tryAbsorb(side, defenderIndex, move, events)) return;

    // --- Damage (with multi-hit) -------------------------------------------
    const hits = move.multiHit ? this.rng.int(move.multiHit[0], move.multiHit[1]) : 1;
    let totalDamage = 0;
    let connected = false;
    for (let h = 0; h < hits; h++) {
      if (defenderSide.currentHp <= 0) break;
      const crit = this.rng.chance(critChanceForStage(move.critStage ?? 0));
      const roll = MIN_ROLL + this.rng.next() * (MAX_ROLL - MIN_ROLL);
      const result = computeMoveDamage({
        attacker: attackerSide,
        defender: defenderSide,
        field: this.state.field,
        move,
        crit,
        roll,
        rules: this.rules,
        flashFire: attackerSide.volatiles.flashFire,
      });

      let dealt = result.damage;
      // Sturdy / Focus Sash: survive a full-HP OHKO at 1 HP.
      if (dealt >= defenderSide.currentHp && defenderSide.currentHp === defenderSide.maxHp) {
        const defAbility = abilityById(defenderSide.battler.ability);
        const defItem = itemById(defenderSide.battler.item);
        if (defAbility?.sturdy) {
          dealt = defenderSide.maxHp - 1;
          events.push({ kind: 'ability', side: defenderIndex, ability: defAbility.id, text: `${defenderSide.battler.name} endured the hit with Sturdy!` });
        } else if (defItem?.focusSash && !defenderSide.itemUsed) {
          dealt = defenderSide.maxHp - 1;
          defenderSide.itemUsed = true;
          events.push({ kind: 'item', side: defenderIndex, item: defItem.id, text: `${defenderSide.battler.name} hung on with its Focus Sash!` });
        }
      }

      defenderSide.currentHp = Math.max(0, defenderSide.currentHp - dealt);
      totalDamage += dealt;
      connected = true;
      events.push({
        kind: 'damage',
        side: defenderIndex,
        amount: dealt,
        effectiveness: result.effectiveness,
        crit: result.crit,
        remainingHp: defenderSide.currentHp,
        maxHp: defenderSide.maxHp,
      });

      this.applyContactEffects(side, defenderIndex, move, events);
      if (defenderSide.currentHp <= 0 || attackerSide.currentHp <= 0) break;
    }

    if (!connected) return;

    // --- Drain / recoil / Life Orb -----------------------------------------
    if (move.drain && totalDamage > 0) {
      this.heal(side, Math.max(1, Math.floor(totalDamage * move.drain)), events, `${attackerSide.battler.name} drained energy!`);
    }
    if (move.recoil && totalDamage > 0) {
      this.indirectDamage(side, Math.max(1, Math.floor(totalDamage * move.recoil)), events, `${attackerSide.battler.name} is hit with recoil!`);
    }
    const atkItem = itemById(attackerSide.battler.item);
    const atkAbility = abilityById(attackerSide.battler.ability);
    if (atkItem?.recoil && totalDamage > 0 && !atkAbility?.magicGuard && attackerSide.currentHp > 0) {
      this.indirectDamage(side, Math.max(1, Math.floor(attackerSide.maxHp * atkItem.recoil)), events, `${attackerSide.battler.name} is hurt by its Life Orb!`);
    }

    // --- Secondary effect ---------------------------------------------------
    if (move.secondary && totalDamage > 0 && defenderSide.currentHp > 0 && this.rng.next() * 100 < move.secondary.chance) {
      this.applySecondary(side, defenderIndex, move, events);
    }

    this.checkFaint(defenderIndex, side, events);
    this.checkFaint(side, defenderIndex, events);
  }

  /* ----------------------------------------------------- move sub-routines */

  private tryAbsorb(side: SideIndex, defenderIndex: SideIndex, move: BattleMove, events: BattleEvent[]): boolean {
    const defenderSide = this.state.sides[defenderIndex];
    const ability = abilityById(defenderSide.battler.ability);
    if (!ability?.absorb || ability.absorb.type !== move.type) return false;
    const { effect } = ability.absorb;
    if (effect === 'flash-fire') {
      defenderSide.volatiles.flashFire = true;
      events.push({ kind: 'ability', side: defenderIndex, ability: ability.id, text: `${defenderSide.battler.name}'s Flash Fire raised its power!` });
    } else if (effect === 'heal25') {
      this.heal(defenderIndex, Math.floor(defenderSide.maxHp / 4), events, `${defenderSide.battler.name}'s ${ability.name} restored HP!`);
    } else {
      events.push({ kind: 'ability', side: defenderIndex, ability: ability.id, text: `${defenderSide.battler.name} avoids it with ${ability.name}!` });
    }
    return true;
  }

  private applyContactEffects(side: SideIndex, defenderIndex: SideIndex, move: BattleMove, events: BattleEvent[]): void {
    if (!move.flags?.contact) return;
    const attackerSide = this.state.sides[side];
    const defenderSide = this.state.sides[defenderIndex];
    if (attackerSide.currentHp <= 0) return;
    const defAbility = abilityById(defenderSide.battler.ability);
    const defItem = itemById(defenderSide.battler.item);

    if (defAbility?.contactStatus && this.rng.next() * 100 < defAbility.contactStatus.chance) {
      this.inflictStatus(side, defAbility.contactStatus.status, events);
    }
    if (defAbility?.roughSkin) {
      this.indirectDamage(side, Math.max(1, Math.floor(attackerSide.maxHp * defAbility.roughSkin)), events, `${attackerSide.battler.name} was hurt by Rough Skin!`);
    }
    if (defItem?.rockyHelmet && attackerSide.currentHp > 0) {
      this.indirectDamage(side, Math.max(1, Math.floor(attackerSide.maxHp * defItem.rockyHelmet)), events, `${attackerSide.battler.name} was hurt by the Rocky Helmet!`);
    }
  }

  private applySecondary(side: SideIndex, defenderIndex: SideIndex, move: BattleMove, events: BattleEvent[]): void {
    const sec = move.secondary!;
    if (sec.status) this.inflictStatus(defenderIndex, sec.status, events);
    if (sec.boosts) {
      const target = sec.boostTarget === 'self' ? side : defenderIndex;
      this.applyMoveBoosts(target, sec.boosts, events);
    }
    if (sec.flinch) {
      // Only meaningful if the target has not yet acted this turn.
      this.state.sides[defenderIndex].volatiles.flinch = true;
    }
  }

  private applyStatusMove(side: SideIndex, defenderIndex: SideIndex, move: BattleMove, events: BattleEvent[]): void {
    const attackerSide = this.state.sides[side];
    let didSomething = false;

    if (move.boosts) {
      const target = move.target === 'opponent' ? defenderIndex : side;
      didSomething = this.applyMoveBoosts(target, move.boosts, events) || didSomething;
    }
    if (move.inflictStatus) {
      didSomething = this.inflictStatus(defenderIndex, move.inflictStatus, events) || didSomething;
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
      this.heal(side, Math.floor(attackerSide.maxHp * move.healing), events, `${attackerSide.battler.name} regained health!`);
      didSomething = attackerSide.currentHp !== before || didSomething;
    }

    if (!didSomething) {
      events.push({ kind: 'status', text: `${attackerSide.battler.name} used ${move.name}.` });
    }
  }

  /* ----------------------------------------------------------- end of turn */

  private endOfTurn(events: BattleEvent[]): void {
    const field = this.state.field;

    for (const side of this.bySpeed()) {
      const s = this.state.sides[side];
      if (s.currentHp <= 0 || this.state.finished) continue;
      const ability = abilityById(s.battler.ability);
      const item = itemById(s.battler.item);
      const magicGuard = ability?.magicGuard === true;

      // Weather chip
      if (!magicGuard && takesWeatherChip(field.weather, s.battler.types)) {
        const dmg = weatherChipDamage(field.weather, s.maxHp, s.battler.types);
        this.indirectDamage(side, dmg, events, weatherChipMessage(s.battler.name, field.weather));
        if (this.afterResidual(side, events)) continue;
      }

      // Grassy Terrain heal
      const heal = terrainHeal(field.terrain, s.maxHp, battlerGrounded(s));
      if (heal > 0 && s.currentHp < s.maxHp) {
        this.heal(side, heal, events, `${s.battler.name} is healed by the terrain!`);
      }

      // Speed Boost
      if (ability?.speedBoost) {
        this.changeStage(side, 'speed', 1, events, s);
      }

      // Leftovers / Black Sludge
      if (item?.leftovers && s.currentHp < s.maxHp) {
        if (item.id === 'black-sludge' && !s.battler.types.includes('poison')) {
          this.indirectDamage(side, Math.max(1, Math.floor(s.maxHp / 16)), events, `${s.battler.name} is hurt by the Black Sludge!`);
          if (this.afterResidual(side, events)) continue;
        } else {
          this.heal(side, Math.max(1, Math.floor(s.maxHp * item.leftovers)), events, `${s.battler.name} restored a little HP!`);
        }
      }

      // Status residual
      if (!magicGuard && (s.status === 'burn' || s.status === 'poison' || s.status === 'toxic')) {
        if (s.status === 'toxic') s.toxicCounter += 1;
        const dmg = residualDamage(s.status, s.maxHp, s.toxicCounter);
        this.indirectDamage(side, dmg, events, residualMessage(s.battler.name, s.status));
        if (this.afterResidual(side, events)) continue;
      }

      // Leech Seed drain
      if (s.volatiles.leechSeed && !magicGuard) {
        const dmg = Math.max(1, Math.floor(s.maxHp / 8));
        this.indirectDamage(side, dmg, events, `${s.battler.name}'s health is sapped by Leech Seed!`);
        if (this.state.sides[other(side)].currentHp > 0) this.heal(other(side), dmg, events, '');
        if (this.afterResidual(side, events)) continue;
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
          events.push({ kind: 'cure', side, text: `${s.battler.name}'s ${item.name} cured its status!` });
        }
      }
      // Sitrus pinch heal
      if (item?.pinchHeal && !s.itemUsed && s.currentHp > 0 && s.currentHp <= s.maxHp / 2) {
        s.itemUsed = true;
        this.heal(side, Math.floor(s.maxHp * item.pinchHeal), events, `${s.battler.name} restored HP with its Berry!`);
      }
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

  /** After residual damage: emit faint / end if the side dropped. Returns true if it fainted. */
  private afterResidual(side: SideIndex, events: BattleEvent[]): boolean {
    if (this.state.sides[side].currentHp <= 0) {
      this.checkFaint(side, other(side), events);
      return true;
    }
    return false;
  }

  /* --------------------------------------------------------------- helpers */

  private inflictStatus(side: SideIndex, status: StatusCondition, events: BattleEvent[], force = false): boolean {
    const s = this.state.sides[side];
    const ability = abilityById(s.battler.ability);
    if (ability?.statusImmunity === 'all' || ability?.statusImmunity === status) return false;
    if (!force) {
      if (!canApplyStatus(status, s.battler.types, s.status)) return false;
      if (terrainBlocksStatus(this.state.field.terrain, status, battlerGrounded(s))) return false;
    } else if (s.status !== 'none') {
      return false;
    }
    s.status = status;
    s.toxicCounter = 0;
    if (status === 'sleep') s.sleepTurns = rollSleepTurns((a, b) => this.rng.int(a, b));
    events.push({ kind: 'status-set', side, status, text: statusSetMessage(s.battler.name, status) });
    return true;
  }

  private applyMoveBoosts(side: SideIndex, boosts: Partial<Record<BoostableStat, number>>, events: BattleEvent[]): boolean {
    let any = false;
    const s = this.state.sides[side];
    for (const stat of Object.keys(boosts) as BoostableStat[]) {
      const before = s.stages[stat];
      s.stages = applyBoosts(s.stages, { [stat]: boosts[stat] });
      const delta = s.stages[stat] - before;
      if (delta !== 0) {
        any = true;
        events.push({ kind: 'stage-change', side, stat, delta, text: stageChangeText(s.battler.name, stat, delta) });
      }
    }
    return any;
  }

  private changeStage(side: SideIndex, stat: BoostableStat, delta: number, events: BattleEvent[], s: BattleSide): void {
    const before = s.stages[stat];
    const res = applyBoost(s.stages, stat, delta);
    s.stages = res.stages;
    if (s.stages[stat] !== before) {
      events.push({ kind: 'stage-change', side, stat, delta: s.stages[stat] - before, text: stageChangeText(s.battler.name, stat, s.stages[stat] - before) });
    }
  }

  private setWeather(weather: Weather, setter: BattleSide, events: BattleEvent[]): void {
    if (this.state.field.weather === weather) return;
    const item = itemById(setter.battler.item);
    const turns = item?.weatherRock === weather ? 8 : 5;
    this.state.field.weather = weather;
    this.state.field.weatherTurns = turns;
    events.push({ kind: 'weather', weather, text: weatherSetMessage(weather) });
  }

  private setTerrain(terrain: Terrain, events: BattleEvent[]): void {
    if (this.state.field.terrain === terrain) return;
    this.state.field.terrain = terrain;
    this.state.field.terrainTurns = 5;
    events.push({ kind: 'terrain', terrain, text: terrainSetMessage(terrain) });
  }

  private layHazard(targetSide: SideIndex, kind: HazardKind, events: BattleEvent[]): void {
    const res = addHazard(this.state.field.hazards[targetSide], kind);
    this.state.field.hazards[targetSide] = res.state;
    if (res.added) {
      const label = targetSide === 0 ? 'your side' : 'the foe';
      events.push({ kind: 'hazard', side: targetSide, hazard: kind, text: hazardSetMessage(kind, label) });
    }
  }

  private heal(side: SideIndex, amount: number, events: BattleEvent[], text: string): void {
    const s = this.state.sides[side];
    if (amount <= 0 || s.currentHp >= s.maxHp) return;
    s.currentHp = Math.min(s.maxHp, s.currentHp + amount);
    events.push({ kind: 'heal', side, amount, remainingHp: s.currentHp, maxHp: s.maxHp, text });
  }

  private indirectDamage(side: SideIndex, amount: number, events: BattleEvent[], text: string): void {
    if (amount <= 0) return;
    const s = this.state.sides[side];
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
  }

  private checkFaint(faintedSide: SideIndex, winnerSide: SideIndex, events: BattleEvent[]): void {
    if (this.state.finished) return;
    if (this.state.sides[faintedSide].currentHp > 0) return;
    events.push({ kind: 'faint', side: faintedSide, name: this.state.sides[faintedSide].battler.name });
    this.state.finished = true;
    this.state.winner = winnerSide;
    events.push({ kind: 'end', winner: winnerSide, loser: faintedSide });
  }

  private bySpeed(): SideIndex[] {
    return this.effectiveSpeed(0) >= this.effectiveSpeed(1) ? [0, 1] : [1, 0];
  }

  private moveOf(action: Action): BattleMove {
    return this.state.sides[action.side].battler.moves[action.moveIndex];
  }
}

function stageChangeText(name: string, stat: BoostableStat, delta: number): string {
  const label = STAT_LABEL[stat];
  if (delta >= 2) return `${name}'s ${label} rose sharply!`;
  if (delta === 1) return `${name}'s ${label} rose!`;
  if (delta === -1) return `${name}'s ${label} fell!`;
  return `${name}'s ${label} harshly fell!`;
}

function other(side: SideIndex): SideIndex {
  return side === 0 ? 1 : 0;
}

function makeSide(battler: Battler): BattleSide {
  const maxHp = battler.stats.hp;
  return {
    battler,
    currentHp: maxHp,
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
