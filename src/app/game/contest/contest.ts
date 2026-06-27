import { SeededRng } from '../../core/utils/rng';
import type { IconName } from '../../core/ui/icon/icons.data';

/**
 * Contest Hall logic — pure, deterministic and framework-free so it can be unit
 * tested in isolation. Berries carry the five PokéAPI flavours; each flavour
 * feeds one contest condition (spicy→Cool, dry→Beauty, sweet→Cute, bitter→Smart,
 * sour→Tough). A "Poffin mix" of berries builds a Pokémon's conditions, which
 * then drive its appeal score against a field of seeded rivals.
 */

export type Flavor = 'spicy' | 'dry' | 'sweet' | 'bitter' | 'sour';
export type ContestCategory = 'cool' | 'beauty' | 'cute' | 'smart' | 'tough';

export const FLAVORS: readonly Flavor[] = ['spicy', 'dry', 'sweet', 'bitter', 'sour'];

export interface CategoryInfo {
  readonly key: ContestCategory;
  readonly label: string;
  readonly flavor: Flavor;
  readonly icon: IconName;
  readonly accent: string;
}

export const CONTEST_CATEGORIES: readonly CategoryInfo[] = [
  { key: 'cool', label: 'Cool', flavor: 'spicy', icon: 'flame', accent: '#ff6b6b' },
  { key: 'beauty', label: 'Beauty', flavor: 'dry', icon: 'droplet', accent: '#4dabf7' },
  { key: 'cute', label: 'Cute', flavor: 'sweet', icon: 'candy', accent: '#f783ac' },
  { key: 'smart', label: 'Smart', flavor: 'bitter', icon: 'brain', accent: '#a78bfa' },
  { key: 'tough', label: 'Tough', flavor: 'sour', icon: 'shield', accent: '#82c91e' },
];

/** A berry and the potency of each of its five flavours (0 when absent). */
export interface Berry {
  readonly name: string;
  readonly flavors: Readonly<Record<Flavor, number>>;
}

export type Conditions = Record<ContestCategory, number>;

const ZERO_CONDITIONS: Conditions = {
  cool: 0,
  beauty: 0,
  cute: 0,
  smart: 0,
  tough: 0,
};

/** The contest category fed by a flavour. */
export function categoryForFlavor(flavor: Flavor): ContestCategory {
  return CONTEST_CATEGORIES.find((c) => c.flavor === flavor)!.key;
}

/** The flavour that feeds a contest category. */
export function flavorForCategory(category: ContestCategory): Flavor {
  return CONTEST_CATEGORIES.find((c) => c.key === category)!.flavor;
}

/**
 * Sum a mix of berries into the five contest conditions. Each berry's flavour
 * potency is added to the matching condition.
 */
export function mixConditions(berries: readonly Berry[]): Conditions {
  const out: Conditions = { ...ZERO_CONDITIONS };
  for (const berry of berries) {
    for (const flavor of FLAVORS) {
      out[categoryForFlavor(flavor)] += berry.flavors[flavor] ?? 0;
    }
  }
  return out;
}

/** Berries past the fourth clash and reduce sheen; mirrors the games' feel. */
export const MAX_MIX = 4;

/**
 * A Pokémon's appeal in a single category. Built from its condition in that
 * category, a flat stage-presence base, a small smoothness bonus for a tidy mix,
 * and a seeded sparkle of showmanship for drama.
 */
export function appealScore(
  conditions: Conditions,
  category: ContestCategory,
  mixSize: number,
  rng: SeededRng,
): number {
  const condition = conditions[category];
  const base = 20;
  const smoothness = mixSize > 0 ? Math.max(0, MAX_MIX - mixSize) * 2 : 0;
  const showmanship = rng.int(0, 14);
  return Math.round(base + condition * 2 + smoothness + showmanship);
}

export interface ContestEntrant {
  readonly name: string;
  readonly score: number;
  readonly isPlayer: boolean;
}

const RIVAL_NAMES = [
  'Coordinator Lila',
  'Maestro Bram',
  'Starlet Posy',
  'Dazzle Kit',
  'Vivi the Vain',
  'Sir Pomp',
];

/**
 * Run a contest: score the player, generate three seeded rivals, and return the
 * full field ranked by appeal (highest first).
 */
export function runContest(
  playerName: string,
  conditions: Conditions,
  category: ContestCategory,
  mixSize: number,
  seed: number | string,
): { ranking: ContestEntrant[]; playerRank: number; won: boolean } {
  const rng = new SeededRng(seed);
  const playerScore = appealScore(conditions, category, mixSize, rng);

  const names = rng.shuffle(RIVAL_NAMES).slice(0, 3);
  const rivals: ContestEntrant[] = names.map((name) => ({
    name,
    score: rng.int(34, 78),
    isPlayer: false,
  }));

  const field: ContestEntrant[] = [
    { name: playerName, score: playerScore, isPlayer: true },
    ...rivals,
  ];
  const ranking = field
    .slice()
    .sort((a, b) => b.score - a.score || (a.isPlayer ? -1 : 1));
  const playerRank = ranking.findIndex((e) => e.isPlayer) + 1;
  return { ranking, playerRank, won: playerRank === 1 };
}

/* ============================ multi-round appeals =========================== */

export type ContestRank = 'normal' | 'super' | 'hyper' | 'master';

export interface RankInfo {
  readonly key: ContestRank;
  readonly label: string;
  /** Rival per-round appeal band [min, max] at this rank. */
  readonly rivalBand: readonly [number, number];
}

export const CONTEST_RANKS: readonly RankInfo[] = [
  { key: 'normal', label: 'Normal Rank', rivalBand: [30, 66] },
  { key: 'super', label: 'Super Rank', rivalBand: [42, 80] },
  { key: 'hyper', label: 'Hyper Rank', rivalBand: [56, 92] },
  { key: 'master', label: 'Master Rank', rivalBand: [70, 104] },
];

export function rankInfo(rank: ContestRank): RankInfo {
  return CONTEST_RANKS.find((r) => r.key === rank)!;
}

export function nextRank(rank: ContestRank): ContestRank | null {
  const i = CONTEST_RANKS.findIndex((r) => r.key === rank);
  return i >= 0 && i < CONTEST_RANKS.length - 1 ? CONTEST_RANKS[i + 1].key : null;
}

/** Number of appeal turns in a performance. */
export const APPEAL_ROUNDS = 4;

export interface RoundLine {
  readonly name: string;
  readonly isPlayer: boolean;
  /** Appeal gained this round (after combo + jamming). */
  readonly appeal: number;
  /** Running total after this round. */
  readonly total: number;
  /** True when a combo bonus carried into this round. */
  readonly combo: boolean;
  /** True when this performer was jammed (frontrunner penalty) this round. */
  readonly jammed: boolean;
}

export interface AppealRound {
  readonly turn: number;
  readonly lines: RoundLine[];
}

export interface AppealContestResult {
  readonly rounds: AppealRound[];
  readonly ranking: ContestEntrant[];
  readonly playerRank: number;
  readonly won: boolean;
  readonly promoted: boolean;
}

/**
 * A full multi-round contest performance. Each of {@link APPEAL_ROUNDS} turns
 * every performer makes an appeal; the previous round's top performer carries a
 * **combo** bonus into the next, and the current leader gets **jammed** (a small
 * penalty) so the field can mount a comeback. Rivals scale with the contest rank.
 * Winning at a non-Master rank promotes the player.
 */
export function runAppealContest(
  playerName: string,
  conditions: Conditions,
  category: ContestCategory,
  mixSize: number,
  rank: ContestRank,
  seed: number | string,
): AppealContestResult {
  const rng = new SeededRng(seed);
  const rivals = rng.shuffle(RIVAL_NAMES).slice(0, 3);
  const names = [playerName, ...rivals];
  const isPlayer = names.map((_, i) => i === 0);
  const [lo, hi] = rankInfo(rank).rivalBand;

  const totals = names.map(() => 0);
  let comboIndex = -1;
  const rounds: AppealRound[] = [];

  for (let t = 0; t < APPEAL_ROUNDS; t++) {
    const leader = totals.indexOf(Math.max(...totals));
    const lines: RoundLine[] = [];
    const roundAppeal: number[] = [];

    names.forEach((name, idx) => {
      let appeal = idx === 0 ? appealScore(conditions, category, mixSize, rng) : rng.int(lo, hi);
      const combo = idx === comboIndex;
      if (combo) appeal += rng.int(5, 12);
      const jammed = t > 0 && idx === leader;
      if (jammed) appeal = Math.max(1, appeal - rng.int(3, 10));
      totals[idx] += appeal;
      roundAppeal.push(appeal);
      lines.push({ name, isPlayer: isPlayer[idx], appeal, total: totals[idx], combo, jammed });
    });

    // The round's top appeal earns the combo carry into the next turn.
    comboIndex = roundAppeal.indexOf(Math.max(...roundAppeal));
    rounds.push({ turn: t + 1, lines });
  }

  const ranking = names
    .map((name, i) => ({ name, score: totals[i], isPlayer: isPlayer[i] }))
    .sort((a, b) => b.score - a.score || (a.isPlayer ? -1 : 1));
  const playerRank = ranking.findIndex((e) => e.isPlayer) + 1;
  const won = playerRank === 1;
  return { rounds, ranking, playerRank, won, promoted: won && nextRank(rank) !== null };
}
