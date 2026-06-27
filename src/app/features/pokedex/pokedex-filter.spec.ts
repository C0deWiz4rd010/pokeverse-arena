import { describe, expect, it } from 'vitest';
import {
  applyDexFilters,
  asSort,
  asView,
  matchesQuery,
  parseRange,
  parseTypes,
  sortDex,
  type DexCriteria,
} from './pokedex-filter';
import type { PokedexEntry } from '../../core/models/pokemon.model';
import type { PokemonType } from '../../core/utils/type-chart';

function e(id: number, name: string, types: PokemonType[], gen: number): PokedexEntry {
  return { id, name, types, gen, artwork: '' };
}

const DEX: PokedexEntry[] = [
  e(1, 'bulbasaur', ['grass', 'poison'], 1),
  e(4, 'charmander', ['fire'], 1),
  e(7, 'squirtle', ['water'], 1),
  e(25, 'pikachu', ['electric'], 1),
  e(133, 'eevee', ['normal'], 1),
  e(152, 'chikorita', ['grass'], 2),
];

function crit(over: Partial<DexCriteria> = {}): DexCriteria {
  return { query: '', types: [], typeMode: 'or', gen: null, favOnly: false, favorites: new Set(), ...over };
}

describe('query parsing', () => {
  it('parses an id range', () => {
    expect(parseRange('#1-151')).toEqual({ min: 1, max: 151 });
    expect(parseRange('151 - 1')).toEqual({ min: 1, max: 151 });
    expect(parseRange('pikachu')).toBeNull();
  });

  it('matches name, id, range and type', () => {
    const pika = DEX[3];
    expect(matchesQuery(pika, 'pika')).toBe(true);
    expect(matchesQuery(pika, '25')).toBe(true);
    expect(matchesQuery(pika, '#25')).toBe(true);
    expect(matchesQuery(pika, 'electric')).toBe(true);
    expect(matchesQuery(pika, '#1-30')).toBe(true);
    expect(matchesQuery(pika, 'fire')).toBe(false);
  });
});

describe('filtering', () => {
  it('filters by a single type', () => {
    const out = applyDexFilters(DEX, crit({ types: ['grass'] }));
    expect(out.map((x) => x.name)).toEqual(['bulbasaur', 'chikorita']);
  });

  it('AND requires all types, OR requires any', () => {
    expect(applyDexFilters(DEX, crit({ types: ['grass', 'poison'], typeMode: 'and' })).map((x) => x.name)).toEqual(['bulbasaur']);
    expect(applyDexFilters(DEX, crit({ types: ['fire', 'water'], typeMode: 'or' })).map((x) => x.name)).toEqual(['charmander', 'squirtle']);
    expect(applyDexFilters(DEX, crit({ types: ['fire', 'water'], typeMode: 'and' }))).toHaveLength(0);
  });

  it('filters by generation and favourites', () => {
    expect(applyDexFilters(DEX, crit({ gen: 2 })).map((x) => x.name)).toEqual(['chikorita']);
    expect(applyDexFilters(DEX, crit({ favOnly: true, favorites: new Set([25]) })).map((x) => x.id)).toEqual([25]);
  });
});

describe('sorting', () => {
  it('sorts by id, id-desc, name, gen and favourites', () => {
    expect(sortDex(DEX, 'id-desc', new Set())[0].id).toBe(152);
    expect(sortDex(DEX, 'name', new Set())[0].name).toBe('bulbasaur');
    expect(sortDex(DEX, 'fav', new Set([133]))[0].id).toBe(133);
  });

  it('shuffles deterministically for a seed', () => {
    expect(sortDex(DEX, 'random', new Set(), 5)).toEqual(sortDex(DEX, 'random', new Set(), 5));
  });
});

describe('coercion helpers', () => {
  it('coerces sort/view and parses types', () => {
    expect(asSort('name')).toBe('name');
    expect(asSort('bogus')).toBe('id');
    expect(asView('list')).toBe('list');
    expect(asView(null)).toBe('gallery');
    expect(parseTypes('fire,water,bogus')).toEqual(['fire', 'water']);
  });
});
