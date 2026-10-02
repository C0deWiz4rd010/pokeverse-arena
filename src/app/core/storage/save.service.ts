import { Injectable, inject } from '@angular/core';
import { ToastService } from '../ui/toast/toast.service';
import { MIGRATIONS, currentVersion, migrateData } from './migrations';

interface Envelope {
  v: number;
  data: unknown;
}

function isEnvelope(x: unknown): x is Envelope {
  return !!x && typeof x === 'object' && 'data' in x;
}

/**
 * Tiny typed, namespaced, versioned wrapper over localStorage — the single place
 * app state is persisted. Values are stored as `{ v, data }`; on read, older
 * versions run through the migration ladder in `migrations.ts`. Every access is
 * defensive (storage may be disabled), unreadable blobs are kept as a
 * `…:corrupt` backup instead of being silently lost, and a failed write
 * (quota, blocked storage) is reported once instead of vanishing.
 */
@Injectable({ providedIn: 'root' })
export class SaveService {
  private readonly toast = inject(ToastService);
  private readonly prefix = 'pv:';
  private warnedWriteFailure = false;

  read<T>(key: string, fallback: T): T {
    let raw: string | null;
    try {
      raw = localStorage.getItem(this.prefix + key);
    } catch {
      return fallback;
    }
    if (!raw) return fallback;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!isEnvelope(parsed)) throw new Error('not an envelope');
      const from = typeof parsed.v === 'number' ? parsed.v : 1;
      return migrateData(key, parsed.data, from, MIGRATIONS) as T;
    } catch {
      this.backupCorrupt(key, raw);
      return fallback;
    }
  }

  /** Returns false when the write failed (and tells the player once per session). */
  write<T>(key: string, value: T): boolean {
    try {
      const env: Envelope = { v: currentVersion(key), data: value };
      localStorage.setItem(this.prefix + key, JSON.stringify(env));
      return true;
    } catch {
      this.warnWriteFailed();
      return false;
    }
  }

  remove(key: string): void {
    try {
      localStorage.removeItem(this.prefix + key);
    } catch {
      /* ignore */
    }
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

  private backupCorrupt(key: string, raw: string): void {
    try {
      // Keep the first corrupt copy only, so repeated reads don't overwrite evidence.
      const slot = `${this.prefix}${key}:corrupt`;
      if (localStorage.getItem(slot) === null) localStorage.setItem(slot, raw);
    } catch {
      /* ignore */
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
