/**
 * Tournament *format* — the bracket/scheduling shape, orthogonal to the themed
 * modes (Classic, Mono-Type, …). Single-elimination keeps the knockout bracket;
 * Round-Robin and Swiss are league formats decided on a standings table.
 *
 * Also holds power-seeding helpers so the strongest teams are spread across a
 * knockout bracket instead of paired at random.
 */
import type { IconName } from '../../core/ui/icon/icons.data';
import type { Trainer } from './types';

export type BracketFormat = 'single-elim' | 'round-robin' | 'swiss';

export interface FormatInfo {
  readonly id: BracketFormat;
  readonly name: string;
  readonly icon: IconName;
  readonly tagline: string;
  readonly description: string;
}

export const TOURNAMENT_FORMATS: readonly FormatInfo[] = [
  {
    id: 'single-elim',
    name: 'Single Elimination',
    icon: 'trophy',
    tagline: 'Win or go home.',
    description: 'A seeded 16-trainer knockout bracket — one loss and you are out. Win four rounds to take the cup.',
  },
  {
    id: 'round-robin',
    name: 'Round Robin',
    icon: 'clipboard-list',
    tagline: 'Everyone plays everyone.',
    description: 'A full league: every trainer faces every other once. The table decides the champion — wins first, KO differential breaks ties.',
  },
  {
    id: 'swiss',
    name: 'Swiss',
    icon: 'refresh-cw',
    tagline: 'Paired by record, no eliminations.',
    description: 'A fixed number of rounds; each round you are paired against someone on your record. No knockouts — the standings crown the winner.',
  },
];

export function formatById(id: BracketFormat): FormatInfo {
  const f = TOURNAMENT_FORMATS.find((x) => x.id === id);
  if (!f) throw new Error(`Unknown tournament format: ${id}`);
  return f;
}

/**
 * Standard knockout seed positions for a power-of-two field: returns the 1-based
 * seed sitting at each bracket slot, so #1 and #2 only meet in the final.
 */
export function seedSlots(size: number): number[] {
  let seeds = [1, 2];
  while (seeds.length < size) {
    const sum = seeds.length * 2 + 1;
    const next: number[] = [];
    for (const s of seeds) {
      next.push(s);
      next.push(sum - s);
    }
    seeds = next;
  }
  return seeds.slice(0, size);
}

/**
 * Arrange trainers (sorted strongest-first) into seeded bracket order so the top
 * seeds are spread across the bracket. `size` must be a power of two.
 */
export function seedTrainers(sortedStrongestFirst: readonly Trainer[]): Trainer[] {
  const slots = seedSlots(sortedStrongestFirst.length);
  return slots.map((seed) => ({ ...sortedStrongestFirst[seed - 1], seed }));
}
