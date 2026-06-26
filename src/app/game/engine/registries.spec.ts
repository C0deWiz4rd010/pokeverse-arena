import { describe, expect, it } from 'vitest';
import { ABILITIES, abilityById, abilityName } from './abilities';
import { HELD_ITEMS, itemById, itemName } from './items';

describe('ability registry', () => {
  it('has unique ids and resolvable names', () => {
    const ids = ABILITIES.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(abilityName('intimidate')).toBe('Intimidate');
    expect(abilityById('drought')?.weatherOnEntry).toBe('sun');
    expect(abilityById(undefined)).toBeUndefined();
  });

  it('models pinch and absorb abilities', () => {
    expect(abilityById('blaze')?.pinch).toEqual({ type: 'fire', factor: 1.5 });
    expect(abilityById('water-absorb')?.absorb).toEqual({ type: 'water', effect: 'heal25' });
    expect(abilityById('levitate')?.levitate).toBe(true);
  });
});

describe('held-item registry', () => {
  it('has unique ids and resolvable names', () => {
    const ids = HELD_ITEMS.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(itemName('leftovers')).toBe('Leftovers');
    expect(itemById('life-orb')?.damageMultiplier).toBe(1.3);
    expect(itemById('life-orb')?.recoil).toBe(0.1);
  });

  it('models choice locks and consumables', () => {
    expect(itemById('choice-scarf')?.choiceLock).toBe(true);
    expect(itemById('choice-scarf')?.statMultiplier).toEqual({ stat: 'speed', factor: 1.5 });
    expect(itemById('focus-sash')?.focusSash).toBe(true);
    expect(itemById('lum-berry')?.curesStatus).toBe('all');
  });
});
