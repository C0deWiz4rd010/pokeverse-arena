/**
 * Daily forage spots — berry bushes dotted around the world that yield one
 * item per spot per real day. Loot is seeded on (day, spot), so every trainer
 * finds the same berry on the same bush — and tomorrow the bushes refill.
 * Pure state helpers + loot table; the save carries `{ day, taken[] }`.
 */
import { SeededRng } from '../../core/utils/rng';
import type { ItemId } from './rpg-types';

export interface ForageState {
  /** Day-key the `taken` list belongs to (stale lists reset automatically). */
  readonly day: string;
  readonly taken: readonly string[];
}

/** Local-date key, e.g. "2026-07-19" — bushes refill at local midnight. */
export function forageDay(now: Date = new Date()): string {
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${m}-${d}`;
}

export function forageId(mapId: string, x: number, y: number): string {
  return `${mapId}:${x},${y}`;
}

/** True when the spot still holds today's berry. */
export function canForage(state: ForageState | undefined, id: string, day: string): boolean {
  if (!state || state.day !== day) return true; // new day → every bush refilled
  return !state.taken.includes(id);
}

/** Mark a spot as picked today (a stale day resets the list first). */
export function collectForage(state: ForageState | undefined, id: string, day: string): ForageState {
  const taken = state && state.day === day ? state.taken : [];
  return { day, taken: [...taken, id] };
}

const LOOT: readonly { item: ItemId; weight: number }[] = [
  { item: 'poke-ball', weight: 4 },
  { item: 'potion', weight: 3 },
  { item: 'sitrus-berry', weight: 2 },
  { item: 'lum-berry', weight: 2 },
  { item: 'super-potion', weight: 1 },
  { item: 'great-ball', weight: 1 },
];

/** Deterministic loot for a spot on a day — identical for every trainer. */
export function forageLoot(id: string, day: string): ItemId {
  const rng = new SeededRng(`forage-${day}-${id}`);
  const total = LOOT.reduce((s, l) => s + l.weight, 0);
  let r = rng.next() * total;
  for (const l of LOOT) {
    r -= l.weight;
    if (r <= 0) return l.item;
  }
  return LOOT[0].item;
}
