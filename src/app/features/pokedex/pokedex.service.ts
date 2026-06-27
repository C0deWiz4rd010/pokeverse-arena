import { Injectable, computed, inject, signal } from '@angular/core';
import { PokeApiClient } from '../../core/api/pokeapi.client';
import { POKEAPI_BASE, idFromUrl, officialArtwork } from '../../core/api/pokeapi-endpoints';
import { SaveService } from '../../core/storage/save.service';
import type { NamedApiResourceList, GenerationDto } from '../../core/dto/pokeapi.dto';
import type { PokedexEntry } from '../../core/models/pokemon.model';
import { POKEMON_TYPES, type PokemonType } from '../../core/utils/type-chart';
import {
  applyDexFilters,
  asSort,
  asView,
  sortDex,
  type DexSort,
  type DexView,
  type TypeMode,
} from './pokedex-filter';

const PAGE_SIZE = 48;
const GENERATIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

/**
 * Pokédex state container. Loads a lightweight id+name index once, enriches it
 * with types + generation (one batch of cached calls), then runs all search,
 * multi-type/generation filtering, sorting and favourites **client-side** over the
 * in-memory index. Artwork is derived from the id, so the grid needs no per-card
 * fetches.
 */
@Injectable({ providedIn: 'root' })
export class PokedexService {
  private readonly api = inject(PokeApiClient);
  private readonly save = inject(SaveService);

  private readonly index = signal<PokedexEntry[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly enriched = signal(false);
  private enriching = false;

  /* ----- view state ----- */
  readonly query = signal('');
  readonly typeFilters = signal<ReadonlySet<PokemonType>>(new Set());
  readonly typeMode = signal<TypeMode>('or');
  readonly generationFilter = signal<number | null>(null);
  readonly sort = signal<DexSort>(asSort(this.save.read('pokedex:sort', 'id')));
  readonly view = signal<DexView>(asView(this.save.read('pokedex:view', 'gallery')));
  readonly shiny = signal<boolean>(this.save.read('pokedex:shiny', false));
  readonly favOnly = signal(false);
  readonly favorites = signal<ReadonlySet<number>>(new Set(this.save.read<number[]>('pokedex:favorites', [])));
  /** Caught species mirrored (read-only) from the World expedition system. */
  readonly caught = signal<ReadonlySet<number>>(new Set(this.save.readLegacy<number[]>('world:caught', [])));
  private readonly shuffleSeed = signal(0);
  private readonly visibleCount = signal(PAGE_SIZE);

  /** Entries matching every active filter, then sorted. */
  readonly filtered = computed<PokedexEntry[]>(() => {
    const list = applyDexFilters(this.index(), {
      query: this.query(),
      types: [...this.typeFilters()],
      typeMode: this.typeMode(),
      gen: this.generationFilter(),
      favOnly: this.favOnly(),
      favorites: this.favorites(),
    });
    return sortDex(list, this.sort(), this.favorites(), this.shuffleSeed());
  });

  readonly visible = computed(() => this.filtered().slice(0, this.visibleCount()));
  readonly total = computed(() => this.filtered().length);
  readonly count = computed(() => this.index().length);
  readonly hasMore = computed(() => this.visibleCount() < this.total());
  readonly activeFilterCount = computed(
    () => this.typeFilters().size + (this.generationFilter() ? 1 : 0) + (this.favOnly() ? 1 : 0) + (this.query() ? 1 : 0),
  );

  /** All Pokémon names, for autocomplete/datalist consumers (e.g. Team Builder). */
  readonly names = computed(() => this.index().map((e) => e.name));

  readonly favCount = computed(() => this.favorites().size);
  readonly caughtCount = computed(() => {
    const ids = this.index();
    const set = this.caught();
    return ids.reduce((n, e) => n + (set.has(e.id) ? 1 : 0), 0);
  });

  /** Per-generation totals + caught/favourite counts for the progress HUD. */
  readonly genProgress = computed(() => {
    const idx = this.index();
    const caught = this.caught();
    const fav = this.favorites();
    return GENERATIONS.map((gen) => {
      const inGen = idx.filter((e) => e.gen === gen);
      return {
        gen,
        total: inGen.length,
        caught: inGen.reduce((n, e) => n + (caught.has(e.id) ? 1 : 0), 0),
        fav: inGen.reduce((n, e) => n + (fav.has(e.id) ? 1 : 0), 0),
      };
    });
  });

  /* ----------------------------------------------------------- loading */

  async ensureLoaded(): Promise<void> {
    if (this.index().length || this.loading()) return;
    this.loading.set(true);
    this.error.set(null);
    try {
      const list = await this.api.get<NamedApiResourceList>(`${POKEAPI_BASE}/pokemon?limit=100000&offset=0`);
      const entries = list.results
        .map((r) => {
          const id = idFromUrl(r.url);
          return { id, name: r.name, artwork: officialArtwork(id), types: [], gen: 0 } as PokedexEntry;
        })
        .filter((e) => e.id <= 10000)
        .sort((a, b) => a.id - b.id);
      this.index.set(entries);
      void this.enrichIndex();
    } catch {
      this.error.set('Could not load the Pokédex. Check your connection and retry.');
    } finally {
      this.loading.set(false);
    }
  }

  /** One-time enrichment: stamp every entry with `types` + `gen` (cache-first). */
  async enrichIndex(): Promise<void> {
    if (this.enriched() || this.enriching || !this.index().length) return;
    this.enriching = true;
    try {
      const [typeLists, genLists] = await Promise.all([
        Promise.all(
          POKEMON_TYPES.map(async (t) => [t, (await this.api.type(t)).pokemon.map((p) => p.pokemon.name)] as const),
        ),
        Promise.all(
          GENERATIONS.map(async (g) => {
            const dto = await this.api.get<GenerationDto>(`${POKEAPI_BASE}/generation/${g}`);
            return [g, dto.pokemon_species.map((s) => s.name)] as const;
          }),
        ),
      ]);

      const nameToTypes = new Map<string, PokemonType[]>();
      for (const [type, names] of typeLists) {
        for (const name of names) {
          const arr = nameToTypes.get(name);
          if (arr) arr.push(type);
          else nameToTypes.set(name, [type]);
        }
      }
      const nameToGen = new Map<string, number>();
      for (const [gen, names] of genLists) for (const name of names) nameToGen.set(name, gen);

      this.index.update((entries) =>
        entries.map((e) => ({
          ...e,
          types: nameToTypes.get(e.name) ?? e.types,
          gen: nameToGen.get(e.name) ?? e.gen,
        })),
      );
      this.enriched.set(true);
    } catch {
      /* non-fatal — grid still works without type badges */
    } finally {
      this.enriching = false;
    }
  }

  /* ----------------------------------------------------------- controls */

  setQuery(value: string): void {
    this.query.set(value);
    this.resetPaging();
  }

  toggleType(type: PokemonType): void {
    const next = new Set(this.typeFilters());
    if (next.has(type)) next.delete(type);
    else next.add(type);
    this.typeFilters.set(next);
    this.resetPaging();
  }

  setTypeMode(mode: TypeMode): void {
    this.typeMode.set(mode);
    this.resetPaging();
  }

  setGeneration(gen: number | null): void {
    this.generationFilter.set(gen);
    this.resetPaging();
  }

  setSort(sort: DexSort): void {
    if (sort === 'random') this.shuffleSeed.update((s) => s + 1);
    this.sort.set(sort);
    this.save.write('pokedex:sort', sort);
    this.resetPaging();
  }

  reshuffle(): void {
    this.shuffleSeed.update((s) => s + 1);
    this.sort.set('random');
    this.resetPaging();
  }

  setView(view: DexView): void {
    this.view.set(view);
    this.save.write('pokedex:view', view);
  }

  toggleShiny(): void {
    const next = !this.shiny();
    this.shiny.set(next);
    this.save.write('pokedex:shiny', next);
  }

  toggleFavOnly(): void {
    this.favOnly.update((v) => !v);
    this.resetPaging();
  }

  toggleFavorite(id: number): void {
    const next = new Set(this.favorites());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.favorites.set(next);
    this.save.write('pokedex:favorites', [...next]);
  }

  isFavorite(id: number): boolean {
    return this.favorites().has(id);
  }

  isCaught(id: number): boolean {
    return this.caught().has(id);
  }

  loadMore(): void {
    this.visibleCount.update((c) => c + PAGE_SIZE);
  }

  clearFilters(): void {
    this.query.set('');
    this.typeFilters.set(new Set());
    this.generationFilter.set(null);
    this.favOnly.set(false);
    this.resetPaging();
  }

  private resetPaging(): void {
    this.visibleCount.set(PAGE_SIZE);
  }
}
