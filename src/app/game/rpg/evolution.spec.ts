import { describe, expect, it } from 'vitest';
import { evolutionAt, levelUpEvolutions } from './evolution';
import type { EvolutionChainDto } from '../../core/dto/pokeapi.dto';

// charmander -16-> charmeleon -36-> charizard
const chain: EvolutionChainDto = {
  id: 2,
  chain: {
    is_baby: false,
    species: { name: 'charmander', url: 'https://pokeapi.co/api/v2/pokemon-species/4/' },
    evolution_details: [],
    evolves_to: [
      {
        is_baby: false,
        species: { name: 'charmeleon', url: 'https://pokeapi.co/api/v2/pokemon-species/5/' },
        evolution_details: [{ min_level: 16, trigger: { name: 'level-up', url: '' }, item: null, min_happiness: null, time_of_day: '', known_move: null, location: null }],
        evolves_to: [
          {
            is_baby: false,
            species: { name: 'charizard', url: 'https://pokeapi.co/api/v2/pokemon-species/6/' },
            evolution_details: [{ min_level: 36, trigger: { name: 'level-up', url: '' }, item: null, min_happiness: null, time_of_day: '', known_move: null, location: null }],
            evolves_to: [],
          },
        ],
      },
    ],
  },
};

describe('evolution', () => {
  it('parses level-up evolutions with ids and levels', () => {
    const map = levelUpEvolutions(chain);
    expect(map['charmander']).toEqual({ to: 'charmeleon', toId: 5, minLevel: 16 });
    expect(map['charmeleon']).toEqual({ to: 'charizard', toId: 6, minLevel: 36 });
    expect(map['charizard']).toBeUndefined();
  });

  it('evolves only at/after the threshold', () => {
    const map = levelUpEvolutions(chain);
    expect(evolutionAt(map, 'charmander', 15)).toBeNull();
    expect(evolutionAt(map, 'charmander', 16)?.to).toBe('charmeleon');
    expect(evolutionAt(map, 'charmeleon', 40)?.to).toBe('charizard');
    expect(evolutionAt(map, 'pikachu', 99)).toBeNull();
  });

  it('ignores non-level-up triggers', () => {
    const itemChain: EvolutionChainDto = {
      id: 1,
      chain: {
        is_baby: false,
        species: { name: 'eevee', url: 'https://pokeapi.co/api/v2/pokemon-species/133/' },
        evolution_details: [],
        evolves_to: [
          {
            is_baby: false,
            species: { name: 'vaporeon', url: 'https://pokeapi.co/api/v2/pokemon-species/134/' },
            evolution_details: [{ min_level: null, trigger: { name: 'use-item', url: '' }, item: { name: 'water-stone', url: '' }, min_happiness: null, time_of_day: '', known_move: null, location: null }],
            evolves_to: [],
          },
        ],
      },
    };
    expect(levelUpEvolutions(itemChain)['eevee']).toBeUndefined();
  });
});
