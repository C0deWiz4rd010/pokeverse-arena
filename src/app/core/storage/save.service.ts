import { Injectable, inject } from '@angular/core';
import { ToastService } from '../ui/toast/toast.service';
import { EnvelopeStore, type KeyValueStore } from './envelope-store';

/**
 * The app-wide persistence service: a thin Angular wrapper over {@link EnvelopeStore}
 * (versioned `{ v, data }` envelopes, migrations, legacy-key import, corrupt-blob backup)
 * that adds a one-time toast when a write fails (quota, blocked storage) so progress
 * never vanishes silently.
 */
@Injectable({ providedIn: 'root' })
export class SaveService implements KeyValueStore {
  private readonly toast = inject(ToastService);
  private warnedWriteFailure = false;
  private readonly store = new EnvelopeStore(() => this.warnWriteFailed());

  read<T>(key: string, fallback: T): T {
    return this.store.read(key, fallback);
  }

  /** Returns false when the write failed (and tells the player once per session). */
  write<T>(key: string, value: T): boolean {
    return this.store.write(key, value);
  }

  remove(key: string): void {
    this.store.remove(key);
  }

  /** Raw read of a legacy (un-namespaced) key, for migrating older saves. */
  readLegacy<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
      return fallback;
    }
  }

  /**
   * Ask the browser not to evict our storage under pressure. Best effort; call
   * once at startup.
   */
  async requestPersistence(): Promise<boolean> {
    try {
      if (!navigator.storage?.persist) return false;
      return (await navigator.storage.persisted()) || (await navigator.storage.persist());
    } catch {
      return false;
    }
  }

  private warnWriteFailed(): void {
    if (this.warnedWriteFailure) return;
    this.warnedWriteFailure = true;
    this.toast.show(
      {
        title: 'Progress could not be saved',
        text: 'Browser storage is full or blocked. Export your save from the Profile page.',
        icon: 'download',
        kind: 'info',
      },
      9000,
    );
  }
}
