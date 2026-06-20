/**
 * Domain types for the tournament feature: trainers, their teams, the bracket
 * structure (round of 16 → final) and match results. Kept framework-free so the
 * logic stays pure and unit-testable.
 */
import type { Battler } from '../engine';

/** A CPU or player competitor with a small team of engine-ready Pokémon. */
export interface Trainer {
  readonly id: string;
  readonly name: string;
  /** Flavour class, e.g. "Ace Trainer". */
  readonly title: string;
  /** Emoji avatar. */
  readonly avatar: string;
  readonly team: Battler[];
  readonly isPlayer?: boolean;
}

export type RoundId = 'r16' | 'qf' | 'sf' | 'final';

export const ROUND_ORDER: readonly RoundId[] = ['r16', 'qf', 'sf', 'final'];

export const ROUND_LABEL: Record<RoundId, string> = {
  r16: 'Round of 16',
  qf: 'Quarterfinals',
  sf: 'Semifinals',
  final: 'Final',
};

/** Number of matches in each round. */
export const ROUND_SIZE: Record<RoundId, number> = { r16: 8, qf: 4, sf: 2, final: 1 };

/** A single bracket fixture. `a`/`b` fill in as earlier rounds resolve. */
export interface BracketMatch {
  readonly id: string;
  readonly round: RoundId;
  /** Index of the match within its round (0-based, top to bottom). */
  readonly slot: number;
  a: Trainer | null;
  b: Trainer | null;
  /** 0 → a won, 1 → b won, null → not played. */
  winner: 0 | 1 | null;
  played: boolean;
}

export interface Bracket {
  readonly rounds: Record<RoundId, BracketMatch[]>;
  champion: Trainer | null;
}

/** Outcome of one trainer-vs-trainer match. */
export interface MatchResult {
  /** 0 → team A won, 1 → team B won. */
  readonly winner: 0 | 1;
  readonly log: string[];
  readonly survivorsA: number;
  readonly survivorsB: number;
  /** Final HP of every team-A Pokémon (for cross-round carry). */
  readonly hpA: number[];
  /** Final HP of every team-B Pokémon (for cross-round carry). */
  readonly hpB: number[];
}
