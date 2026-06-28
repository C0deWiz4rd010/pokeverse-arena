import { describe, expect, it } from 'vitest';
import { applyXp, levelFromXp, xpForLevel, xpProgress, xpYield } from './xp';

describe('xp curve', () => {
  it('uses medium-fast n^3 thresholds', () => {
    expect(xpForLevel(1)).toBe(1);
    expect(xpForLevel(5)).toBe(125);
    expect(xpForLevel(10)).toBe(1000);
  });

  it('maps total xp back to a level', () => {
    expect(levelFromXp(0)).toBe(1);
    expect(levelFromXp(124)).toBe(4);
    expect(levelFromXp(125)).toBe(5);
    expect(levelFromXp(1000)).toBe(10);
  });

  it('awards xp from a defeated foe', () => {
    expect(xpYield(64, 7)).toBe(64); // 64*7/7
    expect(xpYield(0, 0)).toBe(1); // never zero
  });
});

describe('applyXp', () => {
  it('levels up when crossing a threshold and lists the levels gained', () => {
    const r = applyXp(xpForLevel(5), 5, 1000 - 125); // from L5 floor, gain enough to reach L10
    expect(r.level).toBe(10);
    expect(r.leveledTo).toEqual([6, 7, 8, 9, 10]);
    expect(r.xp).toBe(1000);
  });

  it('stays put without enough xp', () => {
    const r = applyXp(xpForLevel(5), 5, 10);
    expect(r.level).toBe(5);
    expect(r.leveledTo).toEqual([]);
  });

  it('caps at level 100', () => {
    const r = applyXp(xpForLevel(100), 100, 999999);
    expect(r.level).toBe(100);
    expect(r.leveledTo).toEqual([]);
  });
});

describe('xpProgress', () => {
  it('reports progress through the current band', () => {
    const p = xpProgress(xpForLevel(5), 5);
    expect(p.into).toBe(0);
    expect(p.pct).toBe(0);
    const mid = xpProgress(xpForLevel(5) + Math.floor((xpForLevel(6) - xpForLevel(5)) / 2), 5);
    expect(mid.pct).toBeGreaterThanOrEqual(49);
    expect(mid.pct).toBeLessThanOrEqual(51);
  });
});
