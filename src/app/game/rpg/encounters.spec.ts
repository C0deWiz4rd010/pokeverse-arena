import { describe, expect, it } from 'vitest';
import { SeededRng } from '../../core/utils/rng';
import { entriesForTime, rollEncounter } from './encounters';
import { timeBand } from './time';
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

describe('time-of-day encounters', () => {
  const timed: EncounterZone = {
    rate: 1,
    table: [
      { species: 'hoothoot', min: 3, max: 5, weight: 1, time: 'night' },
      { species: 'pidgey', min: 3, max: 5, weight: 1, time: 'day' },
      { species: 'rattata', min: 3, max: 5, weight: 1 },
    ],
  };

  it('classifies the clock into day/night bands', () => {
    expect(timeBand(6)).toBe('day');
    expect(timeBand(12)).toBe('day');
    expect(timeBand(19)).toBe('day');
    expect(timeBand(20)).toBe('night');
    expect(timeBand(3)).toBe('night');
  });

  it('filters entries to the active band, keeping untimed ones', () => {
    expect(entriesForTime(timed.table, 'day').map((e) => e.species)).toEqual(['pidgey', 'rattata']);
    expect(entriesForTime(timed.table, 'night').map((e) => e.species)).toEqual(['hoothoot', 'rattata']);
  });

  it('never rolls a night-only species during the day', () => {
    for (let i = 0; i < 30; i++) {
      const r = rollEncounter(timed, new SeededRng('d' + i), 'day');
      expect(r!.species).not.toBe('hoothoot');
    }
  });
});
