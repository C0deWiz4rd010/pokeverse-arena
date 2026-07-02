import { describe, expect, it } from 'vitest';
import { depositToBox, giveHeldItem, makePartyMon, rename, setLead, takeHeldItem, withdrawFromBox } from './party';

const mk = (n: string) => makePartyMon(n, 1, 5, 20, undefined);

describe('party ops', () => {
  it('moves a member to the lead slot', () => {
    const a = mk('a'), b = mk('b'), c = mk('c');
    const led = setLead([a, b, c], 2);
    expect(led.map((m) => m.species)).toEqual(['c', 'a', 'b']);
    expect(setLead([a, b], 0).map((m) => m.species)).toEqual(['a', 'b']); // no-op for lead
  });

  it('deposits to the box but keeps at least one in the party', () => {
    const a = mk('a'), b = mk('b');
    const r = depositToBox([a, b], [], 1);
    expect(r.ok).toBe(true);
    expect(r.party.map((m) => m.species)).toEqual(['a']);
    expect(r.box.map((m) => m.species)).toEqual(['b']);
    expect(depositToBox([a], [], 0).ok).toBe(false); // can't empty the party
  });

  it('withdraws from the box when there is room', () => {
    const party = [mk('a'), mk('b'), mk('c'), mk('d'), mk('e')];
    const box = [mk('x')];
    const r = withdrawFromBox(party, box, 0);
    expect(r.ok).toBe(true);
    expect(r.party.length).toBe(6);
    expect(r.box.length).toBe(0);
    // full party rejects
    expect(withdrawFromBox(r.party, [mk('y')], 0).ok).toBe(false);
  });

  it('renames by uid (trimmed, capped, clearable)', () => {
    const a = mk('a');
    const renamed = rename([a], a.uid, '  Sparky  ');
    expect(renamed[0].nickname).toBe('Sparky');
    expect(rename(renamed, a.uid, '')[0].nickname).toBeUndefined();
  });

  it('gives a held item and reports the swapped-out one', () => {
    const a = mk('a'), b = mk('b');
    const r1 = giveHeldItem([a, b], 0, 'leftovers');
    expect(r1.party[0].heldItem).toBe('leftovers');
    expect(r1.replaced).toBeUndefined();
    expect(r1.party[1].heldItem).toBeUndefined();
    const r2 = giveHeldItem(r1.party, 0, 'sitrus-berry');
    expect(r2.party[0].heldItem).toBe('sitrus-berry');
    expect(r2.replaced).toBe('leftovers'); // goes back to the bag
    expect(giveHeldItem([a], 5, 'lum-berry').party[0].heldItem).toBeUndefined(); // bad index no-op
  });

  it('takes a held item back off a member', () => {
    const a = mk('a');
    const given = giveHeldItem([a], 0, 'lum-berry').party;
    const r = takeHeldItem(given, 0);
    expect(r.taken).toBe('lum-berry');
    expect(r.party[0].heldItem).toBeUndefined();
    expect(takeHeldItem(r.party, 0).taken).toBeUndefined(); // nothing held → no-op
  });
});
