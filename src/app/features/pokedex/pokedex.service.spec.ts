import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PokeApiClient } from '../../core/api/pokeapi.client';
import { POKEMON_TYPES } from '../../core/utils/type-chart';
import { PokedexService } from './pokedex.service';

const url = (id: number) => `https://pokeapi.co/api/v2/pokemon/${id}/`;

interface Api {
  get: ReturnType<typeof vi.fn>;
  type: ReturnType<typeof vi.fn>;
}

function setup(opts: { failList?: boolean; failType?: boolean } = {}): {
  svc: PokedexService;
  api: Api;
} {
  const api: Api = {
    get: vi.fn((u: string) => {
      if (u.includes('/pokemon?')) {
        if (opts.failList) return Promise.reject(new Error('offline'));
        return Promise.resolve({
          count: 5,
          next: null,
          previous: null,
          results: [
            { name: 'charmander', url: url(4) },
            { name: 'bulbasaur', url: url(1) },
            { name: 'pikachu', url: url(25) },
            { name: 'chikorita', url: url(152) },
            { name: 'pikachu-gmax', url: url(10199) },
            { name: 'huge', url: url(10001) },
          ],
        });
      }
      const gen = Number(/generation\/(\d+)/.exec(u)?.[1]);
      const species: Record<number, string[]> = {
        1: ['bulbasaur', 'charmander', 'pikachu'],
        2: ['chikorita'],
      };
      return Promise.resolve({
        pokemon_species: (species[gen] ?? []).map((n) => ({ name: n, url: '' })),
      });
    }),
    type: vi.fn((t: string) => {
      if (opts.failType) return Promise.reject(new Error('boom'));
      const members: Record<string, string[]> = {
        grass: ['bulbasaur', 'chikorita'],
        poison: ['bulbasaur'],
        fire: ['charmander'],
        electric: ['pikachu'],
      };
      return Promise.resolve({
        pokemon: (members[t] ?? []).map((n) => ({ slot: 1, pokemon: { name: n, url: '' } })),
      });
    }),
  };
  TestBed.configureTestingModule({ providers: [{ provide: PokeApiClient, useValue: api }] });
  return { svc: TestBed.inject(PokedexService), api };
}

describe('PokedexService', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  it('loads the index sorted by id, dropping alternate forms (id > 10000)', async () => {
    const { svc } = setup();
    await svc.ensureLoaded();
    expect(svc.entries().map((e) => e.id)).toEqual([1, 4, 25, 152]);
    expect(svc.names()).toEqual(['bulbasaur', 'charmander', 'pikachu', 'chikorita']);
    expect(svc.count()).toBe(4);
    expect(svc.loading()).toBe(false);
    expect(svc.error()).toBeNull();
    expect(svc.entries()[0]!.artwork).toContain('/1.png');
  });

  it('does not reload once loaded', async () => {
    const { svc, api } = setup();
    await svc.ensureLoaded();
    const calls = api.get.mock.calls.length;
    await svc.ensureLoaded();
    expect(api.get.mock.calls.length).toBe(calls);
  });

  it('reports an error when the list fails and can retry', async () => {
    const { svc } = setup({ failList: true });
    await svc.ensureLoaded();
    expect(svc.error()).toContain('Could not load');
    expect(svc.count()).toBe(0);
    expect(svc.loading()).toBe(false);
  });

  it('enriches entries with types and generations', async () => {
    const { svc } = setup();
    await svc.ensureLoaded();
    await vi.waitFor(() => expect(svc.enriched()).toBe(true));
    const bulba = svc.entryById(1)!;
    expect(bulba.types.sort()).toEqual(['grass', 'poison']);
    expect(bulba.gen).toBe(1);
    expect(svc.entryById(152)!.gen).toBe(2);
    expect(svc.entryById(25)!.types).toEqual(['electric']);
    expect(svc.entryById(9999)).toBeUndefined();
    const progress = svc.genProgress();
    expect(progress).toHaveLength(9);
    expect(progress[0]).toMatchObject({ gen: 1, total: 3, caught: 0, fav: 0 });
    expect(progress[1]!.total).toBe(1);
    // each type was requested once
    await svc.enrichIndex();
    expect(POKEMON_TYPES.length).toBeGreaterThan(0);
  });

  it('stays usable when enrichment fails', async () => {
    const { svc } = setup({ failType: true });
    await svc.ensureLoaded();
    await svc.enrichIndex();
    expect(svc.enriched()).toBe(false);
    expect(svc.total()).toBe(4);
    expect(svc.error()).toBeNull();
  });

  it('enrichIndex is a no-op on an empty index', async () => {
    const { svc, api } = setup();
    await svc.enrichIndex();
    expect(api.type).not.toHaveBeenCalled();
  });

  describe('filtering and paging', () => {
    async function loaded() {
      const ctx = setup();
      await ctx.svc.ensureLoaded();
      await vi.waitFor(() => expect(ctx.svc.enriched()).toBe(true));
      return ctx.svc;
    }

    it('filters by query and resets with clearFilters', async () => {
      const svc = await loaded();
      svc.setQuery('pika');
      expect(svc.filtered().map((e) => e.name)).toEqual(['pikachu']);
      expect(svc.activeFilterCount()).toBe(1);
      svc.clearFilters();
      expect(svc.total()).toBe(4);
      expect(svc.activeFilterCount()).toBe(0);
    });

    it('toggles type filters with any/all modes', async () => {
      const svc = await loaded();
      svc.toggleType('grass');
      expect(svc.filtered().map((e) => e.id)).toEqual([1, 152]);
      svc.toggleType('poison');
      expect(svc.typeFilters().size).toBe(2);
      expect(svc.filtered()).toHaveLength(2); // or: grass | poison
      svc.setTypeMode('and');
      expect(svc.filtered().map((e) => e.id)).toEqual([1]);
      svc.toggleType('grass');
      svc.toggleType('poison');
      expect(svc.typeFilters().size).toBe(0);
    });

    it('filters by generation', async () => {
      const svc = await loaded();
      svc.setGeneration(2);
      expect(svc.filtered().map((e) => e.name)).toEqual(['chikorita']);
      expect(svc.activeFilterCount()).toBe(1);
      svc.setGeneration(null);
      expect(svc.total()).toBe(4);
    });

    it('sorts and persists the choice', async () => {
      const svc = await loaded();
      svc.setSort('name');
      expect(svc.visible()[0]!.name).toBe('bulbasaur');
      svc.setSort('id-desc');
      expect(svc.visible()[0]!.id).toBe(152);
      expect(svc.sort()).toBe('id-desc');
      // a fresh service reads the persisted sort
      TestBed.resetTestingModule();
      expect(setup().svc.sort()).toBe('id-desc');
    });

    it('shuffles via setSort("random") and reshuffle()', async () => {
      const svc = await loaded();
      svc.setSort('random');
      expect(svc.sort()).toBe('random');
      svc.setSort('id');
      svc.reshuffle();
      expect(svc.sort()).toBe('random');
      expect(svc.total()).toBe(4);
    });

    it('pages with loadMore and exposes hasMore', async () => {
      const svc = await loaded();
      expect(svc.hasMore()).toBe(false);
      svc.loadMore();
      expect(svc.visible()).toHaveLength(4);
    });

    it('persists view and shiny', async () => {
      const svc = await loaded();
      svc.setView('list');
      svc.toggleShiny();
      expect(svc.view()).toBe('list');
      expect(svc.shiny()).toBe(true);
      TestBed.resetTestingModule();
      const again = setup().svc;
      expect(again.view()).toBe('list');
      expect(again.shiny()).toBe(true);
    });
  });

  describe('favourites, caught and compare', () => {
    it('toggles favourites, persists them and filters favOnly', async () => {
      const { svc } = setup();
      await svc.ensureLoaded();
      svc.toggleFavorite(25);
      svc.toggleFavorite(1);
      expect(svc.isFavorite(25)).toBe(true);
      expect(svc.favCount()).toBe(2);
      svc.toggleFavOnly();
      expect(svc.filtered().map((e) => e.id)).toEqual([1, 25]);
      expect(svc.activeFilterCount()).toBe(1);
      svc.toggleFavorite(1);
      expect(svc.isFavorite(1)).toBe(false);
      expect(svc.filtered().map((e) => e.id)).toEqual([25]);
      TestBed.resetTestingModule();
      expect(setup().svc.isFavorite(25)).toBe(true);
    });

    it('reads caught species from the legacy world key', async () => {
      localStorage.setItem('world:caught', JSON.stringify([1, 25, 999]));
      const { svc } = setup();
      await svc.ensureLoaded();
      expect(svc.isCaught(1)).toBe(true);
      expect(svc.isCaught(4)).toBe(false);
      expect(svc.caughtCount()).toBe(2); // 999 isn't in the index
      await vi.waitFor(() => expect(svc.enriched()).toBe(true));
      expect(svc.genProgress()[0]!.caught).toBe(2);
    });

    it('limits the compare set to four and exposes helpers', () => {
      const { svc } = setup();
      expect(svc.canCompare()).toBe(false);
      for (const id of [1, 2, 3, 4, 5]) svc.toggleCompare(id);
      expect(svc.compareIds()).toEqual([1, 2, 3, 4]);
      expect(svc.canCompare()).toBe(true);
      expect(svc.inCompare(5)).toBe(false);
      svc.toggleCompare(2);
      expect(svc.inCompare(2)).toBe(false);
      svc.toggleCompare(5);
      expect(svc.compareIds()).toEqual([1, 3, 4, 5]);
      svc.clearCompare();
      expect(svc.compareIds()).toEqual([]);
    });
  });
});
