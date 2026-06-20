import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CacheService } from '../cache/cache.service';
import { endpoints, type ResourceId } from './pokeapi-endpoints';
import type {
  AbilityDto,
  EvolutionChainDto,
  GenerationDto,
  MoveDto,
  NamedApiResourceList,
  NatureDto,
  PokemonDto,
  PokemonSpeciesDto,
  TypeDto,
} from '../dto/pokeapi.dto';

/**
 * Typed, cache-first PokeAPI REST v2 client.
 *
 * Every request checks {@link CacheService} (memory + IndexedDB) before hitting
 * the network. In-flight requests for the same URL are de-duplicated so a burst
 * of components asking for the same resource only triggers one fetch.
 */
@Injectable({ providedIn: 'root' })
export class PokeApiClient {
  private readonly http = inject(HttpClient);
  private readonly cache = inject(CacheService);
  private readonly inFlight = new Map<string, Promise<unknown>>();

  /** Generic cache-first GET. */
  async get<T>(url: string, ttlMs?: number): Promise<T> {
    const cached = await this.cache.get<T>(url);
    if (cached !== undefined) return cached;

    const existing = this.inFlight.get(url) as Promise<T> | undefined;
    if (existing) return existing;

    const request = firstValueFrom(this.http.get<T>(url))
      .then(async (data) => {
        await this.cache.set(url, data, ttlMs);
        return data;
      })
      .finally(() => this.inFlight.delete(url));

    this.inFlight.set(url, request);
    return request;
  }

  pokemonList(limit = 60, offset = 0): Promise<NamedApiResourceList> {
    return this.get(endpoints.pokemonList(limit, offset));
  }

  pokemon(id: ResourceId): Promise<PokemonDto> {
    return this.get(endpoints.pokemon(id));
  }

  species(id: ResourceId): Promise<PokemonSpeciesDto> {
    return this.get(endpoints.pokemonSpecies(id));
  }

  evolutionChain(id: ResourceId): Promise<EvolutionChainDto> {
    return this.get(endpoints.evolutionChain(id));
  }

  type(id: ResourceId): Promise<TypeDto> {
    return this.get(endpoints.type(id));
  }

  typeList(): Promise<NamedApiResourceList> {
    return this.get(endpoints.typeList());
  }

  move(id: ResourceId): Promise<MoveDto> {
    return this.get(endpoints.move(id));
  }

  ability(id: ResourceId): Promise<AbilityDto> {
    return this.get(endpoints.ability(id));
  }

  nature(id: ResourceId): Promise<NatureDto> {
    return this.get(endpoints.nature(id));
  }

  natureList(): Promise<NamedApiResourceList> {
    return this.get(endpoints.natureList());
  }

  generation(id: ResourceId): Promise<GenerationDto> {
    return this.get(endpoints.generation(id));
  }

  generationList(): Promise<NamedApiResourceList> {
    return this.get(endpoints.generationList());
  }

  byUrl<T>(url: string): Promise<T> {
    return this.get<T>(url);
  }
}
