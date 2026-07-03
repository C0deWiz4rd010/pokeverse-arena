import { Injectable, signal } from '@angular/core';
import type { IconName } from '../icon/icons.data';

export interface Toast {
  readonly id: number;
  readonly title: string;
  readonly text?: string;
  readonly icon: IconName;
  /** Visual flavour — achievements get the celebratory gradient. */
  readonly kind: 'achievement' | 'info';
}

const DEFAULT_MS = 6000;
const MAX_VISIBLE = 4;

/**
 * Global, app-wide toast stack (rendered by `pv-toasts` in the shell).
 * Feature-local inline toasts (spire, world, RPG dialogue) stay as they are —
 * this is for cross-cutting notifications like achievement unlocks.
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private seq = 0;
  private readonly _toasts = signal<readonly Toast[]>([]);
  readonly toasts = this._toasts.asReadonly();

  show(toast: Omit<Toast, 'id'>, ms = DEFAULT_MS): void {
    const entry: Toast = { ...toast, id: ++this.seq };
    this._toasts.update((list) => [...list, entry].slice(-MAX_VISIBLE));
    setTimeout(() => this.dismiss(entry.id), ms);
  }

  dismiss(id: number): void {
    this._toasts.update((list) => list.filter((t) => t.id !== id));
  }
}
