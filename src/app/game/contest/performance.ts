/**
 * Interactive contest performance — a turn-by-turn appeal mini-game. Each round
 * the coordinator plays one appeal move; chaining the right category **combos**
 * (double appeal), repeating a category bores the crowd (a penalty), and a
 * "tough"-flavoured move **startles** rivals (jam). Pure, seeded and testable;
 * the feature drives it round by round and animates each outcome.
 */
import { SeededRng } from '../../core/utils/rng';
import {
  rankInfo,
  type Conditions,
  type ContestCategory,
  type ContestEntrant,
  type ContestRank,
} from './contest';

export const PERFORMANCE_ROUNDS = 4;
export const APPEAL_BASE = 24;
const BOREDOM_STEP = 8;
const THEME_BONUS = 10;

export interface AppealMove {
  readonly category: ContestCategory;
  readonly name: string;
  readonly appeal: number;
  /** Following a move of this category doubles the appeal (a combo!). */
  readonly comboAfter: ContestCategory;
  /** A startling move that rattles rivals' appeal this round. */
  readonly jam: boolean;
}

/** A cyclic combo chain: cool → beauty → cute → smart → tough → cool. */
const CHAIN: ContestCategory[] = ['cool', 'beauty', 'cute', 'smart', 'tough'];
const MOVE_NAMES: Record<ContestCategory, string> = {
  cool: 'Dazzling Flash',
  beauty: 'Graceful Charm',
  cute: 'Endearing Wink',
  smart: 'Clever Trick',
  tough: 'Bold Stomp',
};

export const APPEAL_MOVES: Record<ContestCategory, AppealMove> = CHAIN.reduce((acc, cat, i) => {
  acc[cat] = {
    category: cat,
    name: MOVE_NAMES[cat],
    appeal: APPEAL_BASE,
    comboAfter: CHAIN[(i + CHAIN.length - 1) % CHAIN.length],
    jam: cat === 'tough',
  };
  return acc;
}, {} as Record<ContestCategory, AppealMove>);

export interface RoundOutcome {
  readonly round: number;
  readonly category: ContestCategory;
  readonly base: number;
  readonly condition: number;
  readonly theme: number;
  readonly combo: number;
  readonly boredom: number;
  readonly showmanship: number;
  readonly jam: boolean;
  /** Hearts the player earned this round (≥ 1). */
  readonly total: number;
  readonly rivalAppeals: number[];
}

export interface PerformanceState {
  readonly rounds: number;
  /** 1-based current round; once it exceeds `rounds`, the show is over. */
  round: number;
  playerTotal: number;
  rivals: { name: string; total: number }[];
  lastCategory: ContestCategory | null;
  counts: Record<ContestCategory, number>;
  history: RoundOutcome[];
  finished: boolean;
}

const RIVAL_NAMES = ['Coordinator Lila', 'Maestro Bram', 'Starlet Posy', 'Dazzle Kit', 'Vivi the Vain', 'Sir Pomp'];

function zeroCounts(): Record<ContestCategory, number> {
  return { cool: 0, beauty: 0, cute: 0, smart: 0, tough: 0 };
}

/** Begin a performance: seed three rivals and reset counters. */
export function startPerformance(rank: ContestRank, seed: number | string): PerformanceState {
  const rng = new SeededRng(`perf-${seed}`);
  const rivals = rng.shuffle(RIVAL_NAMES).slice(0, 3).map((name) => ({ name, total: 0 }));
  return {
    rounds: PERFORMANCE_ROUNDS,
    round: 1,
    playerTotal: 0,
    rivals,
    lastCategory: null,
    counts: zeroCounts(),
    history: [],
    finished: false,
  };
}

/**
 * Resolve one appeal. Returns a fresh state (immutable-friendly for signals).
 * `theme` is the contest's category — appealing on-theme earns a small bonus.
 */
export function appeal(
  state: PerformanceState,
  category: ContestCategory,
  conditions: Conditions,
  theme: ContestCategory,
  rank: ContestRank,
  seed: number | string,
): PerformanceState {
  if (state.finished) return state;
  const move = APPEAL_MOVES[category];
  const rng = new SeededRng(`${seed}-r${state.round}`);

  const base = move.appeal;
  const condition = Math.round(conditions[category] * 0.6);
  const themeBonus = category === theme ? THEME_BONUS : 0;
  const combo = state.lastCategory === move.comboAfter ? base : 0;
  const boredom = state.counts[category] * BOREDOM_STEP;
  const showmanship = rng.int(0, 10);
  const total = Math.max(1, base + condition + themeBonus + combo - boredom + showmanship);

  const [lo, hi] = rankInfo(rank).rivalBand;
  const rivalAppeals = state.rivals.map(() => {
    const a = rng.int(lo, hi);
    return move.jam ? Math.max(1, a - rng.int(8, 16)) : a;
  });

  const rivals = state.rivals.map((r, i) => ({ name: r.name, total: r.total + rivalAppeals[i] }));
  const counts = { ...state.counts, [category]: state.counts[category] + 1 };
  const outcome: RoundOutcome = {
    round: state.round,
    category,
    base,
    condition,
    theme: themeBonus,
    combo,
    boredom,
    showmanship,
    jam: move.jam,
    total,
    rivalAppeals,
  };

  const round = state.round + 1;
  return {
    ...state,
    round,
    playerTotal: state.playerTotal + total,
    rivals,
    lastCategory: category,
    counts,
    history: [...state.history, outcome],
    finished: round > state.rounds,
  };
}

/** Final field ranking once the performance is finished. */
export function performanceRanking(
  state: PerformanceState,
  playerName: string,
): { ranking: ContestEntrant[]; playerRank: number; won: boolean } {
  const field: ContestEntrant[] = [
    { name: playerName, score: state.playerTotal, isPlayer: true },
    ...state.rivals.map((r) => ({ name: r.name, score: r.total, isPlayer: false })),
  ];
  const ranking = field.slice().sort((a, b) => b.score - a.score || (a.isPlayer ? -1 : 1));
  const playerRank = ranking.findIndex((e) => e.isPlayer) + 1;
  return { ranking, playerRank, won: playerRank === 1 };
}

/** Whether a move would combo given the last category played (for UI hints). */
export function wouldCombo(lastCategory: ContestCategory | null, category: ContestCategory): boolean {
  return lastCategory !== null && APPEAL_MOVES[category].comboAfter === lastCategory;
}
