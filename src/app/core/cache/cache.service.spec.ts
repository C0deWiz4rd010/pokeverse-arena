import 'fake-indexeddb/auto';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CacheService } from './cache.service';

describe('CacheService', () => {
  let cache: CacheService;

  beforeEach(async () => {
    TestBed.resetTestingModule();
    cache = TestBed.inject(CacheService);
    await cache.clearApiCache();
  });

  it('stores and returns a value (memory and IndexedDB)', async () => {
    await cache.set('k', { a: 1 });
    expect(await cache.get('k')).toEqual({ a: 1 });
    // a fresh instance has an empty memory mirror and must read it back from IndexedDB
    TestBed.resetTestingModule();
    const fresh = TestBed.inject(CacheService);
    expect(await fresh.get('k')).toEqual({ a: 1 });
  });

  it('returns undefined for unknown keys', async () => {
    expect(await cache.get('nope')).toBeUndefined();
  });

  it('expires entries after their ttl and removes them', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(1_000_000);
      await cache.set('short', 'x', 1000);
      expect(await cache.get('short')).toBe('x');
      vi.setSystemTime(1_005_000);
      expect(await cache.get('short')).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps entries forever when the ttl is 0', async () => {
    await cache.set('forever', 1, 0);
    expect(await cache.get('forever')).toBe(1);
  });

  it('sweeps only the expired rows', async () => {
    await cache.set('old', 1, 10);
    await cache.set('new', 2, 10_000_000);
    TestBed.resetTestingModule(); // drop the memory mirror so the sweep sees IndexedDB only
    const fresh = TestBed.inject(CacheService);
    const removed = await fresh.sweepExpired(Date.now() + 1000);
    expect(removed).toBe(1);
    expect(await fresh.get('old')).toBeUndefined();
    expect(await fresh.get('new')).toBe(2);
  });

  it('deletes single keys and clears everything', async () => {
    await cache.set('a', 1);
    await cache.set('b', 2);
    await cache.delete('a');
    expect(await cache.get('a')).toBeUndefined();
    await cache.clearApiCache();
    expect(await cache.get('b')).toBeUndefined();
  });

  it('keeps savegame state separate from the api cache', async () => {
    await cache.saveState('slot', { hp: 5 });
    await cache.clearApiCache();
    expect(await cache.loadState('slot')).toEqual({ hp: 5 });
    expect(await cache.loadState('missing')).toBeUndefined();
  });

  it('bounds the in-memory mirror (least recently used goes first)', async () => {
    for (let i = 0; i < 450; i++) await cache.set(`m${i}`, i, 0);
    const mem = (cache as unknown as { memory: Map<string, unknown> }).memory;
    expect(mem.size).toBeLessThanOrEqual(400);
    expect(mem.has('m0')).toBe(false);
    expect(mem.has('m449')).toBe(true);
    // evicted from memory, but still readable from IndexedDB
    expect(await cache.get('m0')).toBe(0);
  });
});
