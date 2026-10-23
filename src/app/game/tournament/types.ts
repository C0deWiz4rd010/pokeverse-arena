/**
 * Domain types for the tournament feature: trainers, their teams, the bracket
 * structure (round of 16 → final) and match results. Kept framework-free so the
 * logic stays pure and unit-testable.
 */
import type { AiTier, Battler, BattleRules, Terrain, Weather } from '../engine';

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
  /** The persistent rival (one per profile) who enters every run. */
  readonly isRival?: boolean;
  /** 1-based power seed within a knockout bracket (set by seedTrainers). */
  readonly seed?: number;
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

/** Context the interactive 3-v-3 player match needs to run (shared by tournaments, arena, spire and odyssey). */
export interface PlayerMatchSetup {
  readonly match: BracketMatch;
  readonly round: RoundId;
  readonly player: Trainer;
  readonly foe: Trainer;
  readonly playerTeam: Battler[];
  readonly foeTeam: Battler[];
  readonly rules?: BattleRules;
  readonly playerStartHp?: number[];
  readonly foeStartHp?: number[];
  /** AI difficulty the foe plays at (defaults to 'strong'). */
  readonly aiTier?: AiTier;
  /** A persistent battlefield condition imposed from the first turn (gym fields). */
  readonly field?: { readonly weather?: Weather; readonly terrain?: Terrain };
  /** Accent colour for a themed match frame (any CSS colour, incl. var(--…)). */
  readonly accent?: string;
  /** A taunt shown as a banner when the foe sends out its final (ace) Pokémon. */
  readonly foeAce?: string;
}

/** What an interactive match reports back to its host (HP carries over for gauntlets and runs). */
export interface MatchOutcome {
  readonly playerWon: boolean;
  readonly playerFinalHp: number[];
}
