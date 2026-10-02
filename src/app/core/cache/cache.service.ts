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

/** Upper bound for the in-memory mirror (entries beyond it are evicted least-recently-used). */
const MAX_MEMORY_ENTRIES = 400;

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
      const opened = openDB<PokeVerseDb>('pokeverse-arena', 1, {
        upgrade(db) {
          if (!db.objectStoreNames.contains('api-cache')) {
            db.createObjectStore('api-cache', { keyPath: 'key' });
          }
          if (!db.objectStoreNames.contains('savegame')) {
            db.createObjectStore('savegame');
          }
        },
        // Another tab wants to upgrade/delete the DB: step aside so it isn't stuck.
        blocking: () => {
          void opened.then((db) => db.close()).catch(() => undefined);
          this.dbPromise = null;
        },
        // The browser killed the connection (storage cleared, crash): reopen lazily.
        terminated: () => {
          this.dbPromise = null;
        },
      });
      // A failed open must not be cached forever — retry on the next call.
      opened.catch(() => {
        this.dbPromise = null;
      });
      this.dbPromise = opened;
      this.scheduleSweep();
    }
    return this.dbPromise;
  }

  /** Drop expired rows once per session, when the browser is idle. */
  private scheduleSweep(): void {
    const run = () => void this.sweepExpired();
    if (typeof requestIdleCallback === 'function') requestIdleCallback(run, { timeout: 10_000 });
    else setTimeout(run, 3000);
  }

  /** Delete every expired `api-cache` row (reads only evict the rows they touch). */
  async sweepExpired(now = Date.now()): Promise<number> {
    let removed = 0;
    try {
      const db = await this.db();
      const tx = db.transaction('api-cache', 'readwrite');
      let cursor = await tx.store.openCursor();
      while (cursor) {
        const exp = cursor.value.expiresAt;
        if (exp && exp < now) {
          await cursor.delete();
          removed++;
        }
        cursor = await cursor.continue();
      }
      await tx.done;
    } catch {
      /* best effort */
    }
    return removed;
  }

  /** LRU mirror: touching an entry moves it to the back; overflow evicts from the front. */
  private remember(key: string, entry: CacheEntry): void {
    this.memory.delete(key);
    this.memory.set(key, entry);
    if (this.memory.size > MAX_MEMORY_ENTRIES) {
      const oldest = this.memory.keys().next().value;
      if (oldest !== undefined) this.memory.delete(oldest);
    }
  }

  async get<T>(key: string): Promise<T | undefined> {
    const cached = this.memory.get(key) ?? (await this.readDb(key));
    if (!cached) return undefined;
    if (cached.expiresAt && cached.expiresAt < Date.now()) {
      await this.delete(key);
      return undefined;
    }
    this.remember(key, cached);
    return cached.data as T;
  }

  async set<T>(key: string, data: T, ttlMs: number = DEFAULT_TTL_MS): Promise<void> {
    const entry: CacheEntry<T> = {
      key,
      data,
      fetchedAt: Date.now(),
      expiresAt: ttlMs > 0 ? Date.now() + ttlMs : undefined,
    };
    this.remember(key, entry);
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
