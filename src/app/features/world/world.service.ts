import { Injectable, computed, inject, signal } from '@angular/core';
import { PokeApiClient } from '../../core/api/pokeapi.client';
import { SPRITE_BASE, idFromUrl } from '../../core/api/pokeapi-endpoints';
import { titleCase } from '../../core/ui/format';
import {
  REGIONS,
  regionForDex,
  type Region,
} from '../../game/world/regions';

type Status = 'idle' | 'loading' | 'ready' | 'error';

/** A single Pokémon that debuted in the selected region. */
export interface RegionMember {
  readonly dex: number;
  readonly name: string;
  readonly sprite: string;
}

/** The outcome of a "where does it live?" lookup. */
export interface Sighting {
  readonly dex: number;
  readonly name: string;
  readonly region: Region;
}

const SPECIES_MAX = 1025;

/** Pixel front sprite — light enough to render a whole region as a grid. */
function spriteFor(dex: number): string {
  return `${SPRITE_BASE}/pokemon/${dex}.png`;
}

/**
 * World Explorer state. Pick a region to roam the Pokémon that first appeared
 * there, or search a Pokémon by name/number to reveal the region it calls home.
 */
@Injectable({ providedIn: 'root' })
export class WorldService {
  private readonly api = inject(PokeApiClient);

  readonly regions = REGIONS;

  readonly status = signal<Status>('idle');
  readonly error = signal<string | null>(null);
  readonly activeRegion = signal<Region | null>(null);
  readonly members = signal<readonly RegionMember[]>([]);

  /** A located Pokémon to highlight after a search. */
  readonly sighting = signal<Sighting | null>(null);
  readonly searchError = signal<string | null>(null);

  readonly count = computed(() => this.members().length);

  /** Load and display the native Pokémon of a region. */
  async select(region: Region): Promise<void> {
    if (this.activeRegion()?.id === region.id && this.status() === 'ready') return;
    this.status.set('loading');
    this.error.set(null);
    this.activeRegion.set(region);
    this.members.set([]);
    try {
      const gen = await this.api.generation(region.generation);
      const members = gen.pokemon_species
        .map((s) => idFromUrl(s.url))
        .filter((dex) => Number.isFinite(dex) && dex >= 1 && dex <= SPECIES_MAX)
        .sort((a, b) => a - b)
        .map<RegionMember>((dex) => ({
          dex,
          name: this.speciesName(gen.pokemon_species, dex),
          sprite: spriteFor(dex),
        }));
      this.members.set(members);
      this.status.set('ready');
    } catch {
      this.error.set('Could not reach the region right now. Please try again.');
      this.status.set('error');
    }
  }

  /** Resolve a Pokémon name or dex number to its debut region. */
  async locate(query: string): Promise<void> {
    const term = query.trim().toLowerCase();
    this.searchError.set(null);
    this.sighting.set(null);
    if (!term) return;
    try {
      const dto = await this.api.pokemon(term);
      const region = regionForDex(dto.id);
      if (!region) {
        this.searchError.set(`${titleCase(dto.name)} roams beyond the charted regions.`);
        return;
      }
      this.sighting.set({ dex: dto.id, name: titleCase(dto.name), region });
      await this.select(region);
    } catch {
      this.searchError.set(`No Pokémon called “${query.trim()}” was found.`);
    }
  }

  /** Clear an active search highlight. */
  clearSearch(): void {
    this.sighting.set(null);
    this.searchError.set(null);
  }

  /** Return to the region picker. */
  back(): void {
    this.status.set('idle');
    this.activeRegion.set(null);
    this.members.set([]);
    this.clearSearch();
  }

  private speciesName(
    species: { name: string; url: string }[],
    dex: number,
  ): string {
    const match = species.find((s) => idFromUrl(s.url) === dex);
    return titleCase(match?.name ?? `#${dex}`);
  }
}
