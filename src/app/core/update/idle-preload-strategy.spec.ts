import { TestBed } from '@angular/core/testing';
import type { Route } from '@angular/router';
import { of, type Observable } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IdlePreloadStrategy } from './idle-preload';

describe('IdlePreloadStrategy', () => {
  let strategy: IdlePreloadStrategy;
  let load: ReturnType<typeof vi.fn>;
  const setConnection = (c: unknown): void => {
    Object.defineProperty(navigator, 'connection', { value: c, configurable: true });
  };

  beforeEach(() => {
    vi.useFakeTimers();
    load = vi.fn(() => of('loaded'));
    strategy = TestBed.inject(IdlePreloadStrategy);
  });
  afterEach(() => {
    vi.useRealTimers();
    Reflect.deleteProperty(navigator, 'connection');
  });

  const run = (route: Route): unknown[] => {
    const out: unknown[] = [];
    strategy.preload(route, load as () => Observable<unknown>).subscribe((v) => out.push(v));
    return out;
  };

  it('never preloads routes without the preload flag', () => {
    const out = run({ path: 'x' });
    vi.advanceTimersByTime(10_000);
    expect(load).not.toHaveBeenCalled();
    expect(out).toEqual([]);
  });

  it('preloads a flagged route only after the settle delay', () => {
    const out = run({ path: 'x', data: { preload: true } });
    vi.advanceTimersByTime(2499);
    expect(load).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2);
    expect(load).toHaveBeenCalledTimes(1);
    expect(out).toEqual(['loaded']);
  });

  it('skips preloading on Data Saver', () => {
    setConnection({ saveData: true, effectiveType: '4g' });
    run({ path: 'x', data: { preload: true } });
    vi.advanceTimersByTime(10_000);
    expect(load).not.toHaveBeenCalled();
  });

  it('skips preloading on a slow connection but allows 4g', () => {
    setConnection({ effectiveType: 'slow-2g' });
    run({ path: 'x', data: { preload: true } });
    vi.advanceTimersByTime(10_000);
    expect(load).not.toHaveBeenCalled();
    setConnection({ effectiveType: '4g' });
    run({ path: 'y', data: { preload: true } });
    vi.advanceTimersByTime(2600);
    expect(load).toHaveBeenCalledTimes(1);
  });
});
