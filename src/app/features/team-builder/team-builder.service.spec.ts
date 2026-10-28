import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PokeApiClient } from '../../core/api/pokeapi.client';
import { CacheService } from '../../core/cache/cache.service';
import type { PokemonDto } from '../../core/dto/pokeapi.dto';
import { ToastService } from '../../core/ui/toast/toast.service';
import { PokedexService } from '../pokedex/pokedex.service';
import { MAX_TEAM, TeamBuilderService } from './team-builder.service';

const res = (name: string) => ({ name, url: '' });

interface Spec {
  id: number;
  name: string;
  types: string[];
  abilities?: string[];
  moves?: { name: string; method: string }[];
  stats?: Partial<Record<string, number>>;
  artwork?: string | null;
}

function dto(s: Spec): PokemonDto {
  const stats = {
    hp: 50,
    attack: 50,
    defense: 50,
    'special-attack': 50,
    'special-defense': 50,
    speed: 50,
    ...s.stats,
  };
  return {
    id: s.id,
    name: s.name,
    height: 10,
    weight: 10,
    base_experience: 1,
    order: s.id,
    is_default: true,
    sprites: {
      front_default: null,
      front_shiny: null,
      back_default: null,
      back_shiny: null,
      other:
        s.artwork === null
          ? {}
          : { 'official-artwork': { front_default: s.artwork ?? 'custom.png', front_shiny: null } },
    },
    // intentionally out of slot order
    types: [...s.types].reverse().map((t, i) => ({ slot: s.types.length - i, type: res(t) })),
    abilities: (s.abilities ?? ['overgrow']).map((a, i) => ({
      slot: i + 1,
      is_hidden: false,
      ability: res(a),
    })),
    stats: Object.entries(stats).map(([k, v]) => ({ base_stat: v!, effort: 0, stat: res(k) })),
    moves: (s.moves ?? []).map((m) => ({
      move: res(m.name),
      version_group_details: [
        { level_learned_at: 1, move_learn_method: res(m.method), version_group: res('x') },
      ],
    })),
    species: { name: s.name, url: '' },
  };
}

const MONS: Record<string, Spec> = {
  bulbasaur: {
    id: 1,
    name: 'bulbasaur',
    types: ['grass', 'poison'],
    abilities: ['overgrow', 'chlorophyll', 'overgrow'],
    moves: [
      { name: 'tackle', method: 'level-up' },
      { name: 'growl', method: 'level-up' },
      { name: 'vine-whip', method: 'level-up' },
      { name: 'razor-leaf', method: 'level-up' },
      { name: 'solar-beam', method: 'level-up' },
      { name: 'swords-dance', method: 'machine' },
    ],
    stats: { speed: 45 },
  },
  charmander: { id: 4, name: 'charmander', types: ['fire'], artwork: null, stats: { speed: 65 } },
  squirtle: { id: 7, name: 'squirtle', types: ['water'], stats: { speed: 43 } },
  pikachu: { id: 25, name: 'pikachu', types: ['electric'], stats: { speed: 90 } },
  eevee: { id: 133, name: 'eevee', types: ['normal'] },
  mew: { id: 151, name: 'mew', types: ['psychic'] },
  chikorita: { id: 152, name: 'chikorita', types: ['grass'] },
};
const byId = (id: number | string) =>
  Object.values(MONS).find((m) => m.id === Number(id) || m.name === id);

interface Ctx {
  svc: TeamBuilderService;
  api: { pokemon: ReturnType<typeof vi.fn>; get: ReturnType<typeof vi.fn> };
  cache: { loadState: ReturnType<typeof vi.fn>; saveState: ReturnType<typeof vi.fn> };
  dex: { ensureLoaded: ReturnType<typeof vi.fn>; names: ReturnType<typeof vi.fn> };
  toast: ToastService;
}

function setup(stored?: unknown[]): Ctx {
  const api = {
    pokemon: vi.fn((k: number | string) => {
      const m = byId(k);
      return m ? Promise.resolve(dto(m)) : Promise.reject(new Error('404'));
    }),
    get: vi.fn((url: string) => {
      if (url.includes('/type/fire'))
        return Promise.resolve({ pokemon: [{ slot: 1, pokemon: res('charmander') }] });
      if (url.includes('/type/grass'))
        return Promise.resolve({
          pokemon: [
            { slot: 1, pokemon: res('bulbasaur') },
            { slot: 1, pokemon: res('chikorita') },
          ],
        });
      if (url.includes('/generation/2'))
        return Promise.resolve({ pokemon_species: [res('chikorita')] });
      return Promise.resolve({ pokemon: [], pokemon_species: [] });
    }),
  };
  const cache = {
    loadState: vi.fn(() => Promise.resolve(stored)),
    saveState: vi.fn(() => Promise.resolve(true)),
  };
  const dex = {
    ensureLoaded: vi.fn(() => Promise.resolve()),
    names: vi.fn(() => Object.keys(MONS)),
  };
  TestBed.configureTestingModule({
    providers: [
      { provide: PokeApiClient, useValue: api },
      { provide: CacheService, useValue: cache },
      { provide: PokedexService, useValue: dex },
    ],
  });
  return {
    svc: TestBed.inject(TeamBuilderService),
    api,
    cache,
    dex,
    toast: TestBed.inject(ToastService),
  };
}

/** Let the async restore and the persistence effect run. */
async function settle(): Promise<void> {
  for (let i = 0; i < 10; i++) await Promise.resolve();
  TestBed.tick();
  for (let i = 0; i < 10; i++) await Promise.resolve();
}

describe('TeamBuilderService', () => {
  beforeEach(() => TestBed.resetTestingModule());
  afterEach(() => vi.restoreAllMocks());

  describe('adding and editing', () => {
    it('adds a normalised member with sensible defaults', async () => {
      const { svc, api } = setup();
      await svc.add('  Bulbasaur ');
      expect(api.pokemon).toHaveBeenCalledWith('bulbasaur');
      const m = svc.team()[0]!;
      expect(m).toMatchObject({
        id: 1,
        name: 'bulbasaur',
        nickname: '',
        level: 50,
        natureName: 'Hardy',
        ability: 'overgrow',
        artwork: 'custom.png',
      });
      expect(m.types).toEqual(['grass', 'poison']);
      expect(m.abilities).toEqual(['overgrow', 'chlorophyll']);
      expect(m.moves).toEqual(['tackle', 'growl', 'vine-whip', 'razor-leaf']);
      expect(m.movePool).toEqual([...m.movePool].sort());
      expect(m.movePool).toContain('swords-dance');
      expect(m.baseStats.speed).toBe(45);
      expect(svc.adding()).toBe(false);
    });

    it('falls back to CDN artwork', async () => {
      const { svc } = setup();
      await svc.add('charmander');
      expect(svc.team()[0]!.artwork).toContain('/other/official-artwork/4.png');
    });

    it('ignores blank input and reports unknown Pokémon', async () => {
      const { svc, api } = setup();
      await svc.add('   ');
      expect(api.pokemon).not.toHaveBeenCalled();
      await svc.add('missingno');
      expect(svc.team()).toHaveLength(0);
      expect(svc.error()).toContain('missingno');
      await svc.add('pikachu');
      expect(svc.error()).toBeNull();
    });

    it('caps the roster at six', async () => {
      const { svc, api } = setup();
      for (const n of [
        'bulbasaur',
        'charmander',
        'squirtle',
        'pikachu',
        'eevee',
        'mew',
        'chikorita',
      ])
        await svc.add(n);
      expect(svc.team()).toHaveLength(MAX_TEAM);
      expect(svc.full()).toBe(true);
      expect(api.pokemon).toHaveBeenCalledTimes(6);
    });

    it('removes and clears members', async () => {
      const { svc } = setup();
      await svc.add('pikachu');
      await svc.add('eevee');
      const uid = svc.team()[0]!.uid;
      svc.remove(uid);
      expect(svc.team().map((m) => m.name)).toEqual(['eevee']);
      svc.clear();
      expect(svc.team()).toEqual([]);
    });

    it('patches members, clamping and rounding the level', async () => {
      const { svc } = setup();
      await svc.add('pikachu');
      const uid = svc.team()[0]!.uid;
      svc.patch(uid, { nickname: 'Sparky', natureName: 'Jolly' });
      expect(svc.team()[0]).toMatchObject({ nickname: 'Sparky', natureName: 'Jolly' });
      svc.patch(uid, { level: 250 });
      expect(svc.team()[0]!.level).toBe(100);
      svc.patch(uid, { level: -4 });
      expect(svc.team()[0]!.level).toBe(1);
      svc.patch(uid, { level: 42.6 });
      expect(svc.team()[0]!.level).toBe(43);
      svc.patch(uid, { level: NaN });
      expect(svc.team()[0]!.level).toBe(50);
      svc.patch('nope', { nickname: 'x' });
      expect(svc.team()[0]!.nickname).toBe('Sparky');
    });

    it('toggles moves up to four', async () => {
      const { svc } = setup();
      await svc.add('bulbasaur');
      const uid = svc.team()[0]!.uid;
      expect(svc.team()[0]!.moves).toHaveLength(4);
      svc.toggleMove(uid, 'solar-beam'); // full: ignored
      expect(svc.team()[0]!.moves).not.toContain('solar-beam');
      svc.toggleMove(uid, 'growl'); // remove
      expect(svc.team()[0]!.moves).toEqual(['tackle', 'vine-whip', 'razor-leaf']);
      svc.toggleMove(uid, 'solar-beam');
      expect(svc.team()[0]!.moves).toContain('solar-beam');
      svc.toggleMove('other', 'tackle');
      expect(svc.team()[0]!.moves).toHaveLength(4);
    });

    it('computes member stats, analysis and rating from the roster', async () => {
      const { svc } = setup();
      await svc.add('pikachu');
      const m = svc.team()[0]!;
      expect(svc.memberStats().get(m.uid)!.speed).toBeGreaterThan(0);
      expect(svc.analysis().weaknesses['ground']).toBe(1);
      expect(svc.rating().score).toBeGreaterThan(0);
    });
  });

  describe('random generation', () => {
    it('adds one random match for the filters and reports an empty pool', async () => {
      const { svc } = setup();
      vi.spyOn(Math, 'random').mockReturnValue(0);
      svc.setFilterType('grass');
      svc.setFilterGen(2);
      await svc.addRandom();
      expect(svc.team().map((m) => m.name)).toEqual(['chikorita']);
      expect(svc.rolling()).toBe(false);

      await svc.addRandom(); // chikorita already taken -> nothing left
      expect(svc.error()).toContain('No Pokémon match');
      expect(svc.team()).toHaveLength(1);

      svc.clearFilters();
      expect(svc.filterType()).toBeNull();
      expect(svc.filterGen()).toBeNull();
    });

    it('caches type and generation lookups', async () => {
      const { svc, api } = setup();
      svc.setFilterType('fire');
      await svc.addRandom();
      svc.remove(svc.team()[0]!.uid);
      await svc.addRandom();
      const typeCalls = api.get.mock.calls.filter((c) => String(c[0]).includes('/type/fire'));
      expect(typeCalls).toHaveLength(1);
    });

    it('fills every remaining slot without duplicates', async () => {
      const { svc, dex } = setup();
      await svc.add('pikachu');
      await svc.fillRandom();
      expect(dex.ensureLoaded).toHaveBeenCalled();
      expect(svc.team()).toHaveLength(MAX_TEAM);
      expect(new Set(svc.team().map((m) => m.name)).size).toBe(MAX_TEAM);
      await svc.fillRandom(); // already full: no-op
      expect(svc.team()).toHaveLength(MAX_TEAM);
    });

    it('fill stops early when the filtered pool is smaller than the free slots', async () => {
      const { svc } = setup();
      svc.setFilterType('grass');
      await svc.fillRandom();
      expect(
        svc
          .team()
          .map((m) => m.name)
          .sort(),
      ).toEqual(['bulbasaur', 'chikorita']);
      svc.clearFilters();
      svc.setFilterType('fire');
      svc.setFilterGen(2);
      svc.clear();
      await svc.fillRandom();
      expect(svc.error()).toContain('No Pokémon match');
    });
  });

  describe('import / export', () => {
    it('round-trips a configured team', async () => {
      const { svc } = setup();
      await svc.add('bulbasaur');
      const uid = svc.team()[0]!.uid;
      svc.patch(uid, {
        nickname: 'Bulby',
        level: 77,
        natureName: 'Modest',
        ability: 'chlorophyll',
      });
      svc.toggleMove(uid, 'tackle');
      const json = svc.exportJson();
      const parsed = JSON.parse(json) as { version: number; team: Record<string, unknown>[] };
      expect(parsed.version).toBe(1);
      expect(parsed.team[0]).toEqual({
        id: 1,
        nickname: 'Bulby',
        ability: 'chlorophyll',
        moves: ['growl', 'vine-whip', 'razor-leaf'],
        level: 77,
        natureName: 'Modest',
      });

      TestBed.resetTestingModule();
      const other = setup();
      await other.svc.importJson(json);
      expect(other.svc.team()).toHaveLength(1);
      expect(other.svc.team()[0]).toMatchObject({
        name: 'bulbasaur',
        nickname: 'Bulby',
        level: 77,
        natureName: 'Modest',
        ability: 'chlorophyll',
        moves: ['growl', 'vine-whip', 'razor-leaf'],
      });
      expect(other.svc.adding()).toBe(false);
    });

    it('rejects invalid JSON and empty teams', async () => {
      const { svc } = setup();
      await svc.importJson('{nope');
      expect(svc.error()).toContain('valid team JSON');
      await svc.importJson('{"team": []}');
      expect(svc.error()).toContain('No team members');
      await svc.importJson('{"team": 3}');
      expect(svc.error()).toContain('No team members');
      expect(svc.team()).toHaveLength(0);
    });

    it('sanitises imported data and drops members that fail to load', async () => {
      const { svc } = setup();
      const team = [
        {
          id: 1,
          nickname: 'A',
          ability: 'unknown',
          moves: ['tackle', 'not-a-move', 'growl'],
          level: 999,
          natureName: '',
        },
        { id: 99999, nickname: 'ghost', ability: '', moves: [], level: 5, natureName: 'Bold' },
        { id: 25, ability: 'overgrow', level: 'x' },
      ];
      await svc.importJson(JSON.stringify({ team }));
      expect(svc.team().map((m) => m.name)).toEqual(['bulbasaur', 'pikachu']);
      const [a, p] = svc.team();
      expect(a).toMatchObject({
        level: 100,
        ability: 'overgrow', // unknown ability -> default
        natureName: 'Hardy', // empty -> default
        moves: ['tackle', 'growl'],
      });
      expect(p).toMatchObject({ nickname: '', level: 50, moves: [] });
    });

    it('imports at most six members', async () => {
      const { svc, api } = setup();
      const team = Array.from({ length: 9 }, () => ({ id: 25, level: 5 }));
      await svc.importJson(JSON.stringify({ team }));
      expect(svc.team()).toHaveLength(6);
      expect(api.pokemon).toHaveBeenCalledTimes(6);
    });
  });

  describe('persistence', () => {
    it('restores a stored roster', async () => {
      const { svc, cache } = setup([
        {
          id: 25,
          nickname: 'Volt',
          ability: 'overgrow',
          moves: [],
          level: 12,
          natureName: 'Timid',
        },
      ]);
      await settle();
      expect(cache.loadState).toHaveBeenCalledWith('team-builder:roster');
      expect(svc.team()).toHaveLength(1);
      expect(svc.team()[0]).toMatchObject({ name: 'pikachu', nickname: 'Volt', level: 12 });
    });

    it('saves after the restore whenever the roster changes', async () => {
      const { svc, cache } = setup();
      await settle();
      cache.saveState.mockClear();
      await svc.add('eevee');
      await settle();
      expect(cache.saveState).toHaveBeenCalled();
      const [key, payload] = cache.saveState.mock.calls.at(-1)!;
      expect(key).toBe('team-builder:roster');
      expect((payload as { id: number }[]).map((s) => s.id)).toEqual([133]);
    });

    it('warns once when the roster cannot be saved', async () => {
      const { svc, cache, toast } = setup();
      const show = vi.spyOn(toast, 'show');
      cache.saveState.mockResolvedValue(false);
      await settle();
      await svc.add('eevee');
      await settle();
      await svc.add('mew');
      await settle();
      expect(show).toHaveBeenCalledTimes(1);
      expect(show.mock.calls[0]![0]).toMatchObject({ title: 'Team could not be saved' });
    });
  });
});
