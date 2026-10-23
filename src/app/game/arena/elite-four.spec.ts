import { describe, expect, it } from 'vitest';
import { POKEMON_TYPES } from '../../core/utils/type-chart';
import { isAbilityId } from '../engine/abilities';
import { HELD_ITEMS } from '../engine/items';
import { CHAMPION, GAUNTLET, GAUNTLET_UNLOCK_BADGES, gauntletUnlocked } from './elite-four';

describe('Elite Four & Champion gauntlet', () => {
  it('is the Elite Four followed by exactly one Champion', () => {
    expect(GAUNTLET.length).toBeGreaterThanOrEqual(2);
    expect(GAUNTLET.filter((t) => t.champion)).toHaveLength(1);
    expect(GAUNTLET[GAUNTLET.length - 1]).toBe(CHAMPION);
    expect(new Set(GAUNTLET.map((t) => t.id)).size).toBe(GAUNTLET.length);
  });

  it('gets tougher towards the Champion', () => {
    const levels = GAUNTLET.map((t) => t.level);
    expect(levels).toEqual([...levels].sort((a, b) => a - b));
    expect(CHAMPION!.team.length).toBeGreaterThanOrEqual(GAUNTLET[0]!.team.length);
  });

  it('only uses abilities and items the engine knows', () => {
    const itemIds = new Set(HELD_ITEMS.map((i) => i.id));
    for (const trainer of GAUNTLET) {
      expect(trainer.team.length).toBeGreaterThan(0);
      for (const mon of trainer.team) {
        expect(mon.species).toBeTruthy();
        if (mon.ability) expect(isAbilityId(mon.ability)).toBe(true);
        if (mon.item) expect(itemIds.has(mon.item)).toBe(true);
      }
    }
  });

  it('opens once enough badges are earned', () => {
    const badges = new Set(POKEMON_TYPES.slice(0, GAUNTLET_UNLOCK_BADGES - 1));
    expect(gauntletUnlocked(badges)).toBe(false);
    badges.add(POKEMON_TYPES[GAUNTLET_UNLOCK_BADGES - 1]!);
    expect(gauntletUnlocked(badges)).toBe(true);
  });
});
