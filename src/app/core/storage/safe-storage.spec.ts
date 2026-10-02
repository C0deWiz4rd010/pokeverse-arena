import { afterEach, describe, expect, it, vi } from 'vitest';
import { safeGet, safeRemove, safeSet } from './safe-storage';

describe('safe-storage', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('round-trips values', () => {
    expect(safeSet('pv-test', 'x')).toBe(true);
    expect(safeGet('pv-test')).toBe('x');
    safeRemove('pv-test');
    expect(safeGet('pv-test')).toBeNull();
  });

  it('never throws when storage is blocked', () => {
    const blocked = {
      getItem: () => { throw new Error('SecurityError'); },
      setItem: () => { throw new Error('QuotaExceededError'); },
      removeItem: () => { throw new Error('SecurityError'); },
    };
    vi.stubGlobal('localStorage', blocked);
    expect(safeGet('k')).toBeNull();
    expect(safeSet('k', 'v')).toBe(false);
    expect(() => safeRemove('k')).not.toThrow();
  });
});
