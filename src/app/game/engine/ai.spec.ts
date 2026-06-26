import { describe, expect, it } from 'vitest';
import { SeededRng } from '../../core/utils/rng';
import { chooseAiMove, estimateDamage, type AiContext } from './ai';
import { freshField, freshVolatiles, type Battler, type BattleMove, type BattleSide } from './battle-types';
import { freshStages } from './stat-stages';

const tackle: BattleMove = { name: 'Tackle', type: 'normal', power: 40, accuracy: 100, damageClass: 'physical' };
const ember: BattleMove = { name: 'Ember', type: 'fire', power: 40, accuracy: 100, damageClass: 'special' };
const quickKo: BattleMove = { name: 'Quick KO', type: 'normal', power: 200, accuracy: 100, damageClass: 'physical', priority: 1 };
const bigKo: BattleMove = { name: 'Big KO', type: 'normal', power: 200, accuracy: 100, damageClass: 'physical' };
const swordsDance: BattleMove = { name: 'Swords Dance', type: 'normal', power: 0, accuracy: 0, damageClass: 'status', boosts: { attack: 2 } };

function battler(o: Partial<Battler>): Battler {
  return {
    id: 1,
    name: 'Mon',
    level: 50,
    types: ['normal'],
    stats: { hp: 150, attack: 120, defense: 80, 'special-attack': 120, 'special-defense': 80, speed: 100 },
    moves: [tackle],
    ...o,
  };
}

function side(b: Battler, hp = b.stats.hp): BattleSide {
  return {
    battler: b,
    currentHp: hp,
    maxHp: b.stats.hp,
    pp: b.moves.map(() => Infinity),
    status: 'none',
    sleepTurns: 0,
    toxicCounter: 0,
    stages: freshStages(),
    volatiles: freshVolatiles(),
    itemUsed: false,
  };
}

function ctx(attacker: Battler, defender: Battler, defHp?: number): AiContext {
  return {
    attacker: side(attacker),
    defender: side(defender, defHp),
    field: freshField(),
    rng: new SeededRng('ai-test'),
  };
}

describe('chooseAiMove', () => {
  it('basic tier prefers the super-effective move (legacy behaviour)', () => {
    const c = ctx(battler({ types: ['fire'], moves: [tackle, ember] }), battler({ types: ['grass'] }));
    expect(chooseAiMove(c, 'basic')).toBe(1);
  });

  it('random tier returns a valid move index', () => {
    const c = ctx(battler({ moves: [tackle, ember] }), battler({}));
    const idx = chooseAiMove(c, 'random');
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(idx).toBeLessThan(2);
  });

  it('strong tier takes a guaranteed KO over chip damage', () => {
    const c = ctx(battler({ moves: [tackle, bigKo] }), battler({ defense: 60 }), 40);
    expect(chooseAiMove(c, 'strong')).toBe(1);
  });

  it('strong tier prefers a priority finisher when it KOs', () => {
    const c = ctx(battler({ moves: [bigKo, quickKo] }), battler({ defense: 60 }), 40);
    expect(chooseAiMove(c, 'strong')).toBe(1); // quickKo has +1 priority
  });

  it('strong tier values setup when it cannot threaten a KO yet', () => {
    // Foe is a huge wall at full HP; chip is futile, so set up instead.
    const c = ctx(battler({ moves: [tackle, swordsDance], attack: 60 }), battler({ defense: 250, hp: 600 }), 600);
    expect(chooseAiMove(c, 'strong')).toBe(1);
  });
});

describe('estimateDamage', () => {
  it('is zero for status moves', () => {
    const c = ctx(battler({ moves: [swordsDance] }), battler({}));
    expect(estimateDamage(swordsDance, c)).toBe(0);
  });

  it('is positive for a connecting attack', () => {
    const c = ctx(battler({ moves: [tackle] }), battler({}));
    expect(estimateDamage(tackle, c)).toBeGreaterThan(0);
  });
});
