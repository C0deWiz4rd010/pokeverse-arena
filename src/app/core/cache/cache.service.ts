import { Injectable } from '@angular/core';
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

interface CacheEntry<T = unknown> {
  key: string;
  data: T;
  fetchedAt: number;
  expiresAt?: number;
}

interface PokeVerseDb extends DBSchema {
  'api-cache': {
    key: string;
    value: CacheEntry;
  };
  savegame: {
    key: string;
    value: unknown;
  };
}

/** Default time-to-live for cached API responses: 7 days. */
const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * IndexedDB-backed cache for PokeAPI responses and the local savegame.
 *
 * Used by {@link PokeApiClient} to implement a cache-first strategy so the app
 * is offline-capable and respectful of PokeAPI's fair-use policy.
 */
@Injectable({ providedIn: 'root' })
export class CacheService {
  private dbPromise: Promise<IDBPDatabase<PokeVerseDb>> | null = null;

  /** In-memory mirror to avoid repeated IndexedDB round-trips within a session. */
  private readonly memory = new Map<string, CacheEntry>();

  private db(): Promise<IDBPDatabase<PokeVerseDb>> {
    if (!this.dbPromise) {
      this.dbPromise = openDB<PokeVerseDb>('pokeverse-arena', 1, {
        upgrade(db) {
          if (!db.objectStoreNames.contains('api-cache')) {
            db.createObjectStore('api-cache', { keyPath: 'key' });
          }
          if (!db.objectStoreNames.contains('savegame')) {
            db.createObjectStore('savegame');
          }
        },
      });
    }
    return this.dbPromise;
  }

  async get<T>(key: string): Promise<T | undefined> {
    const cached = this.memory.get(key) ?? (await this.readDb(key));
    if (!cached) return undefined;
    if (cached.expiresAt && cached.expiresAt < Date.now()) {
      await this.delete(key);
      return undefined;
    }
    this.memory.set(key, cached);
    return cached.data as T;
  }

  async set<T>(key: string, data: T, ttlMs: number = DEFAULT_TTL_MS): Promise<void> {
    const entry: CacheEntry<T> = {
      key,
      data,
      fetchedAt: Date.now(),
      expiresAt: ttlMs > 0 ? Date.now() + ttlMs : undefined,
    };
    this.memory.set(key, entry);
    try {
      const db = await this.db();
      await db.put('api-cache', entry);
    } catch {
      /* IndexedDB may be unavailable (private mode) — memory cache still works. */
    }
  }

  async delete(key: string): Promise<void> {
    this.memory.delete(key);
    try {
      const db = await this.db();
      await db.delete('api-cache', key);
    } catch {
      /* ignore */
    }
  }

  /** Clear the entire API cache (the "Refresh data" action). */
  async clearApiCache(): Promise<void> {
    this.memory.clear();
    try {
      const db = await this.db();
      await db.clear('api-cache');
    } catch {
      /* ignore */
    }
  }

  /* ----------------------------------------------------------- savegame */

  async saveState<T>(key: string, value: T): Promise<void> {
    try {
      const db = await this.db();
      await db.put('savegame', value, key);
    } catch {
      /* ignore */
    }
  }

  async loadState<T>(key: string): Promise<T | undefined> {
    try {
      const db = await this.db();
      return (await db.get('savegame', key)) as T | undefined;
    } catch {
      return undefined;
    }
  }

  private async readDb(key: string): Promise<CacheEntry | undefined> {
    try {
      const db = await this.db();
      return await db.get('api-cache', key);
    } catch {
      return undefined;
    }
  }
}
