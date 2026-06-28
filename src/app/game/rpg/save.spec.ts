import { describe, expect, it } from 'vitest';
import { defaultSave, isValidSave, RPG_SAVE_VERSION } from './save';
import { makePartyMon, healParty } from './party';

describe('rpg save', () => {
  it('builds a valid default save', () => {
    const s = defaultSave('Ash');
    expect(isValidSave(s)).toBe(true);
    expect(s.v).toBe(RPG_SAVE_VERSION);
    expect(s.name).toBe('Ash');
    expect(s.party).toEqual([]);
    expect(s.bag['poke-ball']).toBe(5);
    expect(s.money).toBeGreaterThan(0);
  });

  it('round-trips through JSON', () => {
    const s = defaultSave();
    s.party.push(makePartyMon('bulbasaur', 1, 5, 20));
    const clone = JSON.parse(JSON.stringify(s));
    expect(isValidSave(clone)).toBe(true);
    expect(clone.party[0].species).toBe('bulbasaur');
    expect(clone.party[0].level).toBe(5);
  });

  it('rejects malformed data', () => {
    expect(isValidSave(null)).toBe(false);
    expect(isValidSave({})).toBe(false);
    expect(isValidSave({ map: 'x' })).toBe(false);
  });

  it('heals a party fully', () => {
    const mon = makePartyMon('charmander', 4, 5, 19);
    mon.currentHp = 1;
    mon.status = 'burn';
    const [healed] = healParty([mon]);
    expect(healed.currentHp).toBe(19);
    expect(healed.status).toBe('none');
  });
});
