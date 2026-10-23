import { describe, expect, it } from 'vitest';
import type { Battler } from '../engine';
import { DUPLICATE_RELIC_REFUND, coinsEarned, equipFirstFree, grantRelic } from './run-economy';

const mon = (name: string, item?: Battler['item']): Battler =>
  ({ id: 1, name, level: 5, types: ['normal'], stats: {}, moves: [], item }) as unknown as Battler;

describe('run economy', () => {
  it('earns nothing for non-positive amounts', () => {
    expect(coinsEarned(0, [])).toBe(0);
    expect(coinsEarned(-5, [])).toBe(0);
  });

  it('applies the relic coin multiplier and rounds', () => {
    expect(coinsEarned(10, [])).toBe(10);
    expect(coinsEarned(10, ['lucky-coin'])).toBeGreaterThan(10);
  });

  it('grants a new relic and refunds a duplicate', () => {
    const first = grantRelic([], 'lucky-coin');
    expect(first).toEqual({ relics: ['lucky-coin'], refund: 0, duplicate: false });
    const again = grantRelic(first.relics, 'lucky-coin');
    expect(again.duplicate).toBe(true);
    expect(again.refund).toBe(DUPLICATE_RELIC_REFUND);
    expect(again.relics).toEqual(['lucky-coin']);
  });

  it('equips the first member without an item, else the lead', () => {
    const party = [mon('a', 'leftovers'), mon('b')];
    const r = equipFirstFree(party, 'life-orb');
    expect(r.index).toBe(1);
    expect(r.party[1]!.item).toBe('life-orb');
    expect(party[1]!.item).toBeUndefined(); // input untouched

    const full = equipFirstFree([mon('a', 'leftovers'), mon('b', 'leftovers')], 'life-orb');
    expect(full.index).toBe(0);
    expect(full.party[0]!.item).toBe('life-orb');
  });
});
