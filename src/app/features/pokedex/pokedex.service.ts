import { Injectable, computed, inject, signal } from '@angular/core';
import { PokeApiClient } from '../../core/api/pokeapi.client';
import { POKEAPI_BASE, idFromUrl, officialArtwork } from '../../core/api/pokeapi-endpoints';
import type { NamedApiResourceList, GenerationDto, TypeDto } from '../../core/dto/pokeapi.dto';
import type { PokedexEntry } from '../../core/models/pokemon.model';
import type { PokemonType } from '../../core/utils/type-chart';

const PAGE_SIZE = 48;

/**
 * Pokedex state container.
 *
 * Loads a lightweight name+id index once (a single request) so search and
 * type/generation filtering happen instantly on the client. Artwork is derived
 * from the id via the sprite CDN, so the grid needs no per-Pokemon fetches.
 */
@Injectable({ providedIn: 'root' })
export class PokedexService {
  private readonly api = inject(PokeApiClient);

  /** Full index of default-form Pokemon (id + name). */
  private readonly index = signal<PokedexEntry[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly query = signal('');
  readonly typeFilter = signal<PokemonType | null>(null);
  readonly generationFilter = signal<number | null>(null);
  private readonly visibleCount = signal(PAGE_SIZE);

  /** Names allowed by the active type/generation filters (null = no filter). */
  private readonly typeNames = signal<Set<string> | null>(null);
  private readonly genNames = signal<Set<string> | null>(null);

  /** Entries matching every active filter + search query. */
  readonly filtered = computed<PokedexEntry[]>(() => {
    const q = this.query().trim().toLowerCase();
    const types = this.typeNames();
    const gens = this.genNames();
    return this.index().filter((e) => {
      if (types && !types.has(e.name)) return false;
      if (gens && !gens.has(e.name)) return false;
      if (!q) return true;
      return e.name.includes(q) || String(e.id) === q || `#${e.id}` === q;
    });
  });

  readonly visible = computed(() => this.filtered().slice(0, this.visibleCount()));
  readonly total = computed(() => this.filtered().length);
  readonly hasMore = computed(() => this.visibleCount() < this.total());

  async ensureLoaded(): Promise<void> {
    if (this.index().length || this.loading()) return;
    this.loading.set(true);
    this.error.set(null);
    try {
      const list = await this.api.get<NamedApiResourceList>(
        `${POKEAPI_BASE}/pokemon?limit=100000&offset=0`,
      );
      const entries = list.results
        .map((r) => {
          const id = idFromUrl(r.url);
          return { id, name: r.name, artwork: officialArtwork(id) };
        })
        // Hide alt-forms with very large ids to keep the grid to the main dex.
        .filter((e) => e.id <= 10000)
        .sort((a, b) => a.id - b.id);
      this.index.set(entries);
    } catch {
      this.error.set('Could not load the Pokédex. Check your connection and retry.');
    } finally {
      this.loading.set(false);
    }
  }

  setQuery(value: string): void {
    this.query.set(value);
    this.resetPaging();
  }

  loadMore(): void {
    this.visibleCount.update((c) => c + PAGE_SIZE);
  }

  async setTypeFilter(type: PokemonType | null): Promise<void> {
    this.typeFilter.set(type);
    this.resetPaging();
    if (!type) {
      this.typeNames.set(null);
      return;
    }
    const dto = await this.api.get<TypeDto>(`${POKEAPI_BASE}/type/${type}`);
    this.typeNames.set(new Set(dto.pokemon.map((p) => p.pokemon.name)));
  }

  async setGenerationFilter(gen: number | null): Promise<void> {
    this.generationFilter.set(gen);
    this.resetPaging();
    if (!gen) {
      this.genNames.set(null);
      return;
    }
    const dto = await this.api.get<GenerationDto>(`${POKEAPI_BASE}/generation/${gen}`);
    this.genNames.set(new Set(dto.pokemon_species.map((s) => s.name)));
  }

  async clearFilters(): Promise<void> {
    this.query.set('');
    this.typeFilter.set(null);
    this.generationFilter.set(null);
    this.typeNames.set(null);
    this.genNames.set(null);
    this.resetPaging();
  }

  private resetPaging(): void {
    this.visibleCount.set(PAGE_SIZE);
  }
}
