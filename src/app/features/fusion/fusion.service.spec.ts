/* eslint-disable @typescript-eslint/no-misused-promises */
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PokeApiClient } from '../../core/api/pokeapi.client';
import type { PokemonDto } from '../../core/dto/pokeapi.dto';
import { FUSION_MAX_ID, FusionService } from './fusion.service';

const STAT_NAMES = [
  'hp',
  'attack',
  'defense',
  'special-attack',
  'special-defense',
  'speed',
] as const;

function dto(id: number, name: string, type: string, base = 50): PokemonDto {
  return {
    id,
    name,
    height: 10,
    weight: 100,
    base_experience: 100,
    order: id,
    is_default: true,
    sprites: { front_default: null, front_shiny: null, back_default: null, back_shiny: null },
    types: [{ slot: 1, type: { name: type, url: '' } }],
    abilities: [{ slot: 1, is_hidden: false, ability: { name: 'static', url: '' } }],
    stats: STAT_NAMES.map((s) => ({ base_stat: base, effort: 0, stat: { name: s, url: '' } })),
    moves: [],
    species: { name, url: `https://pokeapi.co/api/v2/pokemon-species/${id}/` },
  };
}

describe('FusionService', () => {
  let api: { pokemon: ReturnType<typeof vi.fn> };

  function create(): FusionService {
    TestBed.configureTestingModule({ providers: [{ provide: PokeApiClient, useValue: api }] });
    return TestBed.inject(FusionService);
  }

  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
    api = {
      pokemon: vi.fn().mockImplementation((id: number) => {
        if (id === 6) return Promise.resolve(dto(6, 'charizard', 'fire', 80));
        if (id === 150) return Promise.resolve(dto(150, 'mewtwo', 'psychic', 100));
        return Promise.reject(new Error('404'));
      }),
    };
  });

  afterEach(() => vi.restoreAllMocks());

  it('has no fusion until both donors are loaded', async () => {
    const svc = create();
    expect(svc.fusion()).toBeNull();
    await svc.setSlot('head', 6);
    expect(svc.headId()).toBe(6);
    expect(svc.head()!.name).toBe('charizard');
    expect(svc.fusion()).toBeNull();
    await svc.setSlot('body', 150);
    expect(svc.fusion()).not.toBeNull();
    expect(svc.loading()).toBe(false);
  });

  it('tracks loading while a request is pending and skips reloading the same id', async () => {
    const svc = create();
    const p = svc.setSlot('head', 6);
    expect(svc.loading()).toBe(true);
    await p;
    expect(svc.loading()).toBe(false);
    await svc.setSlot('head', 6);
    expect(api.pokemon).toHaveBeenCalledTimes(1);
  });

  it('setPair loads both slots in parallel', async () => {
    const svc = create();
    await svc.setPair(6, 150);
    expect(svc.head()!.id).toBe(6);
    expect(svc.body()!.id).toBe(150);
    expect(svc.fusion()!.name.length).toBeGreaterThan(0);
  });

  it('reports a failed load and frees the slot', async () => {
    const svc = create();
    await svc.setSlot('body', 999);
    expect(svc.error()).toContain('Could not load that Pokémon');
    expect(svc.bodyId()).toBeNull();
    expect(svc.body()).toBeNull();

    await svc.setSlot('body', 6);
    expect(svc.error()).toBeNull();
  });

  it('drops a stale response when the slot was re-picked in the meantime', async () => {
    const resolvers = new Map<number, (d: PokemonDto) => void>();
    api.pokemon.mockImplementation(
      (id: number) => new Promise<PokemonDto>((res) => resolvers.set(id, res)),
    );
    const svc = create();
    const first = svc.setSlot('head', 6);
    const second = svc.setSlot('head', 150);
    resolvers.get(150)!(dto(150, 'mewtwo', 'psychic'));
    await second;
    resolvers.get(6)!(dto(6, 'charizard', 'fire'));
    await first;
    expect(svc.head()!.id).toBe(150);
    expect(svc.loading()).toBe(false);
  });

  it('swap() exchanges donors and yields a different fusion', async () => {
    const svc = create();
    await svc.setPair(6, 150);
    const before = svc.fusion()!;
    svc.swap();
    expect(svc.headId()).toBe(150);
    expect(svc.bodyId()).toBe(6);
    expect(svc.head()!.name).toBe('mewtwo');
    expect(svc.fusion()!.code).not.toBe(before.code);
  });

  it('randomId stays in range and avoids the excluded id', () => {
    const svc = create();
    vi.spyOn(Math, 'random').mockReturnValue(0);
    expect(svc.randomId()).toBe(1);
    expect(svc.randomId(1)).toBe(2);
    vi.spyOn(Math, 'random').mockReturnValue(0.9999999);
    expect(svc.randomId()).toBe(FUSION_MAX_ID);
    expect(svc.randomId(FUSION_MAX_ID)).toBe(1); // wraps around
  });

  it('registers fusions in a persistent dex, toggles and removes them', async () => {
    const svc = create();
    svc.toggleSaved(); // nothing loaded: ignored
    expect(svc.dex()).toEqual([]);

    await svc.setPair(6, 150);
    expect(svc.isSaved()).toBe(false);
    svc.toggleSaved();
    expect(svc.isSaved()).toBe(true);
    const saved = svc.dex()[0]!;
    expect(saved).toMatchObject({ headId: 6, bodyId: 150, code: svc.fusion()!.code });

    // persisted
    TestBed.resetTestingModule();
    const again = create();
    expect(again.dex()).toHaveLength(1);

    again.toggleSaved(); // nothing loaded in the new instance
    again.remove(saved.code);
    expect(again.dex()).toEqual([]);

    await svc.setPair(6, 150);
    svc.toggleSaved(); // un-save
    expect(svc.isSaved()).toBe(false);
  });
});
