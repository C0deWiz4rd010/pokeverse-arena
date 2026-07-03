/**
 * Trainer profile model: the aggregate progression snapshot drawn from every
 * game system, plus a pure achievements catalogue evaluated against it. Kept
 * framework-free and testable.
 */
import type { IconName } from '../ui/icon/icons.data';

/** Identity the player can edit. */
export interface TrainerIdentity {
  readonly name: string;
  readonly title: string;
}

export const DEFAULT_IDENTITY: TrainerIdentity = { name: 'Trainer', title: 'Rising Challenger' };

/** Snapshot aggregated from every system: arena, tournaments, spire, adventure, world, contest. */
export interface ProfileState {
  readonly badges: number;
  readonly totalBadges: number;
  readonly arenaChampion: boolean;
  readonly bestDepth: number;
  readonly spireClears: number;
  readonly ascension: number;
  readonly tournamentWins: number;
  readonly tournamentRuns: number;
  readonly coins: number;
  /** Adventure (RPG) gym badges earned. */
  readonly adventureBadges: number;
  /** Pokémon caught in the Adventure. */
  readonly adventureCaught: number;
  /** Species registered in the World Explorer dex. */
  readonly worldCaught: number;
  /** Shiny catches from World expeditions. */
  readonly shinyCaught: number;
  /** Contest ribbons collected (of 5). */
  readonly contestRibbons: number;
  /** Head-to-head record against your tournament rival. */
  readonly rivalWins: number;
  readonly rivalLosses: number;
  /** Crystal-ball champion calls that hit. */
  readonly pickemHits: number;
  /** Daily Challenge: live consecutive-day win streak and all-time best. */
  readonly dailyStreak: number;
  readonly dailyBest: number;
}

export interface Achievement {
  readonly id: string;
  readonly name: string;
  readonly desc: string;
  readonly icon: IconName;
  readonly test: (s: ProfileState) => boolean;
}

export const ACHIEVEMENTS: readonly Achievement[] = [
  { id: 'first-badge', name: 'First Steps', desc: 'Earn your first gym badge.', icon: 'shield-check', test: (s) => s.badges >= 1 },
  { id: 'half-badges', name: 'Halfway There', desc: 'Earn 9 gym badges.', icon: 'shield-half', test: (s) => s.badges >= 9 },
  { id: 'all-badges', name: 'Badge Master', desc: 'Earn all 18 gym badges.', icon: 'shield', test: (s) => s.badges >= s.totalBadges && s.totalBadges > 0 },
  { id: 'champion', name: 'Arena Champion', desc: 'Conquer the Champion Gauntlet.', icon: 'crown', test: (s) => s.arenaChampion },
  { id: 'tour-win', name: 'Cup Winner', desc: 'Win a tournament.', icon: 'trophy', test: (s) => s.tournamentWins >= 1 },
  { id: 'tour-veteran', name: 'Circuit Veteran', desc: 'Enter 10 tournaments.', icon: 'clipboard-list', test: (s) => s.tournamentRuns >= 10 },
  { id: 'spire-climb', name: 'Spire Climber', desc: 'Reach floor 8 of the Spire.', icon: 'mountain', test: (s) => s.bestDepth >= 8 },
  { id: 'spire-clear', name: 'Summit Reached', desc: 'Clear the Ascension Spire.', icon: 'mountain-snow', test: (s) => s.spireClears >= 1 },
  { id: 'ascendant', name: 'Ascendant', desc: 'Reach ascension tier 3.', icon: 'star', test: (s) => s.ascension >= 3 },
  { id: 'wealthy', name: 'Well Funded', desc: 'Bank 1000 coins across all modes.', icon: 'gem', test: (s) => s.coins >= 1000 },
  { id: 'adv-badge', name: 'Trail Blazer', desc: 'Earn a gym badge in the Adventure.', icon: 'map', test: (s) => s.adventureBadges >= 1 },
  { id: 'adv-catcher', name: 'Field Researcher', desc: 'Catch 10 Pokémon in the Adventure.', icon: 'map-pin', test: (s) => s.adventureCaught >= 10 },
  { id: 'world-50', name: 'Registrar', desc: 'Register 50 species in the World Dex.', icon: 'book', test: (s) => s.worldCaught >= 50 },
  { id: 'shiny-one', name: 'Shiny Hunter', desc: 'Catch a shiny on a World expedition.', icon: 'sparkles', test: (s) => s.shinyCaught >= 1 },
  { id: 'ribbon-one', name: 'Stage Debut', desc: 'Win a contest ribbon.', icon: 'wand-sparkles', test: (s) => s.contestRibbons >= 1 },
  { id: 'ribbon-all', name: 'Ribbon Royalty', desc: 'Collect all five contest ribbons.', icon: 'heart', test: (s) => s.contestRibbons >= 5 },
  { id: 'rival-lead', name: 'Rival Slayer', desc: 'Lead your rival head-to-head by 3.', icon: 'zap', test: (s) => s.rivalWins >= s.rivalLosses + 3 },
  { id: 'oracle', name: 'Crystal Oracle', desc: 'Hit a crystal-ball champion call.', icon: 'dices', test: (s) => s.pickemHits >= 1 },
  { id: 'daily-3', name: 'On Fire', desc: 'Reach a 3-day Daily Challenge streak.', icon: 'flame', test: (s) => s.dailyBest >= 3 },
  { id: 'daily-7', name: 'Eternal Flame', desc: 'Reach a 7-day Daily Challenge streak.', icon: 'sun', test: (s) => s.dailyBest >= 7 },
];

export interface AchievementView {
  readonly achievement: Achievement;
  readonly unlocked: boolean;
}

export function evaluateAchievements(state: ProfileState): AchievementView[] {
  return ACHIEVEMENTS.map((achievement) => ({ achievement, unlocked: achievement.test(state) }));
}

export function unlockedCount(state: ProfileState): number {
  return ACHIEVEMENTS.reduce((n, a) => n + (a.test(state) ? 1 : 0), 0);
}

/** Ordered rank tiers and the minimum progression score to reach each. */
export interface RankTier {
  readonly name: string;
  readonly min: number;
}
export const RANK_TIERS: readonly RankTier[] = [
  { name: 'Rookie', min: 0 },
  { name: 'Adept', min: 3 },
  { name: 'Veteran', min: 8 },
  { name: 'Elite', min: 16 },
  { name: 'Legend', min: 25 },
];

/** Weighted progression score that drives the rank ladder. */
export function progressScore(state: ProfileState): number {
  return (
    state.badges +
    state.tournamentWins * 2 +
    state.spireClears * 3 +
    (state.arenaChampion ? 5 : 0) +
    state.adventureBadges * 2 +
    state.contestRibbons +
    state.pickemHits
  );
}

/** A simple rank title derived from total progression, used for flavour. */
export function rankFor(state: ProfileState): string {
  const score = progressScore(state);
  let rank = RANK_TIERS[0].name;
  for (const tier of RANK_TIERS) if (score >= tier.min) rank = tier.name;
  return rank;
}

export interface RankProgress {
  readonly rank: string;
  /** Next tier's name, or null when already at the top. */
  readonly next: string | null;
  readonly score: number;
  /** Score floor of the current tier and ceiling (next tier's min, or null). */
  readonly floor: number;
  readonly ceil: number | null;
  /** Points still needed to reach the next tier (0 when maxed). */
  readonly toNext: number;
  /** Progress through the current tier toward the next, 0–100. */
  readonly pct: number;
}

/** Rich rank state: current tier, the next one, and progress toward it. */
export function rankProgress(state: ProfileState): RankProgress {
  const score = progressScore(state);
  let i = 0;
  for (let t = 0; t < RANK_TIERS.length; t++) if (score >= RANK_TIERS[t].min) i = t;
  const current = RANK_TIERS[i];
  const next = i < RANK_TIERS.length - 1 ? RANK_TIERS[i + 1] : null;
  const floor = current.min;
  const ceil = next ? next.min : null;
  const toNext = next ? Math.max(0, next.min - score) : 0;
  const pct = next ? Math.min(100, Math.round(((score - floor) / (next.min - floor)) * 100)) : 100;
  return { rank: current.name, next: next?.name ?? null, score, floor, ceil, toNext, pct };
}
