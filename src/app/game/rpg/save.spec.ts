import { describe, expect, it } from 'vitest';
import { defaultSave, isValidSave, RPG_SAVE_VERSION, sanitizeSave, START } from './save';
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

describe('sanitizeSave', () => {
  it('passes a healthy save through', () => {
    const s = defaultSave('Ash');
    s.party.push(makePartyMon('bulbasaur', 1, 5, 20));
    const out = sanitizeSave(JSON.parse(JSON.stringify(s)));
    expect(out?.party[0]?.species).toBe('bulbasaur');
    expect(out?.name).toBe('Ash');
  });

  it('drops corrupt Pokemon and repairs out-of-range numbers instead of crashing later', () => {
    const s = JSON.parse(JSON.stringify(defaultSave()));
    s.party = [
      { species: 'pikachu', dexId: 25, level: 500, xp: -4, maxHp: 30, currentHp: 999, status: 'bogus' },
      { species: 'ghost' },
      null,
    ];
    const out = sanitizeSave(s);
    expect(out?.party.length).toBe(1);
    const mon = out?.party[0];
    expect(mon?.level).toBe(100);
    expect(mon?.currentHp).toBe(30);
    expect(mon?.xp).toBe(0);
    expect(mon?.status).toBe('none');
    expect(mon?.uid).toBeTruthy();
  });

  it('sends the player to the start when the saved map no longer exists', () => {
    const s = JSON.parse(JSON.stringify(defaultSave()));
    s.map = 'deleted-map';
    s.x = 40;
    const out = sanitizeSave(s);
    expect(out?.map).toBe(START.map);
    expect(out?.x).toBe(START.x);
  });

  it('rejects unrecoverable blobs', () => {
    expect(sanitizeSave(null)).toBeNull();
    expect(sanitizeSave({ map: 'home-town' })).toBeNull();
    expect(sanitizeSave('x')).toBeNull();
  });
});
