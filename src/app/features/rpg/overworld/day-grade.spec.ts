import { describe, expect, it } from 'vitest';
import { dayGrade } from './pixi-overworld';

describe('dayGrade', () => {
  it('is fully clear in the middle of the day', () => {
    expect(dayGrade(12).alpha).toBe(0);
  });

  it('is deepest at midnight and keeps fireflies out in daylight', () => {
    expect(dayGrade(0).alpha).toBeCloseTo(0.45);
    expect(dayGrade(23).fire).toBe(1);
    expect(dayGrade(12).fire).toBe(0);
  });

  it('blends smoothly through dusk instead of stepping', () => {
    const a = dayGrade(18);
    const b = dayGrade(18.5);
    const c = dayGrade(19);
    expect(a.alpha).toBeLessThan(b.alpha);
    expect(b.alpha).toBeLessThan(c.alpha);
    expect(dayGrade(19).color).toBe(0xff9e5a);
  });

  it('never leaves its keyframe range', () => {
    for (let h = 0; h <= 24; h += 0.25) {
      const g = dayGrade(h);
      expect(g.alpha).toBeGreaterThanOrEqual(0);
      expect(g.alpha).toBeLessThanOrEqual(0.45);
      expect(g.color).toBeGreaterThanOrEqual(0);
      expect(g.color).toBeLessThanOrEqual(0xffffff);
    }
  });
});
