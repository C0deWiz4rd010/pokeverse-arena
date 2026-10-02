import { describe, expect, it } from 'vitest';
import { shouldPreload } from './idle-preload';

describe('shouldPreload', () => {
  it('allows unknown and fast connections', () => {
    expect(shouldPreload(undefined)).toBe(true);
    expect(shouldPreload({ effectiveType: '4g' })).toBe(true);
  });

  it('blocks Data Saver and 2g', () => {
    expect(shouldPreload({ saveData: true, effectiveType: '4g' })).toBe(false);
    expect(shouldPreload({ effectiveType: '2g' })).toBe(false);
    expect(shouldPreload({ effectiveType: 'slow-2g' })).toBe(false);
  });
});
