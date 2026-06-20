import { Injectable, inject, signal } from '@angular/core';
import { PokeApiClient } from '../../core/api/pokeapi.client';
import {
  mapAbility,
  mapEvolutionChain,
  mapMoveInfo,
  mapPokemon,
  mapSpecies,
  type AbilityInfo,
  type EvolutionNode,
  type MoveInfo,
  type Pokemon,
  type SpeciesInfo,
} from '../../core/models/pokemon.model';

interface DetailState {
  pokemon: Pokemon;
  species: SpeciesInfo;
  evolution: EvolutionNode;
}

/** Loads and aggregates everything the detail page needs for one Pokemon. */
@Injectable({ providedIn: 'root' })
export class PokemonDetailService {
  private readonly api = inject(PokeApiClient);

  readonly state = signal<DetailState | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  async load(idOrName: string | number): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    this.state.set(null);
    try {
      const pokemon = mapPokemon(await this.api.pokemon(idOrName));
      const speciesDto = await this.api.species(pokemon.speciesId);
      const species = mapSpecies(speciesDto);
      const evolution = mapEvolutionChain(
        await this.api.evolutionChain(species.evolutionChainId),
      );
      this.state.set({ pokemon, species, evolution });
    } catch {
      this.error.set('Could not load this Pokémon. It may not exist — try another.');
    } finally {
      this.loading.set(false);
    }
  }

  /** Lazy-load a single ability's effect text (used on demand in the UI). */
  async ability(name: string): Promise<AbilityInfo> {
    return mapAbility(await this.api.ability(name));
  }

  /** Lazy-load a single move's full data. */
  async move(name: string): Promise<MoveInfo> {
    return mapMoveInfo(await this.api.move(name));
  }
}
