/** Wild-encounter rolls over a tall-grass {@link EncounterZone}. Pure + seeded. */
import type { SeededRng } from '../../core/utils/rng';
import type { EncounterEntry, EncounterZone } from './rpg-types';
import type { TimeBand } from './time';

export interface WildRoll {
  readonly species: string;
  readonly level: number;
  readonly catchRate: number;
}

/** Weighted pick of a table entry. */
export function pickEntry(table: readonly EncounterEntry[], rng: SeededRng): EncounterEntry {
  const total = table.reduce((s, e) => s + e.weight, 0);
  let r = rng.next() * total;
  for (const e of table) {
    r -= e.weight;
    if (r <= 0) return e;
  }
  return table[table.length - 1];
}

/** Entries available at `band` (time-restricted ones only when they match). */
export function entriesForTime(table: readonly EncounterEntry[], band: TimeBand): EncounterEntry[] {
  return table.filter((e) => !e.time || e.time === band);
}

/**
 * Roll a wild encounter for a grass step. Returns null when no encounter fires
 * (per the zone's `rate`), else the chosen species + level. Entries flagged for
 * a time of day only appear in their band (defaults to the current clock).
 */
export function rollEncounter(zone: EncounterZone, rng: SeededRng, band?: TimeBand): WildRoll | null {
  if (rng.next() >= zone.rate) return null;
  const table = band ? entriesForTime(zone.table, band) : zone.table;
  if (!table.length) return null;
  const entry = pickEntry(table, rng);
  const span = Math.max(0, entry.max - entry.min);
  const level = entry.min + Math.floor(rng.next() * (span + 1));
  return { species: entry.species, level, catchRate: entry.catchRate ?? 120 };
}
