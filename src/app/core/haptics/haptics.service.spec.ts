import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HapticsService } from './haptics.service';

describe('HapticsService', () => {
  let vibrate: ReturnType<typeof vi.fn>;

  const create = (): HapticsService => {
    TestBed.resetTestingModule();
    return TestBed.inject(HapticsService);
  };

  beforeEach(() => {
    localStorage.clear();
    vibrate = vi.fn(() => true);
    Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true });
  });
  afterEach(() => {
    Reflect.deleteProperty(navigator, 'vibrate');
    vi.unstubAllGlobals();
  });

  it('vibrates with the named pattern', () => {
    const h = create();
    expect(h.supported).toBe(true);
    h.fire('success');
    expect(vibrate).toHaveBeenCalledWith([14, 40, 26]);
    h.fire('heavy');
    expect(vibrate).toHaveBeenLastCalledWith([40]);
  });

  it('does nothing when the Vibration API is missing', () => {
    Reflect.deleteProperty(navigator, 'vibrate');
    const h = create();
    expect(h.supported).toBe(false);
    expect(() => h.fire('tap')).not.toThrow();
    expect(vibrate).not.toHaveBeenCalled();
  });

  it('respects prefers-reduced-motion', () => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce') }));
    const h = create();
    h.fire('tap');
    expect(vibrate).not.toHaveBeenCalled();
  });

  it('stays quiet when the user turned haptics off, and persists the choice', () => {
    const h = create();
    h.setEnabled(false);
    expect(h.enabled()).toBe(false);
    h.fire('tap');
    expect(vibrate).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem('pv:haptics-enabled')!)).toEqual({ v: 1, data: false });
    expect(create().enabled()).toBe(false);
  });

  it('gives a confirming tap when switched on', () => {
    const h = create();
    h.setEnabled(false);
    vibrate.mockClear();
    h.setEnabled(true);
    expect(vibrate).toHaveBeenCalledWith([8]);
  });

  it('toggle flips the state', () => {
    const h = create();
    h.toggle();
    expect(h.enabled()).toBe(false);
    h.toggle();
    expect(h.enabled()).toBe(true);
  });

  it('ignores browsers that throw on vibrate', () => {
    vibrate.mockImplementation(() => {
      throw new Error('gesture required');
    });
    expect(() => create().fire('error')).not.toThrow();
  });
});
