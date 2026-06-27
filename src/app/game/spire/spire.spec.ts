import { describe, expect, it } from 'vitest';
import {
  BOSS_FLOORS,
  TOTAL_FLOORS,
  foeLevel,
  generateFloorChoices,
  generateFoe,
  generateRewards,
  generateShop,
  isBossFloor,
} from './spire';
import { applyRelicsToTeam, coinMultiplier, relicById, rewardChoiceBonus } from './relics';
import { defaultMeta, recordRun } from './meta';
import type { Battler } from '../engine';

function mon(name: string, item?: Battler['item']): Battler {
  return {
    id: 1,
    name,
    level: 50,
    types: ['normal'],
    stats: { hp: 100, attack: 100, defense: 100, 'special-attack': 100, 'special-defense': 100, speed: 100 },
    moves: [],
    item,
  };
}

describe('spire generation', () => {
  it('is deterministic for a seed + floor', () => {
    const a = generateFloorChoices(3, 'seed-x');
    const b = generateFloorChoices(3, 'seed-x');
    expect(b).toEqual(a);
  });

  it('offers a single boss on boss floors and choices otherwise', () => {
    for (const f of BOSS_FLOORS) {
      const choices = generateFloorChoices(f, 's');
      expect(choices).toHaveLength(1);
      expect(choices[0].type).toBe('boss');
      expect(choices[0].foe?.boss).toBe(true);
    }
    const normal = generateFloorChoices(2, 's');
    expect(normal.length).toBeGreaterThan(1);
    expect(normal[0].type).toBe('battle');
  });

  it('scales foe level with depth and boss status', () => {
    expect(foeLevel(10, false)).toBeGreaterThan(foeLevel(1, false));
    expect(foeLevel(5, true)).toBeGreaterThan(foeLevel(5, false));
    expect(generateFoe(15, 's', true).aiTier).toBe('elite');
  });

  it('builds rewards, extended by the Type Lens relic', () => {
    expect(generateRewards(4, 's', []).length).toBe(3);
    expect(generateRewards(4, 's', ['type-lens']).length).toBe(4);
  });

  it('stocks a shop with items, a relic and a restore', () => {
    const shop = generateShop(3, 's');
    expect(shop.length).toBeGreaterThanOrEqual(4);
    expect(shop.some((e) => e.kind === 'relic')).toBe(true);
    expect(shop.some((e) => e.kind === 'heal')).toBe(true);
  });

  it('keeps the spire a fixed height', () => {
    expect(TOTAL_FLOORS).toBe(15);
    expect(isBossFloor(TOTAL_FLOORS)).toBe(true);
  });
});

describe('relics', () => {
  it('stacks coin multipliers', () => {
    expect(coinMultiplier([])).toBe(1);
    expect(coinMultiplier(['lucky-coin'])).toBe(1.5);
  });

  it('counts reward bonuses', () => {
    expect(rewardChoiceBonus(['type-lens'])).toBe(1);
  });

  it('applies stat multipliers and grants items to the team', () => {
    const team = [mon('Lead'), mon('Bench', 'leftovers')];
    const boosted = applyRelicsToTeam(team, ['vitamin-boost', 'mega-battery']);
    expect(boosted[0].stats.attack).toBe(110); // +10%
    expect(boosted[0].item).toBe('choice-specs'); // lead grant (was itemless)
    expect(boosted[1].item).toBe('leftovers'); // unchanged (already held)
  });

  it('resolves relic metadata', () => {
    expect(relicById('lucky-coin')?.name).toBe('Lucky Coin');
  });
});

describe('spire meta', () => {
  it('tracks best depth, clears and ascension', () => {
    let meta = defaultMeta();
    meta = recordRun(meta, 7, 120, false);
    expect(meta.bestDepth).toBe(7);
    expect(meta.clears).toBe(0);
    meta = recordRun(meta, 15, 400, true);
    expect(meta.bestDepth).toBe(15);
    expect(meta.clears).toBe(1);
    expect(meta.ascension).toBe(1);
    expect(meta.bankedCoins).toBe(520);
  });
});
