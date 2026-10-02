/**
 * Versioned save migrations. Every blob written by {@link SaveService} carries the
 * schema version it was written with (`v`). A key's current version is
 * `1 + migrations.length`; entry `i` upgrades data from version `i + 1` to `i + 2`.
 *
 * To change a stored shape: append a function to that key's list — never edit or
 * reorder existing entries.
 */
export type Migration = (data: unknown) => unknown;

export const MIGRATIONS: Readonly<Record<string, readonly Migration[]>> = {};

/** Migrations registered for a key (`rpg:save:2` falls back to `rpg:save`). */
export function migrationsFor(key: string, table: Readonly<Record<string, readonly Migration[]>>): readonly Migration[] {
  if (table[key]) return table[key];
  const base = Object.keys(table).find((k) => key.startsWith(k + ':'));
  return base ? table[base] : [];
}

export function currentVersion(key: string, table: Readonly<Record<string, readonly Migration[]>> = MIGRATIONS): number {
  return 1 + migrationsFor(key, table).length;
}

/** Runs the migration ladder from `from` up to the key's current version. */
export function migrateData(
  key: string,
  data: unknown,
  from: number,
  table: Readonly<Record<string, readonly Migration[]>> = MIGRATIONS,
): unknown {
  const chain = migrationsFor(key, table);
  let out = data;
  for (let v = Math.max(1, from); v <= chain.length; v++) out = chain[v - 1](out);
  return out;
}
