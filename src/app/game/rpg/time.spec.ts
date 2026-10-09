import { describe, expect, it } from 'vitest';
import { dayGrade, timeBand, timeOfDay } from './time';

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
    const a = dayGrade(17.5);
    const b = dayGrade(18);
    const c = dayGrade(18.5);
    expect(a.alpha).toBeLessThan(b.alpha);
    expect(b.alpha).toBeLessThan(c.alpha);
    expect(dayGrade(18.5).color).toBe(0xff9e5a);
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

describe('timeOfDay / timeBand agree', () => {
  it('names the four moods', () => {
    expect(timeOfDay(2)).toBe('night');
    expect(timeOfDay(6)).toBe('dawn');
    expect(timeOfDay(12)).toBe('day');
    expect(timeOfDay(18)).toBe('dusk');
    expect(timeOfDay(22)).toBe('night');
  });

  it('the encounter band is night exactly when the picture is (nearly) dark', () => {
    for (let h = 0; h < 24; h++) {
      const dark = dayGrade(h).alpha >= 0.4;
      if (timeBand(h) === 'night' && (h >= 21 || h < 5)) expect(dark).toBe(true);
      if (timeBand(h) === 'day' && h >= 8 && h < 17) expect(dark).toBe(false);
    }
  });
});
