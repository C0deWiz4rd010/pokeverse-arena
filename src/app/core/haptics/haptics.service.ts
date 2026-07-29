import { Injectable, inject, signal } from '@angular/core';
import { SaveService } from '../storage/save.service';

/** Named vibration patterns (ms on/off), tuned to feel purposeful not noisy. */
const PATTERNS = {
  tap: [8],
  select: [12],
  success: [14, 40, 26],
  error: [30, 50, 30],
  impact: [22],
  heavy: [40],
} as const;

export type HapticPattern = keyof typeof PATTERNS;

/**
 * Thin wrapper over the Vibration API. Fires only when the device supports it,
 * the user hasn't disabled haptics, and reduced-motion isn't requested. State is
 * a signal so a settings toggle can bind to it; the choice persists.
 */
@Injectable({ providedIn: 'root' })
export class HapticsService {
  private readonly save = inject(SaveService);
  private readonly key = 'haptics-enabled';

  private readonly canVibrate =
    typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
  private readonly reduced =
    typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  readonly enabled = signal(this.save.read(this.key, true));

  /** Whether this device exposes the Vibration API at all (for hiding the UI). */
  readonly supported = this.canVibrate;

  fire(pattern: HapticPattern): void {
    if (!this.canVibrate || this.reduced || !this.enabled()) return;
    try {
      navigator.vibrate(PATTERNS[pattern] as unknown as number[]);
    } catch {
      /* some browsers throw on gesture-less vibrate — safe to ignore */
    }
  }

  setEnabled(on: boolean): void {
    this.enabled.set(on);
    this.save.write(this.key, on);
    if (on) this.fire('tap');
  }

  toggle(): void {
    this.setEnabled(!this.enabled());
  }
}
