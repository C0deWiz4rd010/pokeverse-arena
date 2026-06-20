import { describe, expect, it } from 'vitest';
import { SeededRng, dailySeed } from './rng';

describe('SeededRng', () => {
  it('is deterministic for the same numeric seed', () => {
    const a = new SeededRng(12345);
    const b = new SeededRng(12345);
    const seqA = Array.from({ length: 5 }, () => a.next());
    const seqB = Array.from({ length: 5 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('is deterministic for the same string seed', () => {
    const a = new SeededRng('pikachu');
    const b = new SeededRng('pikachu');
    expect(a.int(1, 100)).toBe(b.int(1, 100));
  });

  it('produces different sequences for different seeds', () => {
    const a = new SeededRng(1);
    const b = new SeededRng(2);
    expect(a.next()).not.toBe(b.next());
  });

  it('stays within bounds for int()', () => {
    const rng = new SeededRng('bounds');
    for (let i = 0; i < 1000; i++) {
      const value = rng.int(3, 7);
      expect(value).toBeGreaterThanOrEqual(3);
      expect(value).toBeLessThanOrEqual(7);
    }
  });

  it('shuffle keeps the same elements', () => {
    const rng = new SeededRng('shuffle');
    const input = [1, 2, 3, 4, 5];
    const output = rng.shuffle(input);
    expect(output).toHaveLength(5);
    expect([...output].sort()).toEqual(input);
  });

  it('dailySeed is stable within a day', () => {
    expect(dailySeed('x')).toBe(dailySeed('x'));
  });
});
