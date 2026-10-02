/**
 * Whole-save export/import. The site shares its origin with other GitHub Pages
 * projects, so only keys that belong to this app are touched. The API cache lives
 * in IndexedDB and is deliberately excluded — it is re-fetchable.
 */
export const BACKUP_APP = 'pokeverse-arena';
export const BACKUP_FORMAT = 1;

/** Namespaced saves (`pv:`) plus the few legacy un-namespaced keys. */
const OWNED_PREFIXES = ['pv:', 'arena:', 'cry:', 'odyssey:', 'spire:', 'tournaments:'] as const;

const MAX_ENTRIES = 500;
const MAX_VALUE_CHARS = 2_000_000;
const MAX_TOTAL_CHARS = 8_000_000;

export interface BackupFile {
  readonly app: typeof BACKUP_APP;
  readonly format: number;
  readonly exportedAt: string;
  readonly appVersion: string;
  readonly entries: Readonly<Record<string, string>>;
}

export function isOwnedKey(key: string): boolean {
  return OWNED_PREFIXES.some((p) => key.startsWith(p)) && !key.endsWith(':corrupt') && key !== 'pv:chunk-reload';
}

export function buildBackup(storage: Pick<Storage, 'length' | 'key' | 'getItem'>, appVersion: string, now = new Date()): BackupFile {
  const entries: Record<string, string> = {};
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key && isOwnedKey(key)) {
      const value = storage.getItem(key);
      if (value !== null) entries[key] = value;
    }
  }
  return { app: BACKUP_APP, format: BACKUP_FORMAT, exportedAt: now.toISOString(), appVersion, entries };
}

export type ParsedBackup = { ok: true; entries: Record<string, string> } | { ok: false; error: string };

/** Validate untrusted backup text; only plain string values for owned keys are accepted. */
export function parseBackup(text: string): ParsedBackup {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: 'This file is not valid JSON.' };
  }
  const o = json as Partial<BackupFile> | null;
  if (!o || typeof o !== 'object' || o.app !== BACKUP_APP) return { ok: false, error: 'This is not a PokéVerse Arena backup.' };
  if (typeof o.format !== 'number' || o.format > BACKUP_FORMAT) return { ok: false, error: 'This backup comes from a newer version of the app.' };
  if (!o.entries || typeof o.entries !== 'object' || Array.isArray(o.entries)) return { ok: false, error: 'The backup contains no data.' };

  const entries: Record<string, string> = {};
  let total = 0;
  for (const [key, value] of Object.entries(o.entries)) {
    if (!isOwnedKey(key) || typeof value !== 'string' || value.length > MAX_VALUE_CHARS) continue;
    try {
      JSON.parse(value);
    } catch {
      continue; // every stored value is JSON; skip anything else
    }
    total += value.length;
    if (total > MAX_TOTAL_CHARS) return { ok: false, error: 'The backup is too large.' };
    entries[key] = value;
    if (Object.keys(entries).length > MAX_ENTRIES) return { ok: false, error: 'The backup contains too many entries.' };
  }
  if (Object.keys(entries).length === 0) return { ok: false, error: 'The backup contains no usable data.' };
  return { ok: true, entries };
}
