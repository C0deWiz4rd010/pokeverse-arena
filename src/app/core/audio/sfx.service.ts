import { Injectable, signal } from '@angular/core';
import { safeGet, safeSet } from '../storage/safe-storage';

export type SfxName =
  | 'tap' | 'select' | 'back' | 'error'
  | 'step' | 'encounter' | 'item'
  | 'whoosh' | 'hit' | 'crit' | 'super' | 'faint' | 'heal' | 'up' | 'down' | 'status'
  | 'catch' | 'levelup';

type Wave = OscillatorType;
type Note = readonly [freq: number, seconds: number];

/** Never fire the same blip twice inside this window (key-repeat, rapid taps). */
const MIN_GAP_MS = 45;

/**
 * Tiny synthesised sound effects (WebAudio — no asset downloads, nothing to cache). The audio
 * context is created on the first play, which always follows a user gesture, so autoplay rules
 * never bite. Mute and volume persist and are exposed as signals for the profile page.
 */
@Injectable({ providedIn: 'root' })
export class SfxService {
  readonly muted = signal(safeGet('sfx:muted') === '1');
  readonly volume = signal(clamp01(Number(safeGet('sfx:volume') ?? 0.6)));

  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private readonly last = new Map<SfxName, number>();

  setMuted(on: boolean): void {
    this.muted.set(on);
    safeSet('sfx:muted', on ? '1' : '0');
    if (!on) this.play('select');
  }

  setVolume(v: number): void {
    const vol = clamp01(v);
    this.volume.set(vol);
    safeSet('sfx:volume', String(vol));
    if (this.master) this.master.gain.value = vol;
  }

  play(name: SfxName): void {
    if (this.muted() || this.volume() <= 0 || typeof document === 'undefined' || document.hidden) return;
    const now = performance.now();
    if (now - (this.last.get(name) ?? -1e9) < MIN_GAP_MS) return;
    this.last.set(name, now);
    const ctx = this.ensure();
    if (!ctx) return;
    if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
    const t = ctx.currentTime;
    switch (name) {
      case 'tap': this.tone(t, 880, 0.05, 'sine', 0.16, 660); break;
      case 'select': this.seq(t, [[660, 0.05], [990, 0.07]], 'sine', 0.16); break;
      case 'back': this.tone(t, 520, 0.08, 'sine', 0.16, 380); break;
      case 'error': this.seq(t, [[200, 0.1], [160, 0.14]], 'square', 0.1); break;
      case 'step': this.step(); break;
      case 'encounter': this.seq(t, [[880, 0.07], [660, 0.07], [880, 0.07], [1175, 0.14]], 'square', 0.1); break;
      case 'item': this.seq(t, [[988, 0.07], [1319, 0.12]], 'sine', 0.18); break;
      case 'whoosh': this.puff(t, 0.2, 500, 0.12, 1900); break;
      case 'hit': this.hit(t, 1); break;
      case 'crit': this.hit(t, 1.25); this.tone(t, 900, 0.16, 'square', 0.1, 300); break;
      case 'super': this.hit(t, 1.1); this.tone(t + 0.02, 660, 0.14, 'triangle', 0.14, 1320); break;
      case 'faint': this.tone(t, 440, 0.55, 'sawtooth', 0.14, 90); break;
      case 'heal': this.seq(t, [[523, 0.09], [659, 0.09], [784, 0.14]], 'sine', 0.17); break;
      case 'up': this.tone(t, 440, 0.16, 'triangle', 0.16, 880); break;
      case 'down': this.tone(t, 440, 0.18, 'triangle', 0.16, 200); break;
      case 'status': this.seq(t, [[330, 0.08], [277, 0.08], [330, 0.1]], 'square', 0.08); break;
      case 'catch': this.tone(t, 1200, 0.04, 'square', 0.1); this.seq(t + 0.12, [[523, 0.1], [659, 0.1], [784, 0.1], [1046, 0.2]], 'triangle', 0.17); break;
      case 'levelup': this.seq(t, [[523, 0.1], [659, 0.1], [784, 0.1], [1046, 0.1], [1318, 0.26]], 'triangle', 0.17); break;
    }
  }

  /* --------------------------------------------------------------- synth */

  private ensure(): AudioContext | null {
    if (this.ctx) return this.ctx;
    const Ctor = (globalThis as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext
      ?? (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    try {
      this.ctx = new Ctor();
    } catch {
      return null;
    }
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume();
    this.master.connect(this.ctx.destination);
    return this.ctx;
  }

  private tone(t: number, freq: number, dur: number, wave: Wave, vol: number, slideTo?: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.master!);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private seq(t: number, notes: readonly Note[], wave: Wave, vol: number): void {
    let at = t;
    for (const [f, d] of notes) {
      this.tone(at, f, d + 0.04, wave, vol);
      at += d;
    }
  }

  /** A filtered noise burst — footsteps, whooshes, the body of a hit. */
  private puff(t: number, dur: number, cutoff: number, vol: number, sweepTo?: number): void {
    const ctx = this.ctx!;
    if (!this.noise) {
      const n = Math.floor(ctx.sampleRate * 0.4);
      this.noise = ctx.createBuffer(1, n, ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    }
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = sweepTo ? 'bandpass' : 'lowpass';
    f.frequency.setValueAtTime(cutoff, t);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.master!);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  /**
   * Footsteps fire constantly, so they are baked once into a buffer (a decaying, low-passed noise tick)
   * and played through a single node — building a filter + gain graph per step cost real frame time on weak phones.
   */
  private stepBuf: AudioBuffer | null = null;
  private stepCount = 0;
  private step(): void {
    if ((this.stepCount++ & 1) === 1) return; // every other step is plenty
    const ctx = this.ctx!;
    if (!this.stepBuf) {
      const n = Math.floor(ctx.sampleRate * 0.05);
      this.stepBuf = ctx.createBuffer(1, n, ctx.sampleRate);
      const d = this.stepBuf.getChannelData(0);
      let lp = 0;
      for (let i = 0; i < n; i++) {
        lp += ((Math.random() * 2 - 1) - lp) * 0.12; // one-pole low-pass
        d[i] = lp * 0.9 * Math.pow(1 - i / n, 2.5);
      }
    }
    const src = ctx.createBufferSource();
    src.buffer = this.stepBuf;
    src.playbackRate.value = 0.85 + Math.random() * 0.35;
    src.connect(this.master!);
    src.start();
  }

  private hit(t: number, power: number): void {
    this.puff(t, 0.1, 1400, 0.3 * power);
    this.tone(t, 170, 0.14, 'sine', 0.3 * power, 55);
  }
}

function clamp01(v: number): number {
  return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0.6;
}
