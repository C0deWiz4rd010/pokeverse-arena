import { describe, expect, it } from 'vitest';
import { buildBackup, isOwnedKey, parseBackup } from './backup';

function fakeStorage(data: Record<string, string>): Pick<Storage, 'length' | 'key' | 'getItem'> {
  const keys = Object.keys(data);
  return { length: keys.length, key: (i) => keys[i] ?? null, getItem: (k) => data[k] ?? null };
}

describe('backup', () => {
  it('only owns this app\'s keys', () => {
    expect(isOwnedKey('pv:rpg:save')).toBe(true);
    expect(isOwnedKey('arena:badges')).toBe(true);
    expect(isOwnedKey('other-site:token')).toBe(false);
    expect(isOwnedKey('pv:rpg:save:corrupt')).toBe(false);
  });

  it('exports only owned keys and round-trips through parse', () => {
    const b = buildBackup(fakeStorage({ 'pv:rpg:save': '{"v":1,"data":{}}', 'cry:muted': '"1"', 'foreign': '{}' }), '2.2.4');
    expect(Object.keys(b.entries).sort()).toEqual(['cry:muted', 'pv:rpg:save']);
    const parsed = parseBackup(JSON.stringify(b));
    expect(parsed.ok).toBe(true);
  });

  it('rejects foreign, malformed and future files', () => {
    expect(parseBackup('nope').ok).toBe(false);
    expect(parseBackup('{"app":"x"}').ok).toBe(false);
    expect(parseBackup(JSON.stringify({ app: 'pokeverse-arena', format: 99, entries: { 'pv:a': '1' } })).ok).toBe(false);
  });

  it('drops non-owned keys and non-JSON values on import', () => {
    const r = parseBackup(JSON.stringify({ app: 'pokeverse-arena', format: 1, entries: { 'pv:a': '{"x":1}', evil: '{}', 'pv:b': 'not json', 'pv:c': 5 } }));
    expect(r).toEqual({ ok: true, entries: { 'pv:a': '{"x":1}' } });
  });
});
