/**
 * Core data shapes for the battle engine.
 *
 * The engine is intentionally decoupled from the PokéAPI: callers map API moves
 * and computed stats into these plain structures, so the whole engine stays
 * pure, deterministic and unit-testable.
 */
import type { PokemonType } from '../../core/utils/type-chart';
import type { StatKey } from '../../core/utils/stat-calculator';

export type DamageClass = 'physical' | 'special' | 'status';

export interface BattleMove {
  name: string;
  type: PokemonType;
  /** Base power; 0 for status / non-damaging moves. */
  power: number;
  /** Accuracy 1–100; use 0 to mean "never misses". */
  accuracy: number;
  damageClass: DamageClass;
  /** Move priority bracket (e.g. Quick Attack = +1). Defaults to 0. */
  priority?: number;
  /** Optional power points; the engine tracks usage when provided. */
  pp?: number;
}

export interface Battler {
  id: number;
  name: string;
  level: number;
  types: PokemonType[];
  /** Final computed stats (already includes level / nature / IV / EV). */
  stats: Record<StatKey, number>;
  moves: BattleMove[];
  /** Sprite/artwork URL — used by the UI, ignored by the engine. */
  sprite?: string;
}

export type SideIndex = 0 | 1;

export interface BattleSide {
  battler: Battler;
  currentHp: number;
  maxHp: number;
  /** Remaining PP per move index (only tracked when a move defines `pp`). */
  pp: number[];
}

export type BattleEvent =
  | { kind: 'turn'; turn: number }
  | { kind: 'move'; side: SideIndex; attacker: string; move: string }
  | { kind: 'miss'; side: SideIndex; attacker: string; move: string }
  | {
      kind: 'damage';
      side: SideIndex; // the side that TAKES the damage
      amount: number;
      effectiveness: number;
      crit: boolean;
      remainingHp: number;
      maxHp: number;
    }
  | { kind: 'status'; text: string }
  | { kind: 'faint'; side: SideIndex; name: string }
  | { kind: 'end'; winner: SideIndex; loser: SideIndex };

export interface BattleState {
  sides: [BattleSide, BattleSide];
  turn: number;
  finished: boolean;
  winner: SideIndex | null;
}
