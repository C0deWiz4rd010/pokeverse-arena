/**
 * Time-of-day for the Adventure overworld. A tiny pure helper shared by the
 * encounter roller (which wilds appear) and the renderer (day/night tint), so
 * the world you see matches the world you catch.
 */
export type TimeBand = 'day' | 'night';

/** Day runs 6:00–19:59; night is the rest. */
export function timeBand(hour: number = new Date().getHours()): TimeBand {
  return hour >= 6 && hour < 20 ? 'day' : 'night';
}
