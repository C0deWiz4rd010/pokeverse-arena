import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom, timeout } from 'rxjs';
import { CacheService } from '../cache/cache.service';
import { endpoints, type ResourceId } from './pokeapi-endpoints';
import { Semaphore, backoffDelay, isRetryableStatus } from './request-pool';
import type {
  AbilityDto,
  BerryFlavorDto,
  EvolutionChainDto,
  GenerationDto,
  MoveDto,
  NamedApiResourceList,
  NatureDto,
  PokemonDto,
  PokemonSpeciesDto,
  TypeDto,
} from '../dto/pokeapi.dto';

/** At most this many requests hit PokeAPI at once (fair-use friendly, keeps the main thread calm). */
const MAX_CONCURRENT = 6;
const MAX_RETRIES = 2;
const REQUEST_TIMEOUT_MS = 15_000;

/**
 * Typed, cache-first PokeAPI REST v2 client.
 *
 * Every request checks {@link CacheService} (memory + IndexedDB) before hitting
 * the network. In-flight requests for the same URL are de-duplicated so a burst
 * of components asking for the same resource only triggers one fetch. Network
 * requests are throttled ({@link MAX_CONCURRENT}) and retried with jittered
 * backoff on transient failures (offline blips, 429, 5xx, timeouts).
 */
@Injectable({ providedIn: 'root' })
export class PokeApiClient {
  private readonly http = inject(HttpClient);
  private readonly cache = inject(CacheService);
  private readonly inFlight = new Map<string, Promise<unknown>>();
  private readonly pool = new Semaphore(MAX_CONCURRENT);

  /** Generic cache-first GET. */
  async get<T>(url: string, ttlMs?: number): Promise<T> {
    const cached = await this.cache.get<T>(url);
    if (cached !== undefined) return cached;

    const existing = this.inFlight.get(url) as Promise<T> | undefined;
    if (existing) return existing;

    const request = this.pool
      .run(() => this.fetchWithRetry<T>(url))
      .then(async (data) => {
        await this.cache.set(url, data, ttlMs);
        return data;
      })
      .finally(() => this.inFlight.delete(url));

    this.inFlight.set(url, request);
    return request;
  }

  private async fetchWithRetry<T>(url: string): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await firstValueFrom(this.http.get<T>(url).pipe(timeout(REQUEST_TIMEOUT_MS)));
      } catch (err) {
        const status = err instanceof HttpErrorResponse ? err.status : undefined; // timeout → undefined
        if (attempt >= MAX_RETRIES || !isRetryableStatus(status)) throw err;
        await new Promise((r) => setTimeout(r, backoffDelay(attempt)));
      }
    }
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

  berryFlavor(id: ResourceId): Promise<BerryFlavorDto> {
    return this.get(endpoints.berryFlavor(id));
  }

  byUrl<T>(url: string): Promise<T> {
    return this.get<T>(url);
  }
}
