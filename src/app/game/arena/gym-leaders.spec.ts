import { describe, expect, it } from 'vitest';
import { GYM_LEADERS, leaderByType } from './gym-leaders';
import { POKEMON_TYPES } from '../../core/utils/type-chart';

describe('gym leaders', () => {
  it('fields exactly one leader per Pokémon type', () => {
    expect(GYM_LEADERS).toHaveLength(POKEMON_TYPES.length);
    const types = new Set(GYM_LEADERS.map((l) => l.type));
    expect(types.size).toBe(POKEMON_TYPES.length);
    for (const t of POKEMON_TYPES) expect(types.has(t)).toBe(true);
  });

  it('gives every leader a unique name and badge', () => {
    const names = new Set(GYM_LEADERS.map((l) => l.name));
    const badges = new Set(GYM_LEADERS.map((l) => l.badge));
    expect(names.size).toBe(GYM_LEADERS.length);
    expect(badges.size).toBe(GYM_LEADERS.length);
  });

  it('looks up a leader by type', () => {
    expect(leaderByType('fire')?.name).toBe('Pyra');
    expect(leaderByType('water')?.type).toBe('water');
  });
});
