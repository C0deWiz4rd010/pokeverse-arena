import { describe, expect, it } from 'vitest';
import { SeededRng } from '../../core/utils/rng';
import { rollEncounter } from './encounters';
import type { EncounterZone } from './rpg-types';

const zone: EncounterZone = {
  rate: 1,
  table: [
    { species: 'pidgey', min: 2, max: 4, weight: 3 },
    { species: 'rattata', min: 3, max: 5, weight: 1 },
  ],
};

describe('rollEncounter', () => {
  it('returns null when the rate gate fails', () => {
    expect(rollEncounter({ ...zone, rate: 0 }, new SeededRng('x'))).toBeNull();
  });

  it('always rolls something at rate 1, within the level band', () => {
    const r = rollEncounter(zone, new SeededRng('a'));
    expect(r).not.toBeNull();
    expect(['pidgey', 'rattata']).toContain(r!.species);
    expect(r!.level).toBeGreaterThanOrEqual(2);
    expect(r!.level).toBeLessThanOrEqual(5);
  });

  it('is deterministic for a seed', () => {
    const a = rollEncounter(zone, new SeededRng('seed'));
    const b = rollEncounter(zone, new SeededRng('seed'));
    expect(a).toEqual(b);
  });
});
