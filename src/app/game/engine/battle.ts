/**
 * Seeded, turn-based single-battle engine.
 *
 * A `Battle` owns the mutable state and a {@link SeededRng}; given the same
 * battlers, seed and sequence of player move choices it always produces the same
 * event log — which makes replays and "daily challenges" trivial.
 *
 * Damage math lives in {@link computeDamage} (pure); this class only handles
 * turn flow: accuracy, crit/roll, move order and faint detection.
 */
import { SeededRng } from '../../core/utils/rng';
import { resolveDamage, CRIT_CHANCE, MIN_ROLL, MAX_ROLL, moveEffectiveness, stabFor } from './damage';
import type { BattleRules } from './rules';
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

export class Battle {
  readonly state: BattleState;
  private readonly rng: SeededRng;
  private readonly rules?: BattleRules;

  constructor(
    player: Battler,
    opponent: Battler,
    seed: number | string = Date.now(),
    rules?: BattleRules,
  ) {
    this.rng = new SeededRng(seed);
    this.rules = rules;
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
  chooseAiMove(): number {
    return this.bestMoveIndex(1, 0);
  }

  /** Choose the player's best move automatically (used by headless simulation). */
  autoPlayerMove(): number {
    return this.bestMoveIndex(0, 1);
  }

  /**
   * Resolve a full turn: the player uses `playerMoveIndex`, the AI replies, and
   * both moves execute in priority/speed order. Returns the events produced.
   */
  takeTurn(playerMoveIndex: number, opponentMoveIndex = this.chooseAiMove()): BattleEvent[] {
    if (this.state.finished) return [];
    const events: BattleEvent[] = [];
    this.state.turn += 1;
    events.push({ kind: 'turn', turn: this.state.turn });

    const actions: Action[] = [
      { side: 0, moveIndex: playerMoveIndex },
      { side: 1, moveIndex: opponentMoveIndex },
    ];
    for (const action of this.orderActions(actions)) {
      if (this.state.finished) break;
      if (this.state.sides[action.side].currentHp <= 0) continue; // already fainted this turn
      this.executeMove(action, events);
    }
    return events;
  }

  /* -------------------------------------------------------- turn internals */

  private orderActions(actions: Action[]): Action[] {
    return [...actions].sort((a, b) => {
      const pa = this.moveOf(a).priority ?? 0;
      const pb = this.moveOf(b).priority ?? 0;
      if (pa !== pb) return pb - pa;
      const sa = this.state.sides[a.side].battler.stats.speed;
      const sb = this.state.sides[b.side].battler.stats.speed;
      if (sa !== sb) return sb - sa;
      // Equal speed: coin-flip via the seeded RNG keeps it deterministic.
      return this.rng.next() < 0.5 ? -1 : 1;
    });
  }

  private executeMove(action: Action, events: BattleEvent[]): void {
    const side = action.side;
    const attackerSide = this.state.sides[side];
    const defenderIndex: SideIndex = side === 0 ? 1 : 0;
    const defenderSide = this.state.sides[defenderIndex];
    const move = attackerSide.battler.moves[action.moveIndex];

    if (move.pp !== undefined && Number.isFinite(attackerSide.pp[action.moveIndex])) {
      attackerSide.pp[action.moveIndex] = Math.max(0, attackerSide.pp[action.moveIndex] - 1);
    }

    events.push({ kind: 'move', side, attacker: attackerSide.battler.name, move: move.name });

    // Accuracy check (0 = never misses).
    if (move.accuracy > 0 && this.rng.next() * 100 >= move.accuracy) {
      events.push({ kind: 'miss', side, attacker: attackerSide.battler.name, move: move.name });
      return;
    }

    if (move.power <= 0 || move.damageClass === 'status') {
      events.push({ kind: 'status', text: `${attackerSide.battler.name} used ${move.name}.` });
      return;
    }

    const crit = this.rng.chance(CRIT_CHANCE);
    const roll = MIN_ROLL + this.rng.next() * (MAX_ROLL - MIN_ROLL);
    const result = resolveDamage(attackerSide.battler, defenderSide.battler, move, crit, roll, this.rules);

    defenderSide.currentHp = Math.max(0, defenderSide.currentHp - result.damage);
    events.push({
      kind: 'damage',
      side: defenderIndex,
      amount: result.damage,
      effectiveness: result.effectiveness,
      crit: result.crit,
      remainingHp: defenderSide.currentHp,
      maxHp: defenderSide.maxHp,
    });

    if (defenderSide.currentHp <= 0) {
      events.push({ kind: 'faint', side: defenderIndex, name: defenderSide.battler.name });
      this.state.finished = true;
      this.state.winner = side;
      events.push({ kind: 'end', winner: side, loser: defenderIndex });
    }
  }

  /* ------------------------------------------------------------- AI helper */

  /** Highest expected-power move (power × STAB × type effectiveness). */
  private bestMoveIndex(attackerIndex: SideIndex, defenderIndex: SideIndex): number {
    const attacker = this.state.sides[attackerIndex].battler;
    const defender = this.state.sides[defenderIndex].battler;
    let bestIndex = 0;
    let bestScore = -1;
    attacker.moves.forEach((move, index) => {
      const score =
        move.power <= 0
          ? 0
          : move.power * stabFor(attacker, move) * moveEffectiveness(move, defender.types, this.rules);
      // Tie-break randomly but deterministically.
      const jittered = score + this.rng.next() * 0.001;
      if (jittered > bestScore) {
        bestScore = jittered;
        bestIndex = index;
      }
    });
    return bestIndex;
  }

  private moveOf(action: Action): BattleMove {
    return this.state.sides[action.side].battler.moves[action.moveIndex];
  }
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
