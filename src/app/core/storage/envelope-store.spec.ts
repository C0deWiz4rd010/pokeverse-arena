import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EnvelopeStore } from './envelope-store';

describe('EnvelopeStore', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('round-trips under the pv: namespace', () => {
    const s = new EnvelopeStore();
    expect(s.write('thing', { a: 1 })).toBe(true);
    expect(localStorage.getItem('pv:thing')).toBe('{"v":1,"data":{"a":1}}');
    expect(s.read('thing', null)).toEqual({ a: 1 });
  });

  it('imports a legacy key once and removes it', () => {
    localStorage.setItem('arena:badges', '["fire","water"]');
    const s = new EnvelopeStore();
    expect(s.read<string[]>('arena:badges', [])).toEqual(['fire', 'water']);
    expect(localStorage.getItem('arena:badges')).toBeNull();
    expect(s.read<string[]>('arena:badges', [])).toEqual(['fire', 'water']); // now from pv:
  });

  it('converts legacy scalars (champion flag, coins)', () => {
    localStorage.setItem('arena:champion', '1');
    localStorage.setItem('arena:coins', '120');
    const s = new EnvelopeStore();
    expect(s.read('arena:champion', false)).toBe(true);
    expect(s.read('arena:coins', 0)).toBe(120);
  });

  it('keeps the legacy key and falls back when it is unusable', () => {
    localStorage.setItem('spire:meta', '{broken');
    localStorage.setItem('arena:coins', 'abc');
    const s = new EnvelopeStore();
    expect(s.read('spire:meta', 'fb')).toBe('fb');
    expect(s.read('arena:coins', 7)).toBe(7);
    expect(localStorage.getItem('spire:meta')).toBe('{broken');
  });

  it('prefers the new key over a stale legacy one', () => {
    const s = new EnvelopeStore();
    s.write('arena:coins', 50);
    localStorage.setItem('arena:coins', '999');
    expect(s.read('arena:coins', 0)).toBe(50);
  });

  it('backs up a corrupt blob and reports failed writes', () => {
    let failed = 0;
    const s = new EnvelopeStore(() => failed++);
    localStorage.setItem('pv:x', 'nope');
    expect(s.read('x', 1)).toBe(1);
    expect(localStorage.getItem('pv:x:corrupt')).toBe('nope');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(s.write('y', 1)).toBe(false);
    expect(failed).toBe(1);
  });
});
