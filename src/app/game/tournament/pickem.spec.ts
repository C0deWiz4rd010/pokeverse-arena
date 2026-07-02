import { describe, expect, it } from 'vitest';
import {
  PICKEM_BASE,
  PICKEM_MAX_MULT,
  PICKEM_MIN_MULT,
  pickProbability,
  pickemMultiplier,
  pickemPayout,
} from './pickem';

describe('pick’em', () => {
  const even = [100, 100, 100, 100];

  it('spreads probability evenly over an even field (and sums to 1)', () => {
    expect(pickProbability(100, even)).toBeCloseTo(0.25);
    const sum = even.reduce((s, p) => s + pickProbability(p, even), 0);
    expect(sum).toBeCloseTo(1);
  });

  it('gives the stronger team the higher implied probability', () => {
    const field = [140, 100, 90, 80];
    expect(pickProbability(140, field)).toBeGreaterThan(pickProbability(80, field));
  });

  it('pays longshots more than favourites, clamped to the multiplier band', () => {
    const field = [200, 100, 100, 40];
    const fav = pickemMultiplier(200, field);
    const dog = pickemMultiplier(40, field);
    expect(dog).toBeGreaterThan(fav);
    expect(fav).toBeGreaterThanOrEqual(PICKEM_MIN_MULT);
    expect(dog).toBeLessThanOrEqual(PICKEM_MAX_MULT);
    // Degenerate field: no power information → maximum multiplier.
    expect(pickemMultiplier(0, [])).toBe(PICKEM_MAX_MULT);
  });

  it('payout is the base bonus times the multiplier', () => {
    const field = [100, 100];
    expect(pickemPayout(100, field)).toBe(PICKEM_BASE * pickemMultiplier(100, field));
  });
});
