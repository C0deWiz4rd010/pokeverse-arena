import { Injectable, inject } from '@angular/core';
import { PokeApiClient } from '../../core/api/pokeapi.client';
import { mapPokemon, mapSpecies, type Pokemon } from '../../core/models/pokemon.model';

/** Pokémon detail enriched with the species genus + flavour text. */
export interface QuickDetail extends Pokemon {
  readonly genus: string;
  readonly flavor: string;
}

/**
 * Lazy, memoized per-id detail for the Pokédex quick-view. Builds on the
 * cache-first `PokeApiClient`, and additionally memoizes the mapped view-model so
 * re-opening a quick-view is instant.
 */
@Injectable({ providedIn: 'root' })
export class PokedexDetailService {
  private readonly api = inject(PokeApiClient);
  private readonly cache = new Map<number, QuickDetail>();
  private readonly inflight = new Map<number, Promise<QuickDetail>>();

  load(id: number): Promise<QuickDetail> {
    const cached = this.cache.get(id);
    if (cached) return Promise.resolve(cached);
    const pending = this.inflight.get(id);
    if (pending) return pending;

    const job = this.fetch(id);
    this.inflight.set(id, job);
    void job.finally(() => this.inflight.delete(id));
    return job;
  }

  private async fetch(id: number): Promise<QuickDetail> {
    const mon = mapPokemon(await this.api.pokemon(id));
    let genus = '';
    let flavor = '';
    try {
      const species = mapSpecies(await this.api.species(mon.speciesId));
      genus = species.genus;
      flavor = species.flavorText;
    } catch {
      /* species is optional flavour — ignore if it fails */
    }
    const detail: QuickDetail = { ...mon, genus, flavor };
    this.cache.set(id, detail);
    return detail;
  }
}
