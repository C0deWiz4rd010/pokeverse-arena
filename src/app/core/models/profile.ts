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

/** Snapshot aggregated from arena, tournaments and the spire. */
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

/** A simple rank title derived from total progression, used for flavour. */
export function rankFor(state: ProfileState): string {
  const score = state.badges + state.tournamentWins * 2 + state.spireClears * 3 + (state.arenaChampion ? 5 : 0);
  if (score >= 25) return 'Legend';
  if (score >= 16) return 'Elite';
  if (score >= 8) return 'Veteran';
  if (score >= 3) return 'Adept';
  return 'Rookie';
}
