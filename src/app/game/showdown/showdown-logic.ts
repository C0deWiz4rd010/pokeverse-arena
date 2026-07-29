/**
 * Stat Showdown — pure, framework-free helpers for a "higher-or-lower" duel:
 * two Pokémon face off on one randomly chosen base stat and the player guesses
 * which one wins. Kept deterministic-friendly (RNG is injected by the caller)
 * so the feature layer owns all data-fetching and Angular concerns.
 */

export type ShowdownStatKey =
  | 'hp'
  | 'attack'
  | 'defense'
  | 'special-attack'
  | 'special-defense'
  | 'speed'
  | 'bst';

export interface ShowdownStat {
  key: ShowdownStatKey;
  /** PokeAPI stat slug (unused for the synthetic `bst`). */
  api: string;
  label: string;
  short: string;
}

export const SHOWDOWN_STATS: readonly ShowdownStat[] = [
  { key: 'hp', api: 'hp', label: 'Highest HP', short: 'HP' },
  { key: 'attack', api: 'attack', label: 'Strongest Attack', short: 'Atk' },
  { key: 'defense', api: 'defense', label: 'Toughest Defense', short: 'Def' },
  { key: 'special-attack', api: 'special-attack', label: 'Best Special Attack', short: 'SpA' },
  { key: 'special-defense', api: 'special-defense', label: 'Best Special Defense', short: 'SpD' },
  { key: 'speed', api: 'speed', label: 'Fastest Speed', short: 'Spe' },
  { key: 'bst', api: 'bst', label: 'Highest Base Total', short: 'BST' },
];

/** A single fighter's resolved numbers, ready for display + comparison. */
export interface ShowdownMon {
  id: number;
  name: string;
  artwork: string;
  types: string[];
  stats: Record<Exclude<ShowdownStatKey, 'bst'>, number>;
  bst: number;
}

export function statValue(mon: ShowdownMon, key: ShowdownStatKey): number {
  return key === 'bst' ? mon.bst : mon.stats[key];
}

/** Which side wins the given stat. A tie counts for whichever the player picked. */
export function winnerSide(
  left: ShowdownMon,
  right: ShowdownMon,
  key: ShowdownStatKey,
): 'left' | 'right' | 'tie' {
  const l = statValue(left, key);
  const r = statValue(right, key);
  if (l === r) return 'tie';
  return l > r ? 'left' : 'right';
}

/** True when the player's pick is correct (ties always count as correct). */
export function isCorrect(
  pick: 'left' | 'right',
  left: ShowdownMon,
  right: ShowdownMon,
  key: ShowdownStatKey,
): boolean {
  const w = winnerSide(left, right, key);
  return w === 'tie' || w === pick;
}

/** A shareable, emoji-flavoured result string (Wordle-style, link-free). */
export function shareText(streak: number, best: number): string {
  const medal = streak >= 20 ? '🏆' : streak >= 10 ? '🥇' : streak >= 5 ? '🥈' : '🎯';
  const bar = '🟩'.repeat(Math.min(10, streak)) + '⬜'.repeat(Math.max(0, 10 - streak));
  return `Stat Showdown ${medal}\nStreak: ${streak} (best ${best})\n${bar}\nPokéVerse Arena`;
}
