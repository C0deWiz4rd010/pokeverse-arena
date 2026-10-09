import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { SfxService } from './sfx.service';

describe('SfxService', () => {
  let sfx: SfxService;
  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
    sfx = TestBed.inject(SfxService);
  });

  it('is on at a moderate volume by default', () => {
    expect(sfx.muted()).toBe(false);
    expect(sfx.volume()).toBeCloseTo(0.6);
  });

  it('persists mute and volume, clamping the volume to 0–1', () => {
    sfx.setVolume(3);
    expect(sfx.volume()).toBe(1);
    sfx.setVolume(-1);
    expect(sfx.volume()).toBe(0);
    sfx.setMuted(true);
    expect(localStorage.getItem('sfx:muted')).toBe('1');
    expect(localStorage.getItem('sfx:volume')).toBe('0');
  });

  it('never throws where WebAudio is missing (SSR, old browsers, jsdom)', () => {
    expect(() => {
      for (const n of ['tap', 'hit', 'step', 'levelup'] as const) sfx.play(n);
    }).not.toThrow();
  });

  it('stays silent while muted', () => {
    sfx.setMuted(true);
    expect(() => sfx.play('hit')).not.toThrow();
  });
});
