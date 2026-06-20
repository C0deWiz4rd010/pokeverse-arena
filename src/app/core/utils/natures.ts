/**
 * The 25 main-series natures and the stats they raise (+10%) / lower (-10%).
 *
 * Kept as static data so the Team Builder and Battle Engine never need a
 * network call and stat math stays deterministic / unit-testable.
 */
import type { NatureModifier, StatKey } from './stat-calculator';

export interface Nature extends NatureModifier {
  readonly name: string;
}

const A: StatKey = 'attack';
const D: StatKey = 'defense';
const S: StatKey = 'speed';
const SA: StatKey = 'special-attack';
const SD: StatKey = 'special-defense';

export const NATURES: readonly Nature[] = [
  { name: 'Hardy', increased: null, decreased: null },
  { name: 'Lonely', increased: A, decreased: D },
  { name: 'Brave', increased: A, decreased: S },
  { name: 'Adamant', increased: A, decreased: SA },
  { name: 'Naughty', increased: A, decreased: SD },
  { name: 'Bold', increased: D, decreased: A },
  { name: 'Docile', increased: null, decreased: null },
  { name: 'Relaxed', increased: D, decreased: S },
  { name: 'Impish', increased: D, decreased: SA },
  { name: 'Lax', increased: D, decreased: SD },
  { name: 'Timid', increased: S, decreased: A },
  { name: 'Hasty', increased: S, decreased: D },
  { name: 'Serious', increased: null, decreased: null },
  { name: 'Jolly', increased: S, decreased: SA },
  { name: 'Naive', increased: S, decreased: SD },
  { name: 'Modest', increased: SA, decreased: A },
  { name: 'Mild', increased: SA, decreased: D },
  { name: 'Quiet', increased: SA, decreased: S },
  { name: 'Bashful', increased: null, decreased: null },
  { name: 'Rash', increased: SA, decreased: SD },
  { name: 'Calm', increased: SD, decreased: A },
  { name: 'Gentle', increased: SD, decreased: D },
  { name: 'Sassy', increased: SD, decreased: S },
  { name: 'Careful', increased: SD, decreased: SA },
  { name: 'Quirky', increased: null, decreased: null },
];

const BY_NAME = new Map(NATURES.map((n) => [n.name, n]));

export function natureByName(name: string): Nature {
  return BY_NAME.get(name) ?? NATURES[0];
}

/** Short label like "+Atk / -SpA" or "Neutral" for the UI. */
export function natureSummary(nature: NatureModifier): string {
  if (!nature.increased || !nature.decreased) return 'Neutral';
  return `+${SHORT[nature.increased]} / -${SHORT[nature.decreased]}`;
}

const SHORT: Record<StatKey, string> = {
  hp: 'HP',
  attack: 'Atk',
  defense: 'Def',
  'special-attack': 'SpA',
  'special-defense': 'SpD',
  speed: 'Spe',
};
