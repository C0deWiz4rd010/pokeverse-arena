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

  /** Auto-dismiss bookkeeping per toast, so hovering/focusing can pause the countdown. */
  private readonly timers = new Map<number, { handle: ReturnType<typeof setTimeout>; endAt: number }>();
  private readonly remaining = new Map<number, number>();

  show(toast: Omit<Toast, 'id'>, ms = DEFAULT_MS): void {
    const entry: Toast = { ...toast, id: ++this.seq };
    this._toasts.update((list) => [...list, entry].slice(-MAX_VISIBLE));
    this.schedule(entry.id, ms);
  }

  dismiss(id: number): void {
    const t = this.timers.get(id);
    if (t) clearTimeout(t.handle);
    this.timers.delete(id);
    this.remaining.delete(id);
    this._toasts.update((list) => list.filter((x) => x.id !== id));
  }

  /** Hold a toast on screen while it is being read (pointer over it / keyboard focus). */
  pause(id: number): void {
    const t = this.timers.get(id);
    if (!t) return;
    clearTimeout(t.handle);
    this.timers.delete(id);
    this.remaining.set(id, Math.max(1500, t.endAt - Date.now()));
  }

  resume(id: number): void {
    const left = this.remaining.get(id);
    if (left === undefined) return;
    this.remaining.delete(id);
    this.schedule(id, left);
  }

  private schedule(id: number, ms: number): void {
    this.timers.set(id, { handle: setTimeout(() => this.dismiss(id), ms), endAt: Date.now() + ms });
  }
}
