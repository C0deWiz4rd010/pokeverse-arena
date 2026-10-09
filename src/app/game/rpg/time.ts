/**
 * Time-of-day for the Adventure overworld. A tiny pure helper shared by the
 * encounter roller (which wilds appear) and the renderer (day/night tint), so
 * the world you see matches the world you catch: both read the same hour keyframes below.
 */
export type TimeBand = 'day' | 'night';

/** Day runs 6:00–19:59; night is the rest. */
export function timeBand(hour: number = new Date().getHours()): TimeBand {
  return hour >= 6 && hour < 20 ? 'day' : 'night';
}

/** The four moods of the day — what a player would call it, for UI and flavour. */
export type TimeOfDay = 'night' | 'dawn' | 'day' | 'dusk';

export function timeOfDay(hour: number = new Date().getHours()): TimeOfDay {
  if (hour >= 20 || hour < 5) return 'night';
  if (hour < 8) return 'dawn';
  if (hour < 17) return 'day';
  return 'dusk';
}

/** Light grade keyed by clock hour; neighbours blend so dusk and dawn glide instead of stepping. */
const GRADE: readonly (readonly [hour: number, color: number, alpha: number, fire: number])[] = [
  [0, 0x2a3b7a, 0.45, 1], [5, 0x2a3b7a, 0.45, 1],   // night
  [6.5, 0x9a86c0, 0.22, 0.3],                         // dawn
  [8, 0xcfe0ff, 0.1, 0.1],                            // cool morning
  [10, 0xffffff, 0, 0], [15.5, 0xffffff, 0, 0],       // clear day
  [17, 0xffdca8, 0.12, 0.15],                         // golden hour
  [18.5, 0xff9e5a, 0.28, 0.4],                        // dusk
  [20.5, 0x2a3b7a, 0.45, 1], [24, 0x2a3b7a, 0.45, 1], // night again
];
export function dayGrade(hour: number): { color: number; alpha: number; fire: number } {
  let i = 1;
  while (i < GRADE.length - 1 && GRADE[i][0] < hour) i++;
  const [h0, c0, a0, f0] = GRADE[i - 1];
  const [h1, c1, a1, f1] = GRADE[i];
  const k = Math.min(1, Math.max(0, (hour - h0) / (h1 - h0)));
  const ch = (shift: number): number => Math.round(((c0 >> shift) & 255) * (1 - k) + ((c1 >> shift) & 255) * k);
  return { color: (ch(16) << 16) | (ch(8) << 8) | ch(0), alpha: a0 + (a1 - a0) * k, fire: f0 + (f1 - f0) * k };
}
