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
import { CRIT_CHANCE, MIN_ROLL, MAX_ROLL, computeMoveDamage, battlerGrounded } from './damage';
import { chooseAiMove, estimateDamage, type AiTier } from './ai';
import type { BattleRules } from './rules';
import {
  applyBoost,
  applyBoosts,
  freshStages,
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
import { addHazard, hazardSetMessage, resolveSwitchInHazards, type HazardKind } from './hazards';
import { abilityById } from './abilities';
import { itemById } from './items';
import { effectiveness } from '../../core/utils/type-chart';
import {
  freshField,
  freshVolatiles,
  type Battler,
  type BattleEvent,
  type BattleMove,
  type BattleSide,
  type Field,
  type SideIndex,
} from './battle-types';

export type TeamAction = { type: 'move'; index: number } | { type: 'switch'; to: number };

function critChanceForStage(stage: number): number {
  return [CRIT_CHANCE, 1 / 8, 1 / 2, 1][Math.max(0, Math.min(3, stage))];
}

function other(side: SideIndex): SideIndex {
  return side === 0 ? 1 : 0;
}

function makeSide(battler: Battler, startHp?: number): BattleSide {
  const maxHp = battler.stats.hp;
  const hp = startHp === undefined || !Number.isFinite(startHp) ? maxHp : Math.max(0, Math.min(startHp, maxHp));
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
}

export class TeamBattle {
  readonly state: TeamBattleState;
  private readonly rng: SeededRng;
  private readonly rules?: BattleRules;
  private readonly aiTier: AiTier;
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
      /** A persistent battlefield condition active from the first turn (gym fields). */
      field?: { weather?: Weather; terrain?: Terrain };
    } = {},
  ) {
    this.rng = new SeededRng(seed);
    this.rules = opts.rules;
    this.aiTier = opts.aiTier ?? 'strong';
    const a = teamA.map((m, i) => makeSide(m, opts.startHpA?.[i]));
    const b = teamB.map((m, i) => makeSide(m, opts.startHpB?.[i]));
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
    };
  }

  active(side: SideIndex): BattleSide {
    return this.state.parties[side][this.state.active[side]];
  }

  /** Indices of benched, non-fainted Pokémon a side could switch to. */
  benchedSwitches(side: SideIndex): number[] {
    return this.state.parties[side]
      .map((s, i) => i)
      .filter((i) => i !== this.state.active[side] && this.state.parties[side][i].currentHp > 0);
  }

  /** A side must switch when its active Pokémon has fainted but the team lives. */
  mustSwitch(side: SideIndex): boolean {
    return this.active(side).currentHp <= 0 && this.benchedSwitches(side).length > 0;
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
      { attacker: this.active(side), defender: this.active(other(side)), field: this.state.field, rng: this.rng, rules: this.rules },
      this.aiTier,
    );
  }

  private canKo(side: SideIndex): boolean {
    const me = this.active(side);
    const foe = this.active(other(side));
    return me.battler.moves.some(
      (mv) => estimateDamage(mv, { attacker: me, defender: foe, field: this.state.field, rng: this.rng, rules: this.rules }) >= foe.currentHp,
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
      const worst = Math.max(...foe.battler.types.map((t) => effectiveness(t, cand.battler.types)));
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
    this.switchIn(side, to, events, false);
    return events;
  }

  /** Auto-resolve a forced switch with the AI's best pick. */
  autoForceSwitch(side: SideIndex): BattleEvent[] {
    const options = this.benchedSwitches(side);
    const pick = this.bestSwitch(side) ?? options[0];
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

    this.active(0).volatiles.flinch = false;
    this.active(1).volatiles.flinch = false;

    const actions: [TeamAction, TeamAction] = [actionA, actionB];

    // 1) Switches resolve first (slower side switches first matters little; use speed).
    for (const side of this.bySpeed()) {
      const act = actions[side];
      if (act.type === 'switch') this.switchIn(side, act.to, events, true);
    }

    // 2) Moves, in priority/speed order.
    const movers = ([0, 1] as SideIndex[]).filter((s) => actions[s].type === 'move');
    movers.sort((a, b) => {
      const pa = this.moveOf(a, actions[a]).priority ?? 0;
      const pb = this.moveOf(b, actions[b]).priority ?? 0;
      if (pa !== pb) return pb - pa;
      const sa = this.effectiveSpeed(a);
      const sb = this.effectiveSpeed(b);
      if (sa !== sb) return sb - sa;
      return this.rng.next() < 0.5 ? -1 : 1;
    });
    for (const side of movers) {
      if (this.state.finished) break;
      if (this.active(side).currentHp <= 0) continue;
      this.executeMove(side, (actions[side] as { type: 'move'; index: number }).index, events);
    }

    if (!this.state.finished) this.endOfTurn(events);
    this.resolveFaints(events);
    return events;
  }

  /* ----------------------------------------------------------- switching */

  private switchIn(side: SideIndex, to: number, events: BattleEvent[], voluntary: boolean): void {
    const party = this.state.parties[side];
    if (to < 0 || to >= party.length || party[to].currentHp <= 0 || to === this.state.active[side]) return;

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
    events.push({ kind: 'switch', side, name: incoming.battler.name, text: `${incoming.battler.name} was sent out!` });

    this.applySwitchInHazards(side, events);
    if (incoming.currentHp > 0) this.fireEntryAbility(side, events);
  }

  private applySwitchInHazards(side: SideIndex, events: BattleEvent[]): void {
    const incoming = this.active(side);
    const grounded = battlerGrounded(incoming);
    const hz = this.state.field.hazards[side];
    if (hz['stealth-rock'] === 0 && hz.spikes === 0 && hz['toxic-spikes'] === 0) return;
    if (!grounded && hz['stealth-rock'] === 0) return; // only Stealth Rock hits non-grounded
    const res = resolveSwitchInHazards(hz, incoming.battler.name, incoming.battler.types, incoming.maxHp);
    if (res.clearsToxicSpikes) this.state.field.hazards[side] = { ...hz, 'toxic-spikes': 0 };
    for (const msg of res.messages) events.push({ kind: 'status', text: msg });
    if (res.damage > 0) {
      incoming.currentHp = Math.max(0, incoming.currentHp - res.damage);
      events.push({ kind: 'damage', side, amount: res.damage, effectiveness: 1, crit: false, remainingHp: incoming.currentHp, maxHp: incoming.maxHp });
    }
    if (res.status !== 'none' && incoming.currentHp > 0) this.inflictStatus(side, res.status, events);
  }

  private applyEntryAbilities(events: BattleEvent[]): void {
    for (const side of this.bySpeed()) this.fireEntryAbility(side, events);
  }

  private fireEntryAbility(side: SideIndex, events: BattleEvent[]): void {
    const s = this.active(side);
    const ability = abilityById(s.battler.ability);
    if (!ability) return;
    if (ability.weatherOnEntry) this.setWeather(ability.weatherOnEntry, s, events);
    if (ability.terrainOnEntry) this.setTerrain(ability.terrainOnEntry, events);
    if (ability.intimidate) {
      this.changeStage(other(side), 'attack', -ability.intimidate, events);
      events.push({ kind: 'ability', side, ability: ability.id, text: `${s.battler.name}'s Intimidate cut the foe's Attack!` });
    }
  }

  /* --------------------------------------------------------- move engine */

  private executeMove(side: SideIndex, moveIndex: number, events: BattleEvent[]): void {
    const attacker = this.active(side);
    const defenderIndex = other(side);
    const defender = this.active(defenderIndex);
    const move = attacker.battler.moves[moveIndex];

    if (attacker.volatiles.flinch) {
      events.push({ kind: 'flinch', side, text: `${attacker.battler.name} flinched!` });
      return;
    }
    const gate = resolveMoveGate(attacker.battler.name, attacker.status, attacker.sleepTurns, this.rng.next());
    attacker.status = gate.status;
    attacker.sleepTurns = gate.sleepTurns;
    if (gate.message) {
      if (gate.status === 'none') events.push({ kind: 'cure', side, text: gate.message });
      else if (!gate.canMove) events.push({ kind: 'status', text: gate.message });
    }
    if (!gate.canMove) return;

    if (move.pp !== undefined && Number.isFinite(attacker.pp[moveIndex])) {
      attacker.pp[moveIndex] = Math.max(0, attacker.pp[moveIndex] - 1);
    }
    events.push({ kind: 'move', side, attacker: attacker.battler.name, move: move.name });

    if (move.power <= 0 || move.damageClass === 'status') {
      if (move.accuracy > 0 && this.rng.next() * 100 >= move.accuracy) {
        events.push({ kind: 'miss', side, attacker: attacker.battler.name, move: move.name });
        return;
      }
      this.applyStatusMove(side, defenderIndex, move, events);
      return;
    }

    if (terrainBlocksPriority(this.state.field.terrain, move.priority ?? 0, battlerGrounded(defender))) {
      events.push({ kind: 'status', text: `${defender.battler.name} is protected by the terrain!` });
      return;
    }

    if (move.accuracy > 0) {
      const acc = move.accuracy * stageMultiplier('accuracy', attacker.stages.accuracy) / stageMultiplier('evasion', defender.stages.evasion);
      if (this.rng.next() * 100 >= acc) {
        events.push({ kind: 'miss', side, attacker: attacker.battler.name, move: move.name });
        return;
      }
    }

    if (this.tryAbsorb(defenderIndex, move, events)) return;

    const hits = move.multiHit ? this.rng.int(move.multiHit[0], move.multiHit[1]) : 1;
    let total = 0;
    let connected = false;
    for (let h = 0; h < hits; h++) {
      if (defender.currentHp <= 0) break;
      const crit = this.rng.chance(critChanceForStage(move.critStage ?? 0));
      const roll = MIN_ROLL + this.rng.next() * (MAX_ROLL - MIN_ROLL);
      const result = computeMoveDamage({ attacker, defender, field: this.state.field, move, crit, roll, rules: this.rules, flashFire: attacker.volatiles.flashFire });
      let dealt = result.damage;
      if (dealt >= defender.currentHp && defender.currentHp === defender.maxHp) {
        const defAbility = abilityById(defender.battler.ability);
        const defItem = itemById(defender.battler.item);
        if (defAbility?.sturdy) {
          dealt = defender.maxHp - 1;
          events.push({ kind: 'ability', side: defenderIndex, ability: defAbility.id, text: `${defender.battler.name} endured with Sturdy!` });
        } else if (defItem?.focusSash && !defender.itemUsed) {
          dealt = defender.maxHp - 1;
          defender.itemUsed = true;
          events.push({ kind: 'item', side: defenderIndex, item: defItem.id, text: `${defender.battler.name} hung on with its Focus Sash!` });
        }
      }
      defender.currentHp = Math.max(0, defender.currentHp - dealt);
      total += dealt;
      connected = true;
      events.push({ kind: 'damage', side: defenderIndex, amount: dealt, effectiveness: result.effectiveness, crit: result.crit, remainingHp: defender.currentHp, maxHp: defender.maxHp });
      this.applyContactEffects(side, defenderIndex, move, events);
      if (defender.currentHp <= 0 || attacker.currentHp <= 0) break;
    }
    if (defender.currentHp <= 0) {
      events.push({ kind: 'faint', side: defenderIndex, name: defender.battler.name });
    }
    if (!connected) return;

    if (move.drain && total > 0) this.heal(side, Math.max(1, Math.floor(total * move.drain)), events, `${attacker.battler.name} drained energy!`);
    if (move.recoil && total > 0) this.indirectDamage(side, Math.max(1, Math.floor(total * move.recoil)), events, `${attacker.battler.name} is hit with recoil!`);
    const atkItem = itemById(attacker.battler.item);
    const atkAbility = abilityById(attacker.battler.ability);
    if (atkItem?.recoil && total > 0 && !atkAbility?.magicGuard && attacker.currentHp > 0) {
      this.indirectDamage(side, Math.max(1, Math.floor(attacker.maxHp * atkItem.recoil)), events, `${attacker.battler.name} is hurt by its Life Orb!`);
    }
    if (move.secondary && total > 0 && defender.currentHp > 0 && this.rng.next() * 100 < move.secondary.chance) {
      if (move.secondary.status) this.inflictStatus(defenderIndex, move.secondary.status, events);
      if (move.secondary.boosts) this.applyMoveBoosts(move.secondary.boostTarget === 'self' ? side : defenderIndex, move.secondary.boosts, events);
      if (move.secondary.flinch) defender.volatiles.flinch = true;
    }
  }

  private tryAbsorb(defenderIndex: SideIndex, move: BattleMove, events: BattleEvent[]): boolean {
    const defender = this.active(defenderIndex);
    const ability = abilityById(defender.battler.ability);
    if (!ability?.absorb || ability.absorb.type !== move.type) return false;
    if (ability.absorb.effect === 'flash-fire') {
      defender.volatiles.flashFire = true;
      events.push({ kind: 'ability', side: defenderIndex, ability: ability.id, text: `${defender.battler.name}'s Flash Fire activated!` });
    } else if (ability.absorb.effect === 'heal25') {
      this.heal(defenderIndex, Math.floor(defender.maxHp / 4), events, `${defender.battler.name}'s ${ability.name} restored HP!`);
    } else {
      events.push({ kind: 'ability', side: defenderIndex, ability: ability.id, text: `${defender.battler.name} avoids it with ${ability.name}!` });
    }
    return true;
  }

  private applyContactEffects(side: SideIndex, defenderIndex: SideIndex, move: BattleMove, events: BattleEvent[]): void {
    if (!move.flags?.contact) return;
    const attacker = this.active(side);
    const defender = this.active(defenderIndex);
    if (attacker.currentHp <= 0) return;
    const defAbility = abilityById(defender.battler.ability);
    const defItem = itemById(defender.battler.item);
    if (defAbility?.contactStatus && this.rng.next() * 100 < defAbility.contactStatus.chance) {
      this.inflictStatus(side, defAbility.contactStatus.status, events);
    }
    if (defAbility?.roughSkin) this.indirectDamage(side, Math.max(1, Math.floor(attacker.maxHp * defAbility.roughSkin)), events, `${attacker.battler.name} was hurt by Rough Skin!`);
    if (defItem?.rockyHelmet && attacker.currentHp > 0) this.indirectDamage(side, Math.max(1, Math.floor(attacker.maxHp * defItem.rockyHelmet)), events, `${attacker.battler.name} was hurt by the Rocky Helmet!`);
  }

  private applyStatusMove(side: SideIndex, defenderIndex: SideIndex, move: BattleMove, events: BattleEvent[]): void {
    const attacker = this.active(side);
    let did = false;
    if (move.boosts) did = this.applyMoveBoosts(move.target === 'opponent' ? defenderIndex : side, move.boosts, events) || did;
    if (move.inflictStatus) did = this.inflictStatus(defenderIndex, move.inflictStatus, events) || did;
    if (move.setsWeather) { this.setWeather(move.setsWeather, attacker, events); did = true; }
    if (move.setsTerrain) { this.setTerrain(move.setsTerrain, events); did = true; }
    if (move.setsHazard) { this.layHazard(defenderIndex, move.setsHazard, events); did = true; }
    if (move.healing) { const b = attacker.currentHp; this.heal(side, Math.floor(attacker.maxHp * move.healing), events, `${attacker.battler.name} regained health!`); did = attacker.currentHp !== b || did; }
    if (!did) events.push({ kind: 'status', text: `${attacker.battler.name} used ${move.name}.` });
  }

  /* ------------------------------------------------------------ residuals */

  private endOfTurn(events: BattleEvent[]): void {
    const field = this.state.field;
    for (const side of this.bySpeed()) {
      const s = this.active(side);
      if (s.currentHp <= 0) continue;
      const ability = abilityById(s.battler.ability);
      const item = itemById(s.battler.item);
      const magicGuard = ability?.magicGuard === true;

      if (!magicGuard && takesWeatherChip(field.weather, s.battler.types)) {
        this.indirectDamage(side, weatherChipDamage(field.weather, s.maxHp, s.battler.types), events, weatherChipMessage(s.battler.name, field.weather));
        if (s.currentHp <= 0) continue;
      }
      const heal = terrainHeal(field.terrain, s.maxHp, battlerGrounded(s));
      if (heal > 0 && s.currentHp < s.maxHp) this.heal(side, heal, events, `${s.battler.name} is healed by the terrain!`);
      if (ability?.speedBoost) this.changeStage(side, 'speed', 1, events);
      if (item?.leftovers && s.currentHp < s.maxHp) {
        if (item.id === 'black-sludge' && !s.battler.types.includes('poison')) {
          this.indirectDamage(side, Math.max(1, Math.floor(s.maxHp / 16)), events, `${s.battler.name} is hurt by the Black Sludge!`);
          if (s.currentHp <= 0) continue;
        } else {
          this.heal(side, Math.max(1, Math.floor(s.maxHp * item.leftovers)), events, `${s.battler.name} restored a little HP!`);
        }
      }
      if (!magicGuard && (s.status === 'burn' || s.status === 'poison' || s.status === 'toxic')) {
        if (s.status === 'toxic') s.toxicCounter += 1;
        this.indirectDamage(side, residualDamage(s.status, s.maxHp, s.toxicCounter), events, residualMessage(s.battler.name, s.status));
        if (s.currentHp <= 0) continue;
      }
      if (item?.selfStatus && s.status === 'none') this.inflictStatus(side, item.selfStatus, events, true);
      if (item?.curesStatus && s.status !== 'none' && !s.itemUsed) {
        if (item.curesStatus === 'all' || item.curesStatus === s.status) {
          s.status = 'none';
          s.toxicCounter = 0;
          s.itemUsed = true;
          events.push({ kind: 'cure', side, text: `${s.battler.name}'s ${item.name} cured its status!` });
        }
      }
      if (item?.pinchHeal && !s.itemUsed && s.currentHp > 0 && s.currentHp <= s.maxHp / 2) {
        s.itemUsed = true;
        this.heal(side, Math.floor(s.maxHp * item.pinchHeal), events, `${s.battler.name} restored HP with its Berry!`);
      }
    }
    if (field.weatherTurns > 0 && --field.weatherTurns === 0 && field.weather !== 'none') {
      field.weather = 'none';
      events.push({ kind: 'weather', weather: 'none', text: 'The weather cleared up.' });
    }
    if (field.terrainTurns > 0 && --field.terrainTurns === 0 && field.terrain !== 'none') {
      field.terrain = 'none';
      events.push({ kind: 'terrain', terrain: 'none', text: 'The terrain faded.' });
    }
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

  /* --------------------------------------------------------------- atoms */

  private inflictStatus(side: SideIndex, status: StatusCondition, events: BattleEvent[], force = false): boolean {
    const s = this.active(side);
    const ability = abilityById(s.battler.ability);
    if (ability?.statusImmunity === 'all' || ability?.statusImmunity === status) return false;
    if (!force) {
      if (!canApplyStatus(status, s.battler.types, s.status)) return false;
      if (terrainBlocksStatus(this.state.field.terrain, status, battlerGrounded(s))) return false;
    } else if (s.status !== 'none') return false;
    s.status = status;
    s.toxicCounter = 0;
    if (status === 'sleep') s.sleepTurns = rollSleepTurns((a, b) => this.rng.int(a, b));
    events.push({ kind: 'status-set', side, status, text: statusSetMessage(s.battler.name, status) });
    return true;
  }

  private applyMoveBoosts(side: SideIndex, boosts: Partial<Record<BoostableStat, number>>, events: BattleEvent[]): boolean {
    let any = false;
    const s = this.active(side);
    for (const stat of Object.keys(boosts) as BoostableStat[]) {
      const before = s.stages[stat];
      s.stages = applyBoosts(s.stages, { [stat]: boosts[stat] });
      const delta = s.stages[stat] - before;
      if (delta !== 0) {
        any = true;
        events.push({ kind: 'stage-change', side, stat, delta, text: stageText(s.battler.name, stat, delta) });
      }
    }
    return any;
  }

  private changeStage(side: SideIndex, stat: BoostableStat, delta: number, events: BattleEvent[]): void {
    const s = this.active(side);
    const before = s.stages[stat];
    s.stages = applyBoost(s.stages, stat, delta).stages;
    if (s.stages[stat] !== before) {
      events.push({ kind: 'stage-change', side, stat, delta: s.stages[stat] - before, text: stageText(s.battler.name, stat, s.stages[stat] - before) });
    }
  }

  private setWeather(weather: Weather, setter: BattleSide, events: BattleEvent[]): void {
    if (this.state.field.weather === weather) return;
    const item = itemById(setter.battler.item);
    this.state.field.weather = weather;
    this.state.field.weatherTurns = item?.weatherRock === weather ? 8 : 5;
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
    if (res.added) events.push({ kind: 'hazard', side: targetSide, hazard: kind, text: hazardSetMessage(kind, targetSide === 0 ? 'your side' : 'the foe') });
  }

  private heal(side: SideIndex, amount: number, events: BattleEvent[], text: string): void {
    const s = this.active(side);
    if (amount <= 0 || s.currentHp >= s.maxHp) return;
    s.currentHp = Math.min(s.maxHp, s.currentHp + amount);
    events.push({ kind: 'heal', side, amount, remainingHp: s.currentHp, maxHp: s.maxHp, text });
  }

  private indirectDamage(side: SideIndex, amount: number, events: BattleEvent[], text: string): void {
    if (amount <= 0) return;
    const s = this.active(side);
    s.currentHp = Math.max(0, s.currentHp - amount);
    events.push({ kind: 'damage', side, amount, effectiveness: 1, crit: false, remainingHp: s.currentHp, maxHp: s.maxHp });
    if (text) events.push({ kind: 'status', text });
    if (s.currentHp <= 0) events.push({ kind: 'faint', side, name: s.battler.name });
  }

  private effectiveSpeed(side: SideIndex): number {
    const s = this.active(side);
    let spe = s.battler.stats.speed * stageMultiplier('speed', s.stages.speed) * paralysisSpeedFactor(s.status);
    const item = itemById(s.battler.item);
    if (item?.statMultiplier?.stat === 'speed') spe *= item.statMultiplier.factor;
    const ability = abilityById(s.battler.ability);
    if (ability?.weatherSpeed && ability.weatherSpeed === this.state.field.weather) spe *= 2;
    return spe;
  }

  private bySpeed(): SideIndex[] {
    return this.effectiveSpeed(0) >= this.effectiveSpeed(1) ? [0, 1] : [1, 0];
  }

  private moveOf(side: SideIndex, action: TeamAction): BattleMove {
    const i = action.type === 'move' ? action.index : 0;
    return this.active(side).battler.moves[i];
  }
}

function firstLiving(party: BattleSide[]): number {
  const i = party.findIndex((s) => s.currentHp > 0);
  return i < 0 ? 0 : i;
}

function stageText(name: string, stat: BoostableStat, delta: number): string {
  const label: Record<BoostableStat, string> = {
    attack: 'Attack', defense: 'Defense', 'special-attack': 'Sp. Atk', 'special-defense': 'Sp. Def', speed: 'Speed', accuracy: 'accuracy', evasion: 'evasion',
  };
  if (delta >= 2) return `${name}'s ${label[stat]} rose sharply!`;
  if (delta === 1) return `${name}'s ${label[stat]} rose!`;
  if (delta === -1) return `${name}'s ${label[stat]} fell!`;
  return `${name}'s ${label[stat]} harshly fell!`;
}
