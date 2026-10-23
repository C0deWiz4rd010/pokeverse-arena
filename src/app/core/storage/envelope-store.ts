import { LEGACY_SOURCES, MIGRATIONS, currentVersion, migrateData } from './migrations';

interface Envelope {
  v: number;
  data: unknown;
}

function isEnvelope(x: unknown): x is Envelope {
  return !!x && typeof x === 'object' && 'data' in x;
}

/** What pure game modules need from storage — no Angular, easy to fake in specs. */
export interface KeyValueStore {
  read<T>(key: string, fallback: T): T;
  /** Returns false when the write failed. */
  write<T>(key: string, value: T): boolean;
  remove(key: string): void;
}

/**
 * Typed, namespaced, versioned storage over localStorage: values are stored as
 * `{ v, data }` under `pv:<key>`; older versions run through the migration ladder, and
 * keys that used to live un-namespaced are imported once from their legacy slot
 * ({@link LEGACY_SOURCES}). Every access is defensive (storage may be disabled), an
 * unreadable blob is kept as a `…:corrupt` copy instead of being lost, and a failed write
 * is reported through `onWriteFailed`.
 */
export class EnvelopeStore implements KeyValueStore {
  private readonly prefix = 'pv:';

  constructor(private readonly onWriteFailed?: () => void) {}

  read<T>(key: string, fallback: T): T {
    let raw: string | null;
    try {
      raw = localStorage.getItem(this.prefix + key);
    } catch {
      return fallback;
    }
    if (!raw) return this.importLegacy(key, fallback);
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

  write<T>(key: string, value: T): boolean {
    try {
      const env: Envelope = { v: currentVersion(key), data: value };
      localStorage.setItem(this.prefix + key, JSON.stringify(env));
      return true;
    } catch {
      this.onWriteFailed?.();
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

  /** One-time import of a value an older version stored under an un-namespaced key. */
  private importLegacy<T>(key: string, fallback: T): T {
    const source = LEGACY_SOURCES[key];
    if (!source) return fallback;
    try {
      const raw = localStorage.getItem(source.key);
      if (raw === null) return fallback;
      const value = source.parse(raw);
      if (value === undefined) return fallback;
      if (this.write(key, value)) localStorage.removeItem(source.key);
      return value as T;
    } catch {
      return fallback;
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
}

/** Shared instance for code that cannot inject services (the pure `game/**` modules). */
export const appStore = new EnvelopeStore();
