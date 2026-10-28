import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PokeApiClient } from '../../core/api/pokeapi.client';
import type { EvolutionChainDto, PokemonDto, PokemonSpeciesDto } from '../../core/dto/pokeapi.dto';
import { PokedexDetailService } from './pokedex-detail.service';

const res = (name: string) => ({ name, url: '' });

function pokemon(id: number, name: string): PokemonDto {
  return {
    id,
    name,
    height: 10,
    weight: 100,
    base_experience: 64,
    order: id,
    is_default: true,
    sprites: { front_default: null, front_shiny: null, back_default: null, back_shiny: null },
    types: [{ slot: 1, type: res('grass') }],
    abilities: [],
    stats: [],
    moves: [],
    species: { name, url: `https://pokeapi.co/api/v2/pokemon-species/${id}/` },
  };
}

function species(id: number, chain = 1): PokemonSpeciesDto {
  return {
    id,
    name: 'x',
    order: id,
    gender_rate: 1,
    capture_rate: 45,
    base_happiness: 70,
    is_baby: false,
    is_legendary: false,
    is_mythical: false,
    hatch_counter: 1,
    has_gender_differences: false,
    forms_switchable: false,
    growth_rate: null,
    egg_groups: [],
    color: res('green'),
    shape: null,
    habitat: null,
    generation: res('generation-i'),
    evolves_from_species: null,
    evolution_chain: { url: `https://pokeapi.co/api/v2/evolution-chain/${chain}/` },
    flavor_text_entries: [
      { flavor_text: 'A seed\nPokémon.', language: res('en') },
      { flavor_text: 'Ein Samen.', language: res('de') },
    ],
    genera: [
      { genus: 'Seed Pokémon', language: res('en') },
      { genus: 'Samen-Pokémon', language: res('de') },
    ],
    varieties: [],
  };
}

const chain: EvolutionChainDto = {
  id: 1,
  chain: {
    is_baby: false,
    species: { name: 'bulbasaur', url: 'https://pokeapi.co/api/v2/pokemon-species/1/' },
    evolution_details: [],
    evolves_to: [
      {
        is_baby: false,
        species: { name: 'ivysaur', url: 'https://pokeapi.co/api/v2/pokemon-species/2/' },
        evolution_details: [
          {
            min_level: 16,
            trigger: res('level-up'),
            item: null,
            min_happiness: null,
            time_of_day: '',
            known_move: null,
            location: null,
          },
        ],
        evolves_to: [],
      },
    ],
  },
};

describe('PokedexDetailService', () => {
  let api: {
    pokemon: ReturnType<typeof vi.fn>;
    species: ReturnType<typeof vi.fn>;
    evolutionChain: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    api = {
      pokemon: vi.fn((id: number) => Promise.resolve(pokemon(id, `mon${id}`))),
      species: vi.fn((id: number) => Promise.resolve(species(id))),
      evolutionChain: vi.fn(() => Promise.resolve(chain)),
    };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [{ provide: PokeApiClient, useValue: api }] });
  });

  it('merges species genus and flavour text (EN + DE) into the detail', async () => {
    const d = await TestBed.inject(PokedexDetailService).load(1);
    expect(d.name).toBe('mon1');
    expect(d.genus).toBe('Seed Pokémon');
    expect(d.flavor).toBe('A seed Pokémon.');
    expect(d.genusDe).toBe('Samen-Pokémon');
    expect(d.flavorDe).toBe('Ein Samen.');
  });

  it('memoizes and de-duplicates concurrent loads', async () => {
    const svc = TestBed.inject(PokedexDetailService);
    const [a, b] = await Promise.all([svc.load(1), svc.load(1)]);
    expect(a).toBe(b);
    expect(await svc.load(1)).toBe(a);
    expect(api.pokemon).toHaveBeenCalledTimes(1);
  });

  it('degrades to empty text when the species request fails', async () => {
    api.species.mockRejectedValueOnce(new Error('nope'));
    const d = await TestBed.inject(PokedexDetailService).load(3);
    expect(d.genus).toBe('');
    expect(d.flavor).toBe('');
    expect(d.genusDe).toBe('');
  });

  it('flattens the evolution chain into stages and memoizes it', async () => {
    const svc = TestBed.inject(PokedexDetailService);
    const stages = await svc.loadChain(1);
    expect(stages).toEqual([
      [{ id: 1, name: 'bulbasaur', trigger: null }],
      [{ id: 2, name: 'ivysaur', trigger: 'Lv. 16' }],
    ]);
    expect(await svc.loadChain(1)).toBe(stages);
    expect(api.evolutionChain).toHaveBeenCalledTimes(1);
  });

  it('returns an empty chain when the chain id cannot be parsed', async () => {
    const broken = species(1);
    broken.evolution_chain.url = 'https://pokeapi.co/api/v2/evolution-chain/';
    api.species.mockResolvedValue(broken);
    // the first species call (inside load) succeeds; the chain lookup re-reads it
    expect(await TestBed.inject(PokedexDetailService).loadChain(1)).toEqual([]);
    expect(api.evolutionChain).not.toHaveBeenCalled();
  });
});
