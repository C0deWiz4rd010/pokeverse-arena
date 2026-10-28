import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SaveService } from './save.service';
import { ToastService } from '../ui/toast/toast.service';

describe('SaveService edge cases', () => {
  let svc: SaveService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
    svc = TestBed.inject(SaveService);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    Reflect.deleteProperty(navigator, 'storage');
  });

  describe('readLegacy', () => {
    it('parses a raw un-namespaced key', () => {
      localStorage.setItem('old-key', JSON.stringify({ n: 3 }));
      expect(svc.readLegacy('old-key', null)).toEqual({ n: 3 });
    });

    it('returns the fallback for missing, empty or corrupt values', () => {
      expect(svc.readLegacy('absent', 'fb')).toBe('fb');
      localStorage.setItem('empty', '');
      expect(svc.readLegacy('empty', 'fb')).toBe('fb');
      localStorage.setItem('bad', '{oops');
      expect(svc.readLegacy('bad', 'fb')).toBe('fb');
    });

    it('returns the fallback when storage itself throws', () => {
      vi.stubGlobal('localStorage', {
        getItem: () => {
          throw new Error('blocked');
        },
      });
      expect(svc.readLegacy('k', 7)).toBe(7);
    });
  });

  describe('remove', () => {
    it('deletes a stored value so reads fall back again', () => {
      svc.write('k', 1);
      svc.remove('k');
      expect(localStorage.getItem('pv:k')).toBeNull();
      expect(svc.read('k', 'gone')).toBe('gone');
    });
  });

  describe('requestPersistence', () => {
    const setStorage = (s: unknown): void => {
      Object.defineProperty(navigator, 'storage', { value: s, configurable: true });
    };

    it('is false where the API is missing', async () => {
      setStorage(undefined);
      expect(await svc.requestPersistence()).toBe(false);
    });

    it('does not re-request when storage is already persisted', async () => {
      const persist = vi.fn();
      setStorage({ persisted: () => Promise.resolve(true), persist });
      expect(await svc.requestPersistence()).toBe(true);
      expect(persist).not.toHaveBeenCalled();
    });

    it('asks for persistence otherwise and returns the answer', async () => {
      setStorage({ persisted: () => Promise.resolve(false), persist: () => Promise.resolve(true) });
      expect(await svc.requestPersistence()).toBe(true);
      setStorage({
        persisted: () => Promise.resolve(false),
        persist: () => Promise.resolve(false),
      });
      expect(await svc.requestPersistence()).toBe(false);
    });

    it('is false when the browser throws', async () => {
      setStorage({
        persisted: () => Promise.reject(new Error('nope')),
        persist: () => Promise.resolve(true),
      });
      expect(await svc.requestPersistence()).toBe(false);
    });
  });

  it('shows an informational toast on the first failed write', () => {
    const toast = TestBed.inject(ToastService);
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
      removeItem: () => undefined,
    });
    svc.write('k', 1);
    const t = toast.toasts()[0]!;
    expect(t.title).toBe('Progress could not be saved');
    expect(t.kind).toBe('info');
    expect(t.icon).toBe('download');
  });
});
