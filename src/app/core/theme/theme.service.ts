import { Injectable, inject, signal } from '@angular/core';
import { SaveService } from '../storage/save.service';

export interface AccentTheme {
  readonly id: string;
  readonly name: string;
  /** Primary accent (buttons, focus, highlights). */
  readonly accent: string;
  /** Secondary accent (gradient partner). */
  readonly accent2: string;
  /** Tertiary accent (eyebrows, sparks). */
  readonly accent3: string;
}

/** Curated accent palettes — all light enough for dark-navy button text. */
export const ACCENT_THEMES: readonly AccentTheme[] = [
  { id: 'aurora', name: 'Aurora', accent: '#6ce0ff', accent2: '#c46bff', accent3: '#ffd166' },
  { id: 'ember', name: 'Ember', accent: '#ff9d55', accent2: '#ff5d73', accent3: '#ffd166' },
  { id: 'verdant', name: 'Verdant', accent: '#56e39f', accent2: '#6ce0ff', accent3: '#d9f99d' },
  { id: 'sakura', name: 'Sakura', accent: '#ec8fe6', accent2: '#c46bff', accent3: '#ffd166' },
  { id: 'solar', name: 'Solar', accent: '#ffd166', accent2: '#ff9d55', accent3: '#6ce0ff' },
] as const;

const KEY = 'theme:accent';

/**
 * Applies the chosen accent palette by overriding the `--accent*` design
 * tokens on `<html>` — every component picks it up for free. Persisted; the
 * app shell injects this service so the saved palette applies at startup.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly save = inject(SaveService);

  private readonly _themeId = signal(this.save.read(KEY, 'aurora'));
  readonly themeId = this._themeId.asReadonly();
  readonly themes = ACCENT_THEMES;

  constructor() {
    this.applyToDom(this.current());
  }

  current(): AccentTheme {
    return ACCENT_THEMES.find((t) => t.id === this._themeId()) ?? ACCENT_THEMES[0];
  }

  setTheme(id: string): void {
    if (!ACCENT_THEMES.some((t) => t.id === id)) return;
    this._themeId.set(id);
    this.save.write(KEY, id);
    this.applyToDom(this.current());
  }

  private applyToDom(theme: AccentTheme): void {
    const root = document.documentElement.style;
    if (theme.id === 'aurora') {
      // Default palette lives in theme.scss — drop the overrides entirely.
      root.removeProperty('--accent');
      root.removeProperty('--accent-2');
      root.removeProperty('--accent-3');
      return;
    }
    root.setProperty('--accent', theme.accent);
    root.setProperty('--accent-2', theme.accent2);
    root.setProperty('--accent-3', theme.accent3);
  }
}
