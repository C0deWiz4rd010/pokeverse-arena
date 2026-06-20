import { describe, expect, it } from 'vitest';
import {
  CONTEST_CATEGORIES,
  appealScore,
  categoryForFlavor,
  flavorForCategory,
  mixConditions,
  runContest,
  type Berry,
} from './contest';
import { SeededRng } from '../../core/utils/rng';

function berry(name: string, flavors: Partial<Berry['flavors']>): Berry {
  return {
    name,
    flavors: { spicy: 0, dry: 0, sweet: 0, bitter: 0, sour: 0, ...flavors },
  };
}

describe('contest', () => {
  it('maps every flavour to a category and back', () => {
    expect(CONTEST_CATEGORIES).toHaveLength(5);
    expect(categoryForFlavor('spicy')).toBe('cool');
    expect(flavorForCategory('tough')).toBe('sour');
    for (const c of CONTEST_CATEGORIES) {
      expect(categoryForFlavor(c.flavor)).toBe(c.key);
    }
  });

  it('sums a berry mix into contest conditions', () => {
    const mix = [
      berry('Cheri', { spicy: 10 }),
      berry('Pecha', { sweet: 10 }),
      berry('Leppa', { spicy: 10, sweet: 10 }),
    ];
    const cond = mixConditions(mix);
    expect(cond.cool).toBe(20); // two spicy berries
    expect(cond.cute).toBe(20); // two sweet berries
    expect(cond.beauty).toBe(0);
  });

  it('rewards higher conditions with a higher appeal score', () => {
    const low = mixConditions([berry('Cheri', { spicy: 10 })]);
    const high = mixConditions([
      berry('Cheri', { spicy: 40 }),
      berry('Tamato', { spicy: 40 }),
    ]);
    const lowScore = appealScore(low, 'cool', 1, new SeededRng('x'));
    const highScore = appealScore(high, 'cool', 2, new SeededRng('x'));
    expect(highScore).toBeGreaterThan(lowScore);
  });

  it('runs a deterministic, fully-ranked contest', () => {
    const cond = mixConditions([
      berry('A', { spicy: 50 }),
      berry('B', { spicy: 50 }),
    ]);
    const a = runContest('Star', cond, 'cool', 2, 'seed-1');
    const b = runContest('Star', cond, 'cool', 2, 'seed-1');
    expect(a).toEqual(b);
    expect(a.ranking).toHaveLength(4);
    expect(a.ranking[0].score).toBeGreaterThanOrEqual(a.ranking[3].score);
    expect(a.playerRank).toBeGreaterThanOrEqual(1);
  });
});
