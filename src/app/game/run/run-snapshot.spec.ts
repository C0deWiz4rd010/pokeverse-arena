import { describe, expect, it } from 'vitest';
import { isBattlerLike, parseOdysseyRun, parseRunCore, parseSpireRun } from './run-snapshot';

const mon = (name = 'pikachu') => ({
  id: 25,
  name,
  level: 50,
  types: ['electric'],
  stats: {
    hp: 100,
    attack: 50,
    defense: 40,
    'special-attack': 50,
    'special-defense': 50,
    speed: 90,
  },
  moves: [{ name: 'Tackle', type: 'normal', power: 40, accuracy: 100, damageClass: 'physical' }],
});

const core = () => ({
  seed: 'spire-1',
  coins: 12,
  relics: ['lucky-coin', 'not-a-relic'],
  party: [mon(), mon('raichu')],
  hpFraction: [0.5, 7],
});

describe('run snapshots', () => {
  it('recognises battler-shaped data only', () => {
    expect(isBattlerLike(mon())).toBe(true);
    expect(isBattlerLike({ ...mon(), moves: [] })).toBe(false);
    expect(isBattlerLike({ ...mon(), stats: { hp: 0 } })).toBe(false);
    expect(isBattlerLike(null)).toBe(false);
  });

  it('keeps known relics, clamps HP and fills missing HP entries', () => {
    const r = parseRunCore({ ...core(), hpFraction: [0.5, 7, 0.2] })!;
    expect(r.relics).toEqual(['lucky-coin']);
    expect(r.hpFraction).toEqual([0.5, 1]);
    expect(parseRunCore({ ...core(), hpFraction: undefined })!.hpFraction).toEqual([1, 1]);
  });

  it('rejects broken or oversized runs', () => {
    expect(parseRunCore(null)).toBeNull();
    expect(parseRunCore({ ...core(), seed: '' })).toBeNull();
    expect(parseRunCore({ ...core(), coins: -1 })).toBeNull();
    expect(parseRunCore({ ...core(), party: [] })).toBeNull();
    expect(parseRunCore({ ...core(), party: [{ id: 1 }] })).toBeNull();
    expect(parseRunCore({ ...core(), party: Array.from({ length: 7 }, () => mon()) })).toBeNull();
  });

  it('parses a Spire snapshot with its floor choices', () => {
    const snap = parseSpireRun({ ...core(), floor: 4, choices: [{ id: 'a', type: 'battle' }] })!;
    expect(snap.floor).toBe(4);
    expect(snap.choices).toHaveLength(1);
    expect(parseSpireRun({ ...core(), floor: 0, choices: [{ id: 'a', type: 'rest' }] })).toBeNull();
    expect(parseSpireRun({ ...core(), floor: 2, choices: [] })).toBeNull();
    expect(parseSpireRun({ ...core(), floor: 2, choices: [{ id: 1 }] })).toBeNull();
  });

  it('parses an Odyssey snapshot', () => {
    const snap = parseOdysseyRun({
      ...core(),
      wave: 9,
      balls: 3,
      isDaily: true,
      runUnlocks: [1, 'x', 4],
    })!;
    expect(snap).toMatchObject({ wave: 9, balls: 3, isDaily: true, runUnlocks: [1, 4] });
    expect(parseOdysseyRun({ ...core(), wave: 0, balls: 3 })).toBeNull();
    expect(parseOdysseyRun({ ...core(), wave: 2, balls: -1 })).toBeNull();
  });
});
