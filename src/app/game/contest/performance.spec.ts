import { describe, expect, it } from 'vitest';
import {
  APPEAL_MOVES,
  PERFORMANCE_ROUNDS,
  appeal,
  performanceRanking,
  startPerformance,
  wouldCombo,
} from './performance';
import { mixConditions, type Conditions } from './contest';

const FLAT: Conditions = { cool: 0, beauty: 0, cute: 0, smart: 0, tough: 0 };

describe('appeal moves', () => {
  it('defines one move per category with a cyclic combo chain', () => {
    expect(Object.keys(APPEAL_MOVES)).toHaveLength(5);
    // beauty combos after cool; cool combos after tough (cycle).
    expect(APPEAL_MOVES.beauty.comboAfter).toBe('cool');
    expect(APPEAL_MOVES.cool.comboAfter).toBe('tough');
    expect(wouldCombo('cool', 'beauty')).toBe(true);
    expect(wouldCombo('cute', 'beauty')).toBe(false);
    expect(wouldCombo(null, 'beauty')).toBe(false);
  });
});

describe('performance flow', () => {
  it('runs a fixed number of rounds then finishes', () => {
    let s = startPerformance('normal', 'seed');
    expect(s.rivals).toHaveLength(3);
    for (let i = 0; i < PERFORMANCE_ROUNDS; i++) {
      expect(s.finished).toBe(false);
      s = appeal(s, 'cool', FLAT, 'cool', 'normal', 'seed');
    }
    expect(s.finished).toBe(true);
    expect(s.history).toHaveLength(PERFORMANCE_ROUNDS);
    expect(s.round).toBeGreaterThan(s.rounds);
  });

  it('is deterministic for a seed + choices', () => {
    const run = () => {
      let s = startPerformance('normal', 'x');
      s = appeal(s, 'cool', FLAT, 'cool', 'normal', 'x');
      s = appeal(s, 'beauty', FLAT, 'cool', 'normal', 'x');
      return s;
    };
    expect(run()).toEqual(run());
  });

  it('rewards a combo and punishes repetition (boredom)', () => {
    let s = startPerformance('normal', 'combo');
    s = appeal(s, 'cool', FLAT, 'cool', 'normal', 'combo'); // round 1
    const comboRound = appeal(s, 'beauty', FLAT, 'beauty', 'normal', 'combo').history[1];
    expect(comboRound.combo).toBeGreaterThan(0);

    let r = startPerformance('normal', 'bore');
    r = appeal(r, 'cool', FLAT, 'cool', 'normal', 'bore');
    const repeat = appeal(r, 'cool', FLAT, 'cool', 'normal', 'bore').history[1];
    expect(repeat.boredom).toBeGreaterThan(0);
  });

  it('lets conditions from the Poffin mix boost matching appeals', () => {
    const cond = mixConditions([{ name: 'A', flavors: { spicy: 60, dry: 0, sweet: 0, bitter: 0, sour: 0 } }]);
    let s = startPerformance('normal', 'cond');
    const out = appeal(s, 'cool', cond, 'cool', 'normal', 'cond').history[0];
    expect(out.condition).toBeGreaterThan(0);
  });

  it('ranks the field once finished', () => {
    let s = startPerformance('normal', 'rank');
    for (let i = 0; i < PERFORMANCE_ROUNDS; i++) s = appeal(s, 'cool', FLAT, 'cool', 'normal', 'rank');
    const result = performanceRanking(s, 'Star');
    expect(result.ranking).toHaveLength(4);
    expect(result.playerRank).toBeGreaterThanOrEqual(1);
    expect(result.ranking[0].score).toBeGreaterThanOrEqual(result.ranking[3].score);
  });
});
