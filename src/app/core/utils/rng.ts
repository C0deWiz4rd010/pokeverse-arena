/**
 * Deterministic, seedable pseudo-random number generator (mulberry32).
 *
 * A seeded RNG makes battles reproducible: the same seed + same inputs always
 * produce the same battle log, which powers "daily challenges" and replays.
 */
export class SeededRng {
  private state: number;

  constructor(seed: number | string) {
    this.state = typeof seed === 'string' ? SeededRng.hashString(seed) : seed >>> 0;
  }

  /** Float in [0, 1). */
  next(): number {
    this.state |= 0;
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  /** True with the given probability (0..1). */
  chance(probability: number): boolean {
    return this.next() < probability;
  }

  /** Random element of a non-empty array. */
  pick<T>(items: readonly T[]): T {
    return items[this.int(0, items.length - 1)];
  }

  /** A fresh in-place Fisher–Yates shuffle. */
  shuffle<T>(items: readonly T[]): T[] {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  static hashString(value: string): number {
    let h = 1779033703 ^ value.length;
    for (let i = 0; i < value.length; i++) {
      h = Math.imul(h ^ value.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return h >>> 0;
  }
}

/** Build a stable daily seed string (e.g. for the daily random battle). */
export function dailySeed(prefix = 'daily'): string {
  const today = new Date().toISOString().slice(0, 10);
  return `${prefix}-${today}`;
}
