/**
 * Seeded, turn-based single-battle engine (1-v-1).
 *
 * A `Battle` owns the mutable {@link BattleState} and a {@link SeededRng}; given
 * the same battlers, seed and move choices it always produces the same event log
 * — which makes replays and "daily challenges" trivial. The turn loop follows the
 * main-series structure: entry abilities → action ordering (priority, adjusted
 * speed, seeded tie-break) → move execution → end-of-turn residuals.
 *
 * The mechanics themselves live in {@link BattleCore}, shared with the party engine
 * ({@link TeamBattle}); this class only supplies the duel format: a faint ends the match.
 */
import { SeededRng } from '../../core/utils/rng';
import { chooseAiMove, type AiTier } from './ai';
import { BattleCore, other } from './battle-core';
import type { BattleRules } from './rules';
import { freshStages } from './stat-stages';
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

interface Action {
  side: SideIndex;
  moveIndex: number;
}

export class Battle {
  readonly state: BattleState;
  private readonly rng: SeededRng;
  private readonly rules?: BattleRules;
  private readonly aiTier: AiTier;
  private readonly core: BattleCore;
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
    this.core = new BattleCore({
      rng: this.rng,
      rules: this.rules,
      field: this.state.field,
      active: (side) => this.state.sides[side],
      finished: () => this.state.finished,
      onMoveDone: (attacker, defender, events) => {
        this.checkFaint(defender, attacker, events);
        this.checkFaint(attacker, defender, events);
      },
      afterResidual: (side, events) => {
        if (this.state.sides[side].currentHp <= 0) {
          this.checkFaint(side, other(side), events);
          return true;
        }
        return false;
      },
    });
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
        attackerIndex: attacker,
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
      for (const side of this.core.bySpeed()) this.core.fireEntryAbility(side, events);
    }

    this.state.turn += 1;
    events.push({ kind: 'turn', turn: this.state.turn });

    // Flinch and Protect only last until the holder's action this turn.
    this.core.beginTurn();

    // Charging, Encore and Choice locks may override what was asked for; no PP at all → Struggle.
    const actions: Action[] = [
      { side: 0, moveIndex: this.core.resolveMoveIndex(0, playerMoveIndex) },
      { side: 1, moveIndex: this.core.resolveMoveIndex(1, opponentMoveIndex) },
    ];
    const moveOf = (side: SideIndex): BattleMove =>
      this.core.moveFor(side, actions[side]!.moveIndex);
    for (const side of this.core.orderSides([0, 1], moveOf)) {
      if (this.state.finished) break;
      if (this.state.sides[side].currentHp <= 0) continue;
      this.core.executeMove(side, actions[side]!.moveIndex, events);
    }

    if (!this.state.finished) this.core.endOfTurn(events);
    return events;
  }

  private checkFaint(faintedSide: SideIndex, winnerSide: SideIndex, events: BattleEvent[]): void {
    if (this.state.finished) return;
    if (this.state.sides[faintedSide].currentHp > 0) return;
    events.push({
      kind: 'faint',
      side: faintedSide,
      name: this.state.sides[faintedSide].battler.name,
    });
    this.state.finished = true;
    this.state.winner = winnerSide;
    events.push({ kind: 'end', winner: winnerSide, loser: faintedSide });
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
