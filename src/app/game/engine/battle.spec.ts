import { describe, expect, it } from 'vitest';
import { Battle } from './battle';
import type { Battler, BattleMove } from './battle-types';

const tackle: BattleMove = { name: 'Tackle', type: 'normal', power: 40, accuracy: 100, damageClass: 'physical' };
const ember: BattleMove = { name: 'Ember', type: 'fire', power: 40, accuracy: 100, damageClass: 'special' };
const quickAttack: BattleMove = { name: 'Quick Attack', type: 'normal', power: 40, accuracy: 100, damageClass: 'physical', priority: 1 };
const vineWhip: BattleMove = { name: 'Vine Whip', type: 'grass', power: 45, accuracy: 100, damageClass: 'physical' };

function mk(overrides: Partial<Battler>): Battler {
  return {
    id: 1,
    name: 'Mon',
    level: 50,
    types: ['normal'],
    stats: { hp: 120, attack: 100, defense: 100, 'special-attack': 100, 'special-defense': 100, speed: 100 },
    moves: [tackle],
    ...overrides,
  };
}

describe('Battle', () => {
  it('initialises both sides at full HP', () => {
    const b = new Battle(mk({ name: 'A' }), mk({ name: 'B' }), 'seed');
    expect(b.player.currentHp).toBe(b.player.maxHp);
    expect(b.opponent.currentHp).toBe(120);
    expect(b.state.turn).toBe(0);
    expect(b.state.finished).toBe(false);
  });

  it('is deterministic for a given seed', () => {
    const run = () => {
      const b = new Battle(
        mk({ name: 'Fast', stats: { ...mk({}).stats, speed: 200 } }),
        mk({ name: 'Slow' }),
        'reproducible',
      );
      const log: number[] = [];
      while (!b.state.finished && b.state.turn < 50) {
        b.takeTurn(0);
        log.push(b.opponent.currentHp, b.player.currentHp);
      }
      return log;
    };
    expect(run()).toEqual(run());
  });

  it('lets the faster Pokémon move first', () => {
    const fast = mk({ name: 'Fast', stats: { ...mk({}).stats, speed: 300, attack: 250 } });
    const slow = mk({ name: 'Slow', stats: { ...mk({}).stats, speed: 1, hp: 60 } });
    const b = new Battle(fast, slow, 'order');
    const events = b.takeTurn(0);
    const firstMove = events.find((e) => e.kind === 'move');
    expect(firstMove).toMatchObject({ side: 0, attacker: 'Fast' });
  });

  it('honours move priority over speed', () => {
    const slowButPriority = mk({ name: 'Priority', moves: [quickAttack], stats: { ...mk({}).stats, speed: 1 } });
    const fast = mk({ name: 'Fast', stats: { ...mk({}).stats, speed: 300 } });
    const b = new Battle(slowButPriority, fast, 'prio');
    const events = b.takeTurn(0);
    const firstMove = events.find((e) => e.kind === 'move');
    expect(firstMove).toMatchObject({ attacker: 'Priority' });
  });

  it('ends the battle and records a winner on faint', () => {
    const strong = mk({ name: 'Strong', stats: { ...mk({}).stats, attack: 255, speed: 200 } });
    const frail = mk({ name: 'Frail', stats: { ...mk({}).stats, hp: 10, defense: 1, speed: 1 } });
    const b = new Battle(strong, frail, 'ko');
    const events = b.takeTurn(0);
    expect(b.state.finished).toBe(true);
    expect(b.state.winner).toBe(0);
    expect(events.some((e) => e.kind === 'faint')).toBe(true);
    expect(events.some((e) => e.kind === 'end')).toBe(true);
  });

  it('no-ops once finished', () => {
    const strong = mk({ name: 'Strong', stats: { ...mk({}).stats, attack: 255, speed: 200 } });
    const frail = mk({ name: 'Frail', stats: { ...mk({}).stats, hp: 10, defense: 1, speed: 1 } });
    const b = new Battle(strong, frail, 'ko');
    b.takeTurn(0);
    expect(b.takeTurn(0)).toEqual([]);
  });

  it('AI prefers a super-effective move', () => {
    const grassFoe = mk({ name: 'Grassy', types: ['grass'] });
    const ai = mk({ name: 'AI', types: ['fire'], moves: [tackle, ember] }); // ember 2x vs grass
    const b = new Battle(grassFoe, ai, 'ai');
    expect(b.chooseAiMove()).toBe(1); // index of ember
  });

  it('applies type immunity (no damage to a Ghost from Normal)', () => {
    const ghost = mk({ name: 'Ghost', types: ['ghost'], stats: { ...mk({}).stats, speed: 1 } });
    const normal = mk({ name: 'Normal', moves: [tackle], stats: { ...mk({}).stats, speed: 300 } });
    const b = new Battle(normal, ghost, 'immune');
    b.takeTurn(0);
    expect(b.opponent.currentHp).toBe(b.opponent.maxHp);
  });

  it('tracks PP when a move defines it', () => {
    const limited: BattleMove = { ...vineWhip, pp: 5 };
    const a = mk({ name: 'A', moves: [limited], stats: { ...mk({}).stats, speed: 300 } });
    const foe = mk({ name: 'B', stats: { ...mk({}).stats, hp: 999 } });
    const b = new Battle(a, foe, 'pp');
    b.takeTurn(0);
    expect(b.player.pp[0]).toBe(4);
  });
});
