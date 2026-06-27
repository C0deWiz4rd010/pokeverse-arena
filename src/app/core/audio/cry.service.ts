import { Injectable, signal } from '@angular/core';
import { cryUrl } from '../api/pokeapi-endpoints';

/**
 * Plays Pokémon cries through a single shared `Audio` element, so a new cry always
 * interrupts the previous one and at most one plays at a time. Cry URLs are derived
 * by id (no API request). Honours a persisted mute toggle.
 */
@Injectable({ providedIn: 'root' })
export class CryService {
  private audio: HTMLAudioElement | null = null;
  readonly muted = signal<boolean>(localStorage.getItem('cry:muted') === '1');
  /** The id currently playing (for a little speaker-pulse in the UI). */
  readonly playing = signal<number | null>(null);

  toggleMute(): void {
    const next = !this.muted();
    this.muted.set(next);
    try {
      localStorage.setItem('cry:muted', next ? '1' : '0');
    } catch {
      /* ignore */
    }
    if (next) this.stop();
  }

  play(id: number, volume = 0.5): void {
    if (this.muted() || typeof Audio === 'undefined') return;
    this.stop();
    const audio = new Audio(cryUrl(id));
    audio.volume = volume;
    this.audio = audio;
    this.playing.set(id);
    audio.addEventListener('ended', () => this.clear(id), { once: true });
    audio.addEventListener('error', () => this.clear(id), { once: true });
    void audio.play().catch(() => this.clear(id));
  }

  stop(): void {
    if (this.audio) {
      this.audio.pause();
      this.audio = null;
    }
    this.playing.set(null);
  }

  private clear(id: number): void {
    if (this.playing() === id) this.playing.set(null);
  }
}
