/**
 * Pure, client-side filtering + sorting for the Pokédex. Operates on the enriched
 * in-memory index (entries already carry `types` + `gen`), so everything stays
 * synchronous, deterministic and unit-testable — no network in here.
 */
import { SeededRng } from '../../core/utils/rng';
import type { PokedexEntry } from '../../core/models/pokemon.model';
import { isPokemonType, type PokemonType } from '../../core/utils/type-chart';

export type DexSort = 'id' | 'id-desc' | 'name' | 'gen' | 'type' | 'fav' | 'random';
export type DexView = 'gallery' | 'compact' | 'list';
export type TypeMode = 'or' | 'and';

export interface DexCriteria {
  readonly query: string;
  readonly types: readonly PokemonType[];
  readonly typeMode: TypeMode;
  readonly gen: number | null;
  readonly favOnly: boolean;
  readonly favorites: ReadonlySet<number>;
}

interface IdRange {
  readonly min: number;
  readonly max: number;
}

/** Parse a "#1-151" / "1 - 151" id-range query, or null when it isn't one. */
export function parseRange(query: string): IdRange | null {
  const m = /^#?(\d+)\s*-\s*#?(\d+)$/.exec(query.trim());
  if (!m) return null;
  const a = Number(m[1]);
  const b = Number(m[2]);
  return { min: Math.min(a, b), max: Math.max(a, b) };
}

/** Whether a single entry satisfies a free-text query (name / id / range / type). */
export function matchesQuery(entry: PokedexEntry, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const range = parseRange(q);
  if (range) return entry.id >= range.min && entry.id <= range.max;
  if (entry.name.includes(q)) return true;
  if (String(entry.id) === q || `#${entry.id}` === q) return true;
  return entry.types.some((t) => t.includes(q));
}

/** Apply every active filter to the index. */
export function applyDexFilters(index: readonly PokedexEntry[], c: DexCriteria): PokedexEntry[] {
  return index.filter((e) => {
    if (c.favOnly && !c.favorites.has(e.id)) return false;
    if (c.gen != null && e.gen !== c.gen) return false;
    if (c.types.length) {
      const ok =
        c.typeMode === 'and'
          ? c.types.every((t) => e.types.includes(t))
          : c.types.some((t) => e.types.includes(t));
      if (!ok) return false;
    }
    return matchesQuery(e, c.query);
  });
}

/** Sort a filtered list. `random` is seeded so it stays stable across re-renders. */
export function sortDex(
  entries: readonly PokedexEntry[],
  sort: DexSort,
  favorites: ReadonlySet<number>,
  seed = 0,
): PokedexEntry[] {
  const out = [...entries];
  switch (sort) {
    case 'id-desc':
      return out.sort((a, b) => b.id - a.id);
    case 'name':
      return out.sort((a, b) => a.name.localeCompare(b.name));
    case 'gen':
      return out.sort((a, b) => a.gen - b.gen || a.id - b.id);
    case 'type':
      return out.sort((a, b) => (a.types[0] ?? '').localeCompare(b.types[0] ?? '') || a.id - b.id);
    case 'fav':
      return out.sort((a, b) => Number(favorites.has(b.id)) - Number(favorites.has(a.id)) || a.id - b.id);
    case 'random':
      return new SeededRng(`dex-${seed}`).shuffle(out);
    default:
      return out.sort((a, b) => a.id - b.id);
  }
}

/** Coerce an arbitrary string to a known sort id (for URL/state restore). */
export function asSort(value: string | null): DexSort {
  const all: DexSort[] = ['id', 'id-desc', 'name', 'gen', 'type', 'fav', 'random'];
  return all.includes(value as DexSort) ? (value as DexSort) : 'id';
}

/** Coerce an arbitrary string to a known view id. */
export function asView(value: string | null): DexView {
  const all: DexView[] = ['gallery', 'compact', 'list'];
  return all.includes(value as DexView) ? (value as DexView) : 'gallery';
}

/** Parse a comma-separated list of type names, keeping only valid types. */
export function parseTypes(csv: string | null): PokemonType[] {
  if (!csv) return [];
  return csv.split(',').map((s) => s.trim()).filter(isPokemonType);
}
