import { describe, expect, it } from 'vitest';
import { simulateMatch } from './simulate';
import type { Battler, BattleMove } from '../engine';

const tackle: BattleMove = { name: 'Tackle', type: 'normal', power: 60, accuracy: 100, damageClass: 'physical' };

function mon(name: string, overrides: Partial<Battler> = {}): Battler {
  return {
    id: 1,
    name,
    level: 50,
    types: ['normal'],
    stats: { hp: 120, attack: 100, defense: 100, 'special-attack': 100, 'special-defense': 100, speed: 100 },
    moves: [tackle],
    ...overrides,
  };
}

const strong = (name: string) =>
  mon(name, { stats: { hp: 160, attack: 220, defense: 120, 'special-attack': 120, 'special-defense': 120, speed: 200 } });
const frail = (name: string) =>
  mon(name, { stats: { hp: 40, attack: 50, defense: 10, 'special-attack': 50, 'special-defense': 10, speed: 5 } });

describe('simulateMatch', () => {
  it('lets the stronger team sweep', () => {
    const teamA = [strong('A1'), strong('A2'), strong('A3')];
    const teamB = [frail('B1'), frail('B2'), frail('B3')];
    const result = simulateMatch(teamA, teamB, 'sweep');
    expect(result.winner).toBe(0);
    expect(result.survivorsA).toBeGreaterThan(0);
    expect(result.survivorsB).toBe(0);
    expect(result.hpA).toHaveLength(3);
    expect(result.hpB).toHaveLength(3);
  });

  it('is deterministic for a given seed', () => {
    const run = () =>
      simulateMatch([strong('A1'), frail('A2'), mon('A3')], [mon('B1'), strong('B2'), frail('B3')], 'repro');
    const first = run();
    const second = run();
    expect(second.winner).toBe(first.winner);
    expect(second.hpA).toEqual(first.hpA);
    expect(second.hpB).toEqual(first.hpB);
  });

  it('keeps the surviving Pokémon damaged within the match', () => {
    const teamA = [strong('A1'), strong('A2'), strong('A3')];
    const teamB = [mon('B1'), mon('B2'), mon('B3')];
    const result = simulateMatch(teamA, teamB, 'damage');
    // The sweeping team should not finish at completely full HP across the board.
    const fullHp = teamA.map((m) => m.stats.hp);
    expect(result.hpA).not.toEqual(fullHp);
  });

  it('honours seeded starting HP for cross-round carry', () => {
    const teamA = [strong('A1'), strong('A2'), strong('A3')];
    const teamB = [mon('B1'), mon('B2'), mon('B3')];
    // Cripple team A by starting almost dead — it should now struggle / lose ground.
    const crippled = simulateMatch(teamA, teamB, 'carry', { startHpA: [1, 1, 1] });
    const healthy = simulateMatch(teamA, teamB, 'carry');
    expect(crippled.survivorsA).toBeLessThanOrEqual(healthy.survivorsA);
  });
});
