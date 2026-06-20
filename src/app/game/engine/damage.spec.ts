import { describe, expect, it } from 'vitest';
import { computeDamage, resolveDamage, stabFor, moveEffectiveness } from './damage';
import type { Battler, BattleMove } from './battle-types';

const tackle: BattleMove = { name: 'Tackle', type: 'normal', power: 40, accuracy: 100, damageClass: 'physical' };
const ember: BattleMove = { name: 'Ember', type: 'fire', power: 40, accuracy: 100, damageClass: 'special' };

function battler(overrides: Partial<Battler> = {}): Battler {
  return {
    id: 1,
    name: 'Test',
    level: 50,
    types: ['normal'],
    stats: {
      hp: 150,
      attack: 100,
      defense: 100,
      'special-attack': 100,
      'special-defense': 100,
      speed: 100,
    },
    moves: [tackle],
    ...overrides,
  };
}

describe('computeDamage', () => {
  it('returns 0 for status moves (power 0)', () => {
    const r = computeDamage({
      level: 50, power: 0, attack: 100, defense: 100,
      stab: 1, typeEffectiveness: 1, crit: false, roll: 1,
    });
    expect(r.damage).toBe(0);
  });

  it('returns 0 against immune types regardless of power', () => {
    const r = computeDamage({
      level: 50, power: 120, attack: 200, defense: 50,
      stab: 1.5, typeEffectiveness: 0, crit: true, roll: 1,
    });
    expect(r.damage).toBe(0);
  });

  it('deals at least 1 damage on a connecting hit', () => {
    const r = computeDamage({
      level: 1, power: 1, attack: 1, defense: 255,
      stab: 1, typeEffectiveness: 0.25, crit: false, roll: 0.85,
    });
    expect(r.damage).toBeGreaterThanOrEqual(1);
  });

  it('scales up with crit, STAB and super-effectiveness', () => {
    const base = computeDamage({
      level: 50, power: 80, attack: 120, defense: 80,
      stab: 1, typeEffectiveness: 1, crit: false, roll: 1,
    }).damage;
    const boosted = computeDamage({
      level: 50, power: 80, attack: 120, defense: 80,
      stab: 1.5, typeEffectiveness: 2, crit: true, roll: 1,
    }).damage;
    expect(boosted).toBeGreaterThan(base * 3); // 1.5 * 2 * 1.5 = 4.5x
  });

  it('min roll is lower than max roll', () => {
    const common = { level: 50, power: 80, attack: 120, defense: 80, stab: 1, typeEffectiveness: 1, crit: false };
    const min = computeDamage({ ...common, roll: 0.85 }).damage;
    const max = computeDamage({ ...common, roll: 1 }).damage;
    expect(min).toBeLessThan(max);
  });
});

describe('damage helpers', () => {
  it('applies STAB only when the move shares the attacker type', () => {
    expect(stabFor(battler({ types: ['fire'] }), ember)).toBe(1.5);
    expect(stabFor(battler({ types: ['water'] }), ember)).toBe(1);
  });

  it('reads type effectiveness from the chart', () => {
    expect(moveEffectiveness(ember, ['grass'])).toBe(2);
    expect(moveEffectiveness(ember, ['water'])).toBe(0.5);
  });

  it('resolveDamage uses special stats for special moves', () => {
    const attacker = battler({ types: ['fire'], stats: { ...battler().stats, attack: 10, 'special-attack': 200 } });
    const defender = battler({ types: ['grass'] });
    const r = resolveDamage(attacker, defender, ember, false, 1);
    expect(r.effectiveness).toBe(2);
    expect(r.stab).toBe(1.5);
    expect(r.damage).toBeGreaterThan(0);
  });
});
