import { Injectable } from '@angular/core';

/**
 * Tiny typed, namespaced, versioned wrapper over localStorage — the single place
 * app state is persisted. Values are stored as `{ v, data }` so a future schema
 * bump can migrate cleanly. Every access is defensive (storage may be disabled).
 */
@Injectable({ providedIn: 'root' })
export class SaveService {
  private readonly prefix = 'pv:';
  private readonly version = 1;

  read<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(this.prefix + key);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw) as { v: number; data: T };
      return parsed && typeof parsed === 'object' && 'data' in parsed ? parsed.data : fallback;
    } catch {
      return fallback;
    }
  }

  write<T>(key: string, value: T): void {
    try {
      localStorage.setItem(this.prefix + key, JSON.stringify({ v: this.version, data: value }));
    } catch {
      /* storage unavailable — state simply won't persist */
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
}
