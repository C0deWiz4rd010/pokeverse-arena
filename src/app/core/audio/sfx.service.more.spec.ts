import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SfxService, type SfxName } from './sfx.service';

interface FakeNode {
  connect: ReturnType<typeof vi.fn>;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  frequency: {
    setValueAtTime: ReturnType<typeof vi.fn>;
    exponentialRampToValueAtTime: ReturnType<typeof vi.fn>;
  };
  gain: {
    value: number;
    setValueAtTime: ReturnType<typeof vi.fn>;
    exponentialRampToValueAtTime: ReturnType<typeof vi.fn>;
  };
  playbackRate: { value: number };
  type?: string;
  buffer?: unknown;
}

function node(): FakeNode {
  return {
    connect: vi.fn((d: unknown) => d),
    start: vi.fn(),
    stop: vi.fn(),
    frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
    gain: { value: 1, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
    playbackRate: { value: 1 },
  };
}

class FakeAudioContext {
  static instances: FakeAudioContext[] = [];
  state: 'running' | 'suspended' = 'running';
  currentTime = 1;
  sampleRate = 8000;
  destination = {};
  oscillators: FakeNode[] = [];
  sources: FakeNode[] = [];
  gains: FakeNode[] = [];
  buffersCreated = 0;
  resume = vi.fn(() => Promise.resolve());
  constructor() {
    FakeAudioContext.instances.push(this);
  }
  createGain(): FakeNode {
    const n = node();
    this.gains.push(n);
    return n;
  }
  createOscillator(): FakeNode {
    const n = node();
    this.oscillators.push(n);
    return n;
  }
  createBufferSource(): FakeNode {
    const n = node();
    this.sources.push(n);
    return n;
  }
  createBiquadFilter(): FakeNode {
    return node();
  }
  createBuffer(_ch: number, len: number): { getChannelData: () => Float32Array } {
    this.buffersCreated++;
    const data = new Float32Array(len);
    return { getChannelData: () => data };
  }
}

describe('SfxService with a fake WebAudio context', () => {
  let clock = 1000;
  let sfx: SfxService;

  const ctx = (): FakeAudioContext => FakeAudioContext.instances[0]!;
  /** Play past the de-bounce window so consecutive calls are not swallowed. */
  const play = (name: SfxName): void => {
    clock += 200;
    sfx.play(name);
  };

  beforeEach(() => {
    localStorage.clear();
    FakeAudioContext.instances = [];
    clock = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => clock);
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    vi.stubGlobal('AudioContext', FakeAudioContext);
    TestBed.resetTestingModule();
    sfx = TestBed.inject(SfxService);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    Reflect.deleteProperty(document, 'hidden');
  });

  it('creates the context lazily on the first play only', () => {
    expect(FakeAudioContext.instances).toHaveLength(0);
    play('tap');
    play('back');
    expect(FakeAudioContext.instances).toHaveLength(1);
  });

  it('routes the master gain to the destination at the persisted volume', () => {
    localStorage.setItem('sfx:volume', '0.25');
    TestBed.resetTestingModule();
    sfx = TestBed.inject(SfxService);
    play('tap');
    expect(ctx().gains[0]!.gain.value).toBe(0.25);
    expect(ctx().gains[0]!.connect).toHaveBeenCalledWith(ctx().destination);
  });

  const SHAPES: readonly [SfxName, number, number][] = [
    ['tap', 1, 0],
    ['select', 2, 0],
    ['back', 1, 0],
    ['error', 2, 0],
    ['step', 0, 1],
    ['encounter', 4, 0],
    ['item', 2, 0],
    ['whoosh', 0, 1],
    ['hit', 1, 1],
    ['crit', 2, 1],
    ['super', 2, 1],
    ['faint', 1, 0],
    ['heal', 3, 0],
    ['up', 1, 0],
    ['down', 1, 0],
    ['status', 3, 0],
    ['catch', 5, 0],
    ['levelup', 5, 0],
  ];

  it.each(SHAPES)('%s builds %i oscillator(s) and %i noise source(s)', (name, osc, src) => {
    play(name);
    expect(ctx().oscillators).toHaveLength(osc);
    expect(ctx().sources).toHaveLength(src);
    for (const o of ctx().oscillators) {
      expect(o.start).toHaveBeenCalledTimes(1);
      expect(o.stop).toHaveBeenCalledTimes(1);
    }
  });

  it('slides the tone frequency for a sweeping effect', () => {
    play('faint');
    const o = ctx().oscillators[0]!;
    expect(o.type).toBe('sawtooth');
    expect(o.frequency.setValueAtTime).toHaveBeenCalledWith(440, 1);
    expect(o.frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(90, 1 + 0.55);
  });

  it('plays only every other footstep and bakes the step buffer once', () => {
    play('step');
    play('step');
    play('step');
    play('step');
    expect(ctx().sources).toHaveLength(2);
    expect(ctx().buffersCreated).toBe(1);
  });

  it('shares one noise buffer across noise effects', () => {
    play('hit');
    play('whoosh');
    expect(ctx().buffersCreated).toBe(1);
  });

  it('swallows a repeat of the same blip inside the gap window', () => {
    play('tap');
    sfx.play('tap');
    expect(ctx().oscillators).toHaveLength(1);
    clock += 100;
    sfx.play('tap');
    expect(ctx().oscillators).toHaveLength(2);
  });

  it('does not play while the tab is hidden', () => {
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    play('tap');
    expect(FakeAudioContext.instances).toHaveLength(0);
  });

  it('does not play while muted or at zero volume', () => {
    sfx.setMuted(true);
    play('tap');
    sfx.setMuted(false); // un-muting plays the confirmation blip
    expect(ctx().oscillators).toHaveLength(2);
    sfx.setVolume(0);
    const before = ctx().oscillators.length;
    play('tap');
    expect(ctx().oscillators).toHaveLength(before);
  });

  it('un-muting plays the select blip', () => {
    sfx.setMuted(true);
    sfx.setMuted(false);
    expect(localStorage.getItem('sfx:muted')).toBe('0');
    expect(ctx().oscillators).toHaveLength(2);
  });

  it('applies a volume change to the live master gain', () => {
    play('tap');
    sfx.setVolume(0.9);
    expect(ctx().gains[0]!.gain.value).toBe(0.9);
    expect(localStorage.getItem('sfx:volume')).toBe('0.9');
  });

  it('resumes a suspended context', () => {
    play('tap');
    ctx().state = 'suspended';
    play('back');
    expect(ctx().resume).toHaveBeenCalledTimes(1);
  });

  it('survives a failing resume()', async () => {
    play('tap');
    ctx().state = 'suspended';
    ctx().resume.mockRejectedValueOnce(new Error('blocked'));
    expect(() => play('back')).not.toThrow();
    await Promise.resolve();
  });

  it('falls back to webkitAudioContext', () => {
    vi.stubGlobal('AudioContext', undefined);
    vi.stubGlobal('webkitAudioContext', FakeAudioContext);
    play('tap');
    expect(FakeAudioContext.instances).toHaveLength(1);
  });

  it('stays silent when the context constructor throws', () => {
    vi.stubGlobal(
      'AudioContext',
      class {
        constructor() {
          throw new Error('no audio');
        }
      },
    );
    expect(() => play('tap')).not.toThrow();
  });

  it('restores persisted state and clamps a corrupt volume', () => {
    localStorage.setItem('sfx:muted', '1');
    localStorage.setItem('sfx:volume', 'banana');
    TestBed.resetTestingModule();
    const again = TestBed.inject(SfxService);
    expect(again.muted()).toBe(true);
    expect(again.volume()).toBeCloseTo(0.6);
  });
});
