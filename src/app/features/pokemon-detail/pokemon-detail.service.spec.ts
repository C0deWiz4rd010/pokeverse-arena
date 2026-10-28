import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PokeApiClient } from '../../core/api/pokeapi.client';
import { RecentPokemonService } from '../../core/recent/recent-pokemon.service';
import { PokemonDetailService } from './pokemon-detail.service';

const res = (name: string) => ({ name, url: '' });

const pokemonDto = {
  id: 25,
  name: 'pikachu',
  height: 4,
  weight: 60,
  base_experience: 112,
  order: 35,
  is_default: true,
  sprites: { front_default: null, front_shiny: null, back_default: null, back_shiny: null },
  types: [{ slot: 1, type: res('electric') }],
  abilities: [],
  stats: [{ base_stat: 35, effort: 0, stat: res('hp') }],
  moves: [],
  species: { name: 'pikachu', url: 'https://pokeapi.co/api/v2/pokemon-species/25/' },
};

const speciesDto = {
  id: 25,
  name: 'pikachu',
  order: 1,
  gender_rate: 4,
  capture_rate: 190,
  base_happiness: 50,
  is_baby: false,
  is_legendary: false,
  is_mythical: false,
  hatch_counter: 10,
  has_gender_differences: true,
  forms_switchable: false,
  growth_rate: null,
  egg_groups: [res('field')],
  color: res('yellow'),
  shape: null,
  habitat: null,
  generation: res('generation-i'),
  evolves_from_species: null,
  evolution_chain: { url: 'https://pokeapi.co/api/v2/evolution-chain/10/' },
  flavor_text_entries: [],
  genera: [],
  varieties: [],
};

const chainDto = {
  id: 10,
  chain: {
    is_baby: false,
    species: { name: 'pikachu', url: 'https://pokeapi.co/api/v2/pokemon-species/25/' },
    evolution_details: [],
    evolves_to: [],
  },
};

describe('PokemonDetailService', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    localStorage.clear();
    api = {
      pokemon: vi.fn(() => Promise.resolve(pokemonDto)),
      species: vi.fn(() => Promise.resolve(speciesDto)),
      evolutionChain: vi.fn(() => Promise.resolve(chainDto)),
      ability: vi.fn(() =>
        Promise.resolve({
          id: 9,
          name: 'static',
          is_main_series: true,
          effect_entries: [{ effect: 'Long', short_effect: 'Short', language: res('en') }],
          flavor_text_entries: [],
        }),
      ),
      move: vi.fn(() =>
        Promise.resolve({
          id: 85,
          name: 'thunderbolt',
          accuracy: 100,
          power: 90,
          pp: 15,
          priority: 0,
          type: res('electric'),
          damage_class: res('special'),
          effect_chance: 10,
          effect_entries: [],
          flavor_text_entries: [],
          meta: null,
        }),
      ),
    };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [{ provide: PokeApiClient, useValue: api }] });
  });

  it('aggregates pokemon, species and evolution and records the visit', async () => {
    const svc = TestBed.inject(PokemonDetailService);
    const record = vi.spyOn(TestBed.inject(RecentPokemonService), 'record');
    const p = svc.load('pikachu');
    expect(svc.loading()).toBe(true);
    await p;
    expect(svc.loading()).toBe(false);
    expect(svc.error()).toBeNull();
    const st = svc.state()!;
    expect(st.pokemon.name).toBe('pikachu');
    expect(st.species.evolutionChainId).toBe(10);
    expect(st.evolution.name).toBe('pikachu');
    expect(api['pokemon']!).toHaveBeenCalledWith('pikachu');
    expect(api['species']!).toHaveBeenCalledWith(25);
    expect(api['evolutionChain']!).toHaveBeenCalledWith(10);
    expect(record).toHaveBeenCalledWith(25, 'pikachu');
  });

  it('sets an error and clears state when loading fails', async () => {
    const svc = TestBed.inject(PokemonDetailService);
    await svc.load(25);
    api['pokemon']!.mockRejectedValueOnce(new Error('404'));
    await svc.load(99999);
    expect(svc.state()).toBeNull();
    expect(svc.error()).toContain('Could not load');
    expect(svc.loading()).toBe(false);
  });

  it('maps lazily-loaded abilities and moves', async () => {
    const svc = TestBed.inject(PokemonDetailService);
    expect(await svc.ability('static')).toMatchObject({ effect: 'Long', shortEffect: 'Short' });
    expect(await svc.move('thunderbolt')).toMatchObject({
      type: 'electric',
      damageClass: 'special',
    });
  });
});
