import { describe, expect, it } from 'vitest';
import { rateTeam } from './team-rating';

describe('rateTeam', () => {
  it('returns a zero rating for an empty team', () => {
    const r = rateTeam([]);
    expect(r.score).toBe(0);
    expect(r.grade).toBe('D');
    expect(r.offense).toBe(0);
    expect(r.defense).toBe(0);
  });

  it('counts offensive coverage from member STAB types', () => {
    // Fire hits grass/ice/bug/steel ≥2×.
    const r = rateTeam([{ name: 'charmander', types: ['fire'] }]);
    expect(r.offense).toBeGreaterThanOrEqual(4);
    expect(r.score).toBeGreaterThan(0);
  });

  it('counts defensive resistances across the roster', () => {
    const r = rateTeam([{ name: 'steelix', types: ['steel', 'ground'] }]);
    // Steel/Ground resists a large slice of the chart.
    expect(r.defense).toBeGreaterThan(5);
  });

  it('awards a higher grade to a broad, balanced team', () => {
    const broad = rateTeam([
      { name: 'a', types: ['fire'] },
      { name: 'b', types: ['water'] },
      { name: 'c', types: ['grass'] },
      { name: 'd', types: ['electric'] },
      { name: 'e', types: ['ice'] },
      { name: 'f', types: ['fighting'] },
    ]);
    const narrow = rateTeam([{ name: 'a', types: ['normal'] }]);
    expect(broad.score).toBeGreaterThan(narrow.score);
  });
});
