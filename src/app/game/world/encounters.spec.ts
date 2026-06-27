import { describe, expect, it } from 'vitest';
import { attemptCatch, catchChance, regionCaught, regionCompletion, rollEncounter } from './encounters';
import { regionById } from './regions';

const kanto = regionById('kanto')!;

describe('wild encounters', () => {
  it('rolls a deterministic encounter within the region dex range', () => {
    const a = rollEncounter(kanto, 5);
    const b = rollEncounter(kanto, 5);
    expect(a).toEqual(b);
    expect(a.dex).toBeGreaterThanOrEqual(kanto.dexStart);
    expect(a.dex).toBeLessThanOrEqual(kanto.dexEnd);
    expect(a.level).toBeGreaterThan(0);
  });

  it('improves catch odds with better balls (capped)', () => {
    const enc = rollEncounter(kanto, 'x');
    expect(catchChance(enc, 'ultra')).toBeGreaterThanOrEqual(catchChance(enc, 'poke'));
    expect(catchChance(enc, 'ultra')).toBeLessThanOrEqual(0.95);
  });

  it('resolves a catch against an explicit roll', () => {
    const enc = { dex: 25, name: '#25', level: 10, rarity: 'common' as const, catchRate: 0.7 };
    expect(attemptCatch(enc, 'poke', 0.1)).toBe(true);
    expect(attemptCatch(enc, 'poke', 0.99)).toBe(false);
  });

  it('computes region completion from the caught set', () => {
    const caught = new Set<number>([1, 2, 3]);
    expect(regionCaught(caught, kanto)).toBe(3);
    expect(regionCompletion(caught, kanto)).toBe(Math.round((3 / 151) * 100));
  });
});
