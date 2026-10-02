import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SaveService } from './save.service';
import { ToastService } from '../ui/toast/toast.service';

describe('SaveService', () => {
  let svc: SaveService;

  beforeEach(() => {
    localStorage.clear();
    svc = TestBed.inject(SaveService);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('round-trips values in a versioned envelope', () => {
    expect(svc.write('k', { a: 1 })).toBe(true);
    expect(JSON.parse(localStorage.getItem('pv:k') as string)).toEqual({ v: 1, data: { a: 1 } });
    expect(svc.read('k', null)).toEqual({ a: 1 });
  });

  it('keeps a backup of unreadable data and returns the fallback', () => {
    localStorage.setItem('pv:k', '{broken');
    expect(svc.read('k', 'fallback')).toBe('fallback');
    expect(localStorage.getItem('pv:k:corrupt')).toBe('{broken');
  });

  it('reports a failed write once instead of losing it silently', () => {
    const toast = TestBed.inject(ToastService);
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
      removeItem: () => undefined,
    });
    expect(svc.write('k', 1)).toBe(false);
    expect(svc.write('k', 2)).toBe(false);
    expect(toast.toasts().length).toBe(1);
  });
});
