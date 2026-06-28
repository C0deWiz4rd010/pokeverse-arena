import { describe, expect, it } from 'vitest';
import { SeededRng } from '../../core/utils/rng';
import { attemptCatch, catchChance } from './catch';

describe('catchChance', () => {
  it('rises as HP drops', () => {
    const full = catchChance(120, 1, 'none', 'poke-ball');
    const low = catchChance(120, 0.05, 'none', 'poke-ball');
    expect(low).toBeGreaterThan(full);
  });

  it('rewards status and better balls', () => {
    const base = catchChance(120, 0.5, 'none', 'poke-ball');
    expect(catchChance(120, 0.5, 'sleep', 'poke-ball')).toBeGreaterThan(base);
    expect(catchChance(120, 0.5, 'none', 'ultra-ball')).toBeGreaterThan(base);
  });

  it('clamps to a sane range', () => {
    expect(catchChance(255, 0.01, 'sleep', 'ultra-ball')).toBeLessThanOrEqual(0.98);
    expect(catchChance(1, 1, 'none', 'poke-ball')).toBeGreaterThanOrEqual(0.02);
  });

  it('is deterministic for a seed', () => {
    const a = attemptCatch(120, 0.3, 'none', 'great-ball', new SeededRng('c'));
    const b = attemptCatch(120, 0.3, 'none', 'great-ball', new SeededRng('c'));
    expect(a).toBe(b);
  });
});
