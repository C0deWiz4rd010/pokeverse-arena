import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cryUrl } from '../api/pokeapi-endpoints';
import { CryService } from './cry.service';

class FakeAudio {
  static instances: FakeAudio[] = [];
  static playResult: () => Promise<void> = () => Promise.resolve();
  src = '';
  volume = 1;
  playbackRate = 1;
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  pause = vi.fn();
  play = vi.fn(() => FakeAudio.playResult());
  constructor() {
    FakeAudio.instances.push(this);
  }
}

describe('CryService', () => {
  let cry: CryService;

  beforeEach(() => {
    localStorage.clear();
    FakeAudio.instances = [];
    FakeAudio.playResult = () => Promise.resolve();
    vi.stubGlobal('Audio', FakeAudio);
    TestBed.resetTestingModule();
    cry = TestBed.inject(CryService);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('plays the cry of an id at the requested volume and flags it as playing', () => {
    cry.play(25, 0.3);
    const a = FakeAudio.instances[0]!;
    expect(a.src).toBe(cryUrl(25));
    expect(a.volume).toBe(0.3);
    expect(a.playbackRate).toBe(1);
    expect(a.play).toHaveBeenCalledTimes(1);
    expect(cry.playing()).toBe(25);
  });

  it('defaults to half volume and reuses one element for consecutive cries', () => {
    cry.play(1);
    cry.play(4);
    expect(FakeAudio.instances).toHaveLength(1);
    const a = FakeAudio.instances[0]!;
    expect(a.volume).toBe(0.5);
    expect(a.src).toBe(cryUrl(4));
    expect(a.pause).toHaveBeenCalled();
    expect(cry.playing()).toBe(4);
  });

  it('clears the playing flag when the cry ends or errors', () => {
    cry.play(7);
    FakeAudio.instances[0]!.onended!();
    expect(cry.playing()).toBeNull();
    cry.play(8);
    FakeAudio.instances[0]!.onerror!();
    expect(cry.playing()).toBeNull();
  });

  it('ignores a stale end event from an earlier cry', () => {
    cry.play(7);
    const staleEnd = FakeAudio.instances[0]!.onended!;
    cry.play(9);
    staleEnd();
    expect(cry.playing()).toBe(9);
  });

  it('clears the playing flag when play() is rejected by autoplay rules', async () => {
    FakeAudio.playResult = () => Promise.reject(new Error('NotAllowedError'));
    cry.play(3);
    await Promise.resolve();
    await Promise.resolve();
    expect(cry.playing()).toBeNull();
  });

  it('stop() pauses every voice and resets the flag', () => {
    cry.play(2);
    cry.stop();
    expect(FakeAudio.instances[0]!.pause).toHaveBeenCalled();
    expect(cry.playing()).toBeNull();
  });

  it('plays a chimera pair: head now, body a beat later at a higher pitch', () => {
    vi.useFakeTimers();
    cry.playPair(10, 20);
    expect(FakeAudio.instances).toHaveLength(1);
    expect(FakeAudio.instances[0]!.src).toBe(cryUrl(10));
    expect(FakeAudio.instances[0]!.volume).toBe(0.45);
    vi.advanceTimersByTime(419);
    expect(FakeAudio.instances).toHaveLength(1);
    vi.advanceTimersByTime(2);
    expect(FakeAudio.instances).toHaveLength(2);
    const body = FakeAudio.instances[1]!;
    expect(body.src).toBe(cryUrl(20));
    expect(body.volume).toBe(0.4);
    expect(body.playbackRate).toBe(1.18);
  });

  it('cancels a pending body cry when a new cry interrupts', () => {
    vi.useFakeTimers();
    cry.playPair(10, 20);
    cry.play(5);
    vi.advanceTimersByTime(1000);
    expect(FakeAudio.instances).toHaveLength(1);
  });

  it('toggleMute persists, stops playback and blocks further cries', () => {
    cry.play(1);
    cry.toggleMute();
    expect(cry.muted()).toBe(true);
    expect(localStorage.getItem('cry:muted')).toBe('1');
    expect(cry.playing()).toBeNull();
    const plays = FakeAudio.instances[0]!.play.mock.calls.length;
    cry.play(2);
    cry.playPair(3, 4);
    expect(FakeAudio.instances[0]!.play.mock.calls.length).toBe(plays);
    cry.toggleMute();
    expect(cry.muted()).toBe(false);
    expect(localStorage.getItem('cry:muted')).toBe('0');
  });

  it('restores the muted flag from storage', () => {
    localStorage.setItem('cry:muted', '1');
    TestBed.resetTestingModule();
    expect(TestBed.inject(CryService).muted()).toBe(true);
  });

  it('is a no-op where Audio does not exist', () => {
    vi.stubGlobal('Audio', undefined);
    expect(() => {
      cry.play(1);
      cry.playPair(1, 2);
    }).not.toThrow();
    expect(cry.playing()).toBeNull();
  });
});
