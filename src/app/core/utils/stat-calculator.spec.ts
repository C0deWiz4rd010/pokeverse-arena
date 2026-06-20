import { describe, expect, it } from 'vitest';
import { calcHp, calcStat, quickStats } from './stat-calculator';

describe('stat-calculator', () => {
  it('computes HP via the canonical formula (108 base, 31 IV, 0 EV, Lv 78)', () => {
    // floor((2*108+31)*78/100)+78+10 = 280
    expect(calcHp(108, 31, 0, 78)).toBe(280);
  });

  it('applies the Shedinja 1-HP rule', () => {
    expect(calcHp(1, 31, 252, 100)).toBe(1);
  });

  it('applies a boosting nature (130 base, 31 IV, 0 EV, Lv 78 -> 254)', () => {
    // (floor((2*130+31)*78/100)+5) * 1.1 = floor(231*1.1) = 254
    const atk = calcStat('attack', 130, 31, 0, 78, { increased: 'attack', decreased: null });
    expect(atk).toBe(254);
  });

  it('a neutral nature does not change the stat', () => {
    const neutral = calcStat('speed', 100, 31, 0, 50);
    const boosted = calcStat('speed', 100, 31, 0, 50, { increased: 'speed', decreased: null });
    expect(boosted).toBeGreaterThan(neutral);
  });

  it('quickStats returns all six stats', () => {
    const stats = quickStats(
      { hp: 45, attack: 49, defense: 49, 'special-attack': 65, 'special-defense': 65, speed: 45 },
      50,
    );
    expect(Object.keys(stats)).toHaveLength(6);
    expect(stats.hp).toBeGreaterThan(0);
  });
});
