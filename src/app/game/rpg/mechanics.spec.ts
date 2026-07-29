import { describe, expect, it } from 'vitest';
import { bumpCombo, comboLabel, comboShinyMultiplier, comboXpMultiplier } from './combo';
import { BADGE_BOONS, activeBoons, catchBonus, fishBiteBonus, shopDiscount, xpBonus } from './boons';
import { canForage, collectForage, forageDay, forageId, forageLoot } from './forage';

describe('catch combos', () => {
  it('stacks the same species and restarts on a new one', () => {
    let c = bumpCombo(undefined, 'pidgey');
    expect(c).toEqual({ species: 'pidgey', count: 1 });
    c = bumpCombo(c, 'pidgey');
    c = bumpCombo(c, 'pidgey');
    expect(c.count).toBe(3);
    c = bumpCombo(c, 'rattata');
    expect(c).toEqual({ species: 'rattata', count: 1 });
  });

  it('scales shiny odds in tiers up to 8×', () => {
    expect(comboShinyMultiplier(1)).toBe(1);
    expect(comboShinyMultiplier(5)).toBe(2);
    expect(comboShinyMultiplier(10)).toBe(4);
    expect(comboShinyMultiplier(25)).toBe(8);
  });

  it('caps the XP bonus at +50 %', () => {
    expect(comboXpMultiplier(0)).toBe(1);
    expect(comboXpMultiplier(4)).toBeCloseTo(1.2);
    expect(comboXpMultiplier(99)).toBe(1.5);
  });

  it('labels only visible chains', () => {
    expect(comboLabel(undefined)).toBeNull();
    expect(comboLabel({ species: 'pidgey', count: 1 })).toBeNull();
    expect(comboLabel({ species: 'pidgey', count: 7 })).toBe('7× pidgey');
  });
});

describe('badge boons', () => {
  it('activates exactly the boons whose badge is held', () => {
    expect(activeBoons([])).toEqual([]);
    expect(activeBoons(['Hive Badge', 'Tide Badge']).map((b) => b.name)).toEqual(['Keen Throw', "Angler's Luck"]);
    expect(activeBoons(BADGE_BOONS.map((b) => b.badge))).toHaveLength(4);
  });

  it('applies the four modifiers only with their badge', () => {
    expect(catchBonus([])).toBe(1);
    expect(catchBonus(['Hive Badge'])).toBeCloseTo(1.15);
    expect(shopDiscount(['Boulder Badge'])).toBeCloseTo(0.9);
    expect(xpBonus(['Knuckle Badge'])).toBeCloseTo(1.1);
    expect(fishBiteBonus(['Tide Badge'])).toBeCloseTo(0.15);
    expect(fishBiteBonus([])).toBe(0);
  });
});

describe('forage spots', () => {
  const day = '2026-07-19';
  const id = forageId('route-1', 3, 7);

  it('lets every spot be picked once per day', () => {
    expect(canForage(undefined, id, day)).toBe(true);
    const s1 = collectForage(undefined, id, day);
    expect(canForage(s1, id, day)).toBe(false);
    expect(canForage(s1, forageId('route-1', 4, 7), day)).toBe(true);
  });

  it('refills all bushes on a new day', () => {
    const s1 = collectForage(undefined, id, day);
    expect(canForage(s1, id, '2026-07-20')).toBe(true);
    const s2 = collectForage(s1, id, '2026-07-20');
    expect(s2.day).toBe('2026-07-20');
    expect(s2.taken).toEqual([id]); // stale list was reset
  });

  it('rolls deterministic, valid loot per (day, spot)', () => {
    const a = forageLoot(id, day);
    expect(forageLoot(id, day)).toBe(a);
    expect(typeof a).toBe('string');
    // different day or spot may differ — at least the roll is well-formed
    expect(forageLoot(id, '2026-07-20')).toBeTruthy();
  });

  it('formats stable day keys', () => {
    expect(forageDay(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});
