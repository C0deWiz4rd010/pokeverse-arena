import { describe, expect, it } from 'vitest';
import { teamPower, winOdds } from './odds';
import type { Battler } from '../engine';

function battler(bst: number, level = 50): Battler {
  const each = Math.round(bst / 6);
  return {
    id: 1,
    name: 'mon',
    level,
    types: ['normal'],
    stats: { hp: each, atk: each, def: each, spa: each, spd: each, spe: each },
    moves: [],
  };
}

describe('teamPower', () => {
  it('is zero for an empty team', () => {
    expect(teamPower([])).toBe(0);
  });

  it('scales with base stats and level', () => {
    const weak = [battler(300, 50)];
    const strong = [battler(600, 50)];
    expect(teamPower(strong)).toBeGreaterThan(teamPower(weak));
    const lowLvl = [battler(500, 25)];
    const highLvl = [battler(500, 75)];
    expect(teamPower(highLvl)).toBeGreaterThan(teamPower(lowLvl));
  });
});

describe('winOdds', () => {
  it('is ~50% for evenly matched teams', () => {
    const odds = winOdds([battler(500)], [battler(500)]);
    expect(odds).toBeGreaterThanOrEqual(45);
    expect(odds).toBeLessThanOrEqual(55);
  });

  it('favours the stronger team', () => {
    expect(winOdds([battler(600)], [battler(350)])).toBeGreaterThan(60);
    expect(winOdds([battler(350)], [battler(600)])).toBeLessThan(40);
  });

  it('never reports a certainty', () => {
    expect(winOdds([battler(700)], [battler(200)])).toBeLessThanOrEqual(95);
    expect(winOdds([battler(200)], [battler(700)])).toBeGreaterThanOrEqual(5);
  });

  it('handles two empty teams as a coin flip', () => {
    expect(winOdds([], [])).toBe(50);
  });
});
