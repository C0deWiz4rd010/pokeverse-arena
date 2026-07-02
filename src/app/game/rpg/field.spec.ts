import { describe, expect, it } from 'vitest';
import { FIELD_POISON_DAMAGE, applyFieldPoison } from './field';
import type { PartyMon } from './rpg-types';

function mon(overrides: Partial<PartyMon> = {}): PartyMon {
  return {
    uid: overrides.uid ?? 'u1',
    species: overrides.species ?? 'rattata',
    dexId: overrides.dexId ?? 19,
    nickname: overrides.nickname,
    level: overrides.level ?? 5,
    xp: overrides.xp ?? 0,
    currentHp: overrides.currentHp ?? 20,
    maxHp: overrides.maxHp ?? 20,
    status: overrides.status ?? 'none',
  };
}

describe('applyFieldPoison', () => {
  it('damages poisoned members and lists them by name', () => {
    const res = applyFieldPoison([mon({ status: 'poison', currentHp: 10, species: 'ekans' })]);
    expect(res.party[0].currentHp).toBe(10 - FIELD_POISON_DAMAGE);
    expect(res.hurt).toEqual(['ekans']);
  });

  it('also affects toxic and prefers the nickname when set', () => {
    const res = applyFieldPoison([mon({ status: 'toxic', currentHp: 8, nickname: 'Fang' })]);
    expect(res.party[0].currentHp).toBe(8 - FIELD_POISON_DAMAGE);
    expect(res.hurt).toEqual(['Fang']);
  });

  it('never drops a member below 1 HP and never faints it', () => {
    const res = applyFieldPoison([mon({ status: 'poison', currentHp: 1 })]);
    expect(res.party[0].currentHp).toBe(1);
    expect(res.hurt).toEqual([]);
  });

  it('ignores healthy or non-poison members', () => {
    const res = applyFieldPoison([
      mon({ status: 'none', currentHp: 20 }),
      mon({ status: 'burn', currentHp: 20 }),
      mon({ status: 'paralysis', currentHp: 20 }),
    ]);
    expect(res.party.map((m) => m.currentHp)).toEqual([20, 20, 20]);
    expect(res.hurt).toEqual([]);
  });

  it('does not mutate the input array or members', () => {
    const input = [mon({ status: 'poison', currentHp: 10 })];
    const snapshot = input[0].currentHp;
    applyFieldPoison(input);
    expect(input[0].currentHp).toBe(snapshot);
  });
});
