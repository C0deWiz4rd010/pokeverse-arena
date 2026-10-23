import { describe, expect, it } from 'vitest';
import type { Battler } from '../engine';
import {
  RELICS,
  applyRelicsToTeam,
  coinMultiplier,
  relicById,
  rewardChoiceBonus,
  type RelicId,
} from './relics';

const mon = (item?: Battler['item']): Battler => ({
  id: 1,
  name: 'm',
  level: 50,
  types: ['normal'],
  stats: {
    hp: 100,
    attack: 100,
    defense: 100,
    'special-attack': 100,
    'special-defense': 100,
    speed: 100,
  },
  moves: [{ name: 'Tackle', type: 'normal', power: 40, accuracy: 100, damageClass: 'physical' }],
  item,
});

describe('relics', () => {
  it('has unique ids that all resolve', () => {
    expect(new Set(RELICS.map((r) => r.id)).size).toBe(RELICS.length);
    for (const r of RELICS) expect(relicById(r.id)).toBe(r);
    expect(relicById('nope' as RelicId)).toBeUndefined();
  });

  it('multiplies coin income and sums reward choices', () => {
    expect(coinMultiplier([])).toBe(1);
    expect(coinMultiplier(['lucky-coin'])).toBeGreaterThan(1);
    expect(rewardChoiceBonus([])).toBe(0);
    expect(rewardChoiceBonus(['type-lens'])).toBeGreaterThanOrEqual(0);
  });

  it('applies stat multipliers to a fresh copy of the team', () => {
    const team = [mon()];
    const boosted = applyRelicsToTeam(team, ['vitamin-boost']);
    expect(boosted[0]!.stats.attack).toBeGreaterThan(100);
    expect(team[0]!.stats.attack).toBe(100); // the original is untouched
    expect(applyRelicsToTeam(team, [])[0]!.stats).toEqual(team[0]!.stats);
  });

  it('grants items only to Pokémon without one, and lead items only to the lead', () => {
    const held = applyRelicsToTeam([mon(), mon('sitrus-berry')], ['leftovers-aura']);
    expect(held[0]!.item).toBe('leftovers');
    expect(held[1]!.item).toBe('sitrus-berry');

    const lead = applyRelicsToTeam([mon(), mon()], ['focus-charm']);
    expect(lead[0]!.item).toBe('focus-sash');
    expect(lead[1]!.item).toBeUndefined();
  });
});
