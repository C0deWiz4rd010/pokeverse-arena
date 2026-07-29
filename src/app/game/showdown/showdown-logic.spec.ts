import { describe, expect, it } from 'vitest';
import {
  SHOWDOWN_STATS,
  isCorrect,
  shareText,
  statValue,
  winnerSide,
  type ShowdownMon,
} from './showdown-logic';

function mon(id: number, over: Partial<ShowdownMon> = {}): ShowdownMon {
  return {
    id,
    name: `mon-${id}`,
    artwork: '',
    types: ['normal'],
    stats: {
      hp: 50,
      attack: 50,
      defense: 50,
      'special-attack': 50,
      'special-defense': 50,
      speed: 50,
    },
    bst: 300,
    ...over,
  };
}

describe('showdown-logic', () => {
  it('exposes seven duel stats including BST', () => {
    expect(SHOWDOWN_STATS).toHaveLength(7);
    expect(SHOWDOWN_STATS.some((s) => s.key === 'bst')).toBe(true);
  });

  it('statValue reads regular stats and the synthetic BST', () => {
    const m = mon(1, { stats: { ...mon(1).stats, speed: 120 }, bst: 480 });
    expect(statValue(m, 'speed')).toBe(120);
    expect(statValue(m, 'bst')).toBe(480);
  });

  it('winnerSide picks the higher value and flags ties', () => {
    const l = mon(1, { stats: { ...mon(1).stats, attack: 100 } });
    const r = mon(2, { stats: { ...mon(2).stats, attack: 60 } });
    expect(winnerSide(l, r, 'attack')).toBe('left');
    expect(winnerSide(r, l, 'attack')).toBe('right');
    expect(winnerSide(l, l, 'attack')).toBe('tie');
  });

  it('isCorrect rewards the right pick and always counts ties', () => {
    const l = mon(1, { stats: { ...mon(1).stats, speed: 90 } });
    const r = mon(2, { stats: { ...mon(2).stats, speed: 40 } });
    expect(isCorrect('left', l, r, 'speed')).toBe(true);
    expect(isCorrect('right', l, r, 'speed')).toBe(false);
    // equal speed → either pick counts
    expect(isCorrect('right', l, l, 'speed')).toBe(true);
  });

  it('shareText reflects the streak length in the bar', () => {
    const text = shareText(3, 7);
    expect(text).toContain('Streak: 3 (best 7)');
    expect(text).toContain('🟩🟩🟩');
  });
});
