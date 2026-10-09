import { Injectable, signal } from '@angular/core';
import { cryUrl } from '../api/pokeapi-endpoints';
import { safeGet, safeSet } from '../storage/safe-storage';

/**
 * Plays Pokémon cries through a single shared `Audio` element, so a new cry always
 * interrupts the previous one and at most one plays at a time. Cry URLs are derived
 * by id (no API request). Honours a persisted mute toggle.
 */
@Injectable({ providedIn: 'root' })
export class CryService {
  readonly muted = signal<boolean>(safeGet('cry:muted') === '1');
  /** The id currently playing (for a little speaker-pulse in the UI). */
  readonly playing = signal<number | null>(null);

  toggleMute(): void {
    const next = !this.muted();
    this.muted.set(next);
    try {
      safeSet('cry:muted', next ? '1' : '0');
    } catch {
      /* ignore */
    }
    if (next) this.stop();
  }

  /** One reusable element per voice, so a fast run of cries never allocates a pile of `Audio`s. */
  private voice(slot: 0 | 1): HTMLAudioElement {
    return (this.voices[slot] ??= new Audio());
  }
  private readonly voices: (HTMLAudioElement | undefined)[] = [];
  private pairTimer: ReturnType<typeof setTimeout> | null = null;

  play(id: number, volume = 0.5): void {
    if (this.muted() || typeof Audio === 'undefined') return;
    this.stop();
    this.start(0, id, volume, 1);
    this.playing.set(id);
  }

  /** A chimera's voice: the head answers first, the body follows a beat later, pitched up. */
  playPair(head: number, body: number): void {
    if (this.muted() || typeof Audio === 'undefined') return;
    this.stop();
    this.start(0, head, 0.45, 1);
    this.pairTimer = setTimeout(() => this.start(1, body, 0.4, 1.18), 420);
  }

  private start(slot: 0 | 1, id: number, volume: number, rate: number): void {
    const audio = this.voice(slot);
    audio.pause();
    audio.src = cryUrl(id);
    audio.volume = volume;
    audio.playbackRate = rate;
    audio.onended = () => this.clear(id);
    audio.onerror = () => this.clear(id);
    void audio.play().catch(() => this.clear(id));
  }

  stop(): void {
    if (this.pairTimer) clearTimeout(this.pairTimer);
    this.pairTimer = null;
    for (const v of this.voices) v?.pause();
    this.playing.set(null);
  }

  private clear(id: number): void {
    if (this.playing() === id) this.playing.set(null);
  }
}
