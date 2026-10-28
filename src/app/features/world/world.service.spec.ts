import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PokeApiClient } from '../../core/api/pokeapi.client';
import { SaveService } from '../../core/storage/save.service';
import { CryService } from '../../core/audio/cry.service';
import type { GenerationDto, PokemonDto } from '../../core/dto/pokeapi.dto';
import { REGIONS } from '../../game/world/regions';
import { WorldService } from './world.service';

const KANTO = REGIONS[0]!;
const JOHTO = REGIONS[1]!;

const species = (name: string, id: number) => ({
  name,
  url: `https://pokeapi.co/api/v2/pokemon-species/${id}/`,
});

function generation(): GenerationDto {
  return {
    id: 1,
    name: 'generation-i',
    main_region: { name: 'kanto', url: '' },
    pokemon_species: [
      species('pikachu', 25),
      species('bulbasaur', 1),
      species('ghost', 0),
      species('far-future', 5000),
      species('charmander', 4),
    ],
  };
}

function pokemonDto(id: number, name: string): PokemonDto {
  return { id, name } as unknown as PokemonDto;
}

describe('WorldService', () => {
  let api: { generation: ReturnType<typeof vi.fn>; pokemon: ReturnType<typeof vi.fn> };
  let cry: { play: ReturnType<typeof vi.fn> };

  function create(): WorldService {
    TestBed.configureTestingModule({
      providers: [
        { provide: PokeApiClient, useValue: api },
        { provide: CryService, useValue: cry },
      ],
    });
    return TestBed.inject(WorldService);
  }

  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
    api = {
      generation: vi.fn().mockResolvedValue(generation()),
      pokemon: vi.fn().mockImplementation((q: string | number) => {
        if (q === 'pikachu' || q === '25') return Promise.resolve(pokemonDto(25, 'pikachu'));
        if (q === 'unknownmon') return Promise.resolve(pokemonDto(1500, 'unknownmon'));
        return Promise.reject(new Error('404'));
      }),
    };
    cry = { play: vi.fn() };
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('starts idle with nothing caught and zeroed region progress', () => {
    const svc = create();
    expect(svc.status()).toBe('idle');
    expect(svc.worldCaught()).toBe(0);
    expect(svc.regionProgress()).toHaveLength(REGIONS.length);
    expect(svc.regionProgress()[0]).toMatchObject({ caught: 0, total: 151, pct: 0 });
    expect(svc.regionCaughtCount()).toBe(0);
    expect(svc.regionCompletion()).toBe(0);
  });

  it('restores caught and shiny sets from the save', () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: PokeApiClient, useValue: api },
        { provide: CryService, useValue: cry },
      ],
    });
    const save = TestBed.inject(SaveService);
    save.write('world:caught', [1, 4, 25]);
    save.write('world:shiny', [25]);
    const svc = TestBed.inject(WorldService);
    expect(svc.isCaught(4)).toBe(true);
    expect(svc.isCaught(5)).toBe(false);
    expect(svc.shinyCount()).toBe(1);
    expect(svc.worldCaught()).toBe(3);
  });

  it('loads a region: filters invalid dex ids, sorts and names the members', async () => {
    const svc = create();
    const pending = svc.select(KANTO);
    expect(svc.status()).toBe('loading');
    expect(svc.activeRegion()).toBe(KANTO);
    await pending;

    expect(api.generation).toHaveBeenCalledWith(1);
    expect(svc.status()).toBe('ready');
    expect(svc.members().map((m) => m.dex)).toEqual([1, 4, 25]);
    expect(svc.members().map((m) => m.name)).toEqual(['Bulbasaur', 'Charmander', 'Pikachu']);
    expect(svc.members()[2]!.sprite).toContain('/pokemon/25.png');
    expect(svc.count()).toBe(3);
  });

  it('does not reload an already ready region, but switches to another one', async () => {
    const svc = create();
    await svc.select(KANTO);
    await svc.select(KANTO);
    expect(api.generation).toHaveBeenCalledTimes(1);
    await svc.select(JOHTO);
    expect(api.generation).toHaveBeenCalledTimes(2);
    expect(svc.activeRegion()).toBe(JOHTO);
  });

  it('reports a load failure and can recover by going back', async () => {
    api.generation.mockRejectedValueOnce(new Error('offline'));
    const svc = create();
    await svc.select(KANTO);
    expect(svc.status()).toBe('error');
    expect(svc.error()).toContain('Could not reach the region');
    expect(svc.members()).toEqual([]);

    svc.back();
    expect(svc.status()).toBe('idle');
    expect(svc.activeRegion()).toBeNull();

    await svc.select(KANTO);
    expect(svc.status()).toBe('ready');
    expect(svc.error()).toBeNull();
  });

  it('locate() highlights a Pokémon and opens its debut region', async () => {
    const svc = create();
    await svc.locate('  Pikachu ');
    expect(api.pokemon).toHaveBeenCalledWith('pikachu');
    expect(svc.sighting()).toMatchObject({ dex: 25, name: 'Pikachu', region: KANTO });
    expect(svc.activeRegion()).toBe(KANTO);
    expect(svc.status()).toBe('ready');
    expect(svc.searchError()).toBeNull();
  });

  it('locate() ignores blank queries and clears previous results', async () => {
    const svc = create();
    await svc.locate('pikachu');
    await svc.locate('   ');
    expect(svc.sighting()).toBeNull();
    expect(api.pokemon).toHaveBeenCalledTimes(1);
  });

  it('locate() explains unknown names and out-of-range dex numbers', async () => {
    const svc = create();
    await svc.locate('missingno');
    expect(svc.searchError()).toBe('No Pokémon called “missingno” was found.');
    expect(svc.sighting()).toBeNull();

    await svc.locate('unknownmon');
    expect(svc.searchError()).toBe('Unknownmon roams beyond the charted regions.');
    expect(svc.activeRegion()).toBeNull();

    svc.clearSearch();
    expect(svc.searchError()).toBeNull();
  });

  describe('expedition', () => {
    it('roam() does nothing without a region', () => {
      const svc = create();
      svc.roam();
      expect(svc.encounter()).toBeNull();
      expect(cry.play).not.toHaveBeenCalled();
    });

    it('roam() rolls an encounter inside the region with its catch chance', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const svc = create();
      await svc.select(KANTO);
      svc.roam();
      const enc = svc.encounter()!;
      expect(enc.dex).toBeGreaterThanOrEqual(KANTO.dexStart);
      expect(enc.dex).toBeLessThanOrEqual(KANTO.dexEnd);
      expect(enc.shiny).toBe(false);
      expect(enc.caught).toBe(false);
      expect(enc.chancePct).toBe(Math.round(Math.min(0.95, enc.catchRate) * 100));
      expect(svc.expeditionToast()).toBeNull();
      expect(cry.play).toHaveBeenCalledWith(enc.dex, 0.35);

      svc.setBall('ultra');
      expect(svc.ball()).toBe('ultra');
      svc.roam();
      expect(svc.encounter()!.chancePct).toBe(
        Math.round(Math.min(0.95, svc.encounter()!.catchRate * 2) * 100),
      );
    });

    it('roam() announces a shiny with the shiny sprite', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0);
      const svc = create();
      await svc.select(KANTO);
      svc.roam();
      const enc = svc.encounter()!;
      expect(enc.shiny).toBe(true);
      expect(enc.sprite).toContain('/pokemon/shiny/');
      expect(svc.expeditionToast()).toContain('shiny');
    });

    it('a successful throw registers the Pokémon after the wobble and persists it', async () => {
      vi.useFakeTimers();
      const random = vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const svc = create();
      await svc.select(KANTO);
      svc.roam();
      const enc = svc.encounter()!;
      random.mockReturnValue(0); // always succeeds

      svc.throwBall();
      expect(svc.throwing()).toBe(true);
      svc.throwBall(); // ignored while throwing
      vi.advanceTimersByTime(850);

      expect(svc.throwing()).toBe(false);
      expect(svc.isCaught(enc.dex)).toBe(true);
      expect(svc.encounter()!.caught).toBe(true);
      expect(svc.expeditionToast()).toContain('Gotcha!');
      expect(svc.worldCaught()).toBe(1);
      expect(svc.regionCaughtCount()).toBe(1);
      expect(svc.regionProgress()[0]!.caught).toBe(1);
      expect(cry.play).toHaveBeenLastCalledWith(enc.dex, 0.4);

      svc.throwBall(); // already caught: no-op
      expect(svc.throwing()).toBe(false);

      // A fresh service reads the persisted dex back.
      TestBed.resetTestingModule();
      const again = create();
      expect(again.isCaught(enc.dex)).toBe(true);
    });

    it('catching a shiny also fills the shiny collection', async () => {
      vi.useFakeTimers();
      vi.spyOn(Math, 'random').mockReturnValue(0); // shiny + success
      const svc = create();
      await svc.select(KANTO);
      svc.roam();
      const dex = svc.encounter()!.dex;
      svc.throwBall();
      vi.advanceTimersByTime(850);
      expect(svc.shinyCaught().has(dex)).toBe(true);
      expect(svc.shinyCount()).toBe(1);
      expect(svc.expeditionToast()).toContain('shiny');
      expect(svc.expeditionToast()).toContain('joined your dex');
    });

    it('a failed throw leaves the dex untouched', async () => {
      vi.useFakeTimers();
      const random = vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const svc = create();
      await svc.select(KANTO);
      svc.roam();
      random.mockReturnValue(0.999);
      svc.throwBall();
      vi.advanceTimersByTime(850);
      expect(svc.worldCaught()).toBe(0);
      expect(svc.encounter()!.caught).toBe(false);
      expect(svc.expeditionToast()).toContain('broke free');
    });

    it('fleeEncounter() and back() clear the encounter', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const svc = create();
      await svc.select(KANTO);
      svc.roam();
      svc.fleeEncounter();
      expect(svc.encounter()).toBeNull();
      expect(svc.expeditionToast()).toBeNull();

      svc.roam();
      svc.back();
      expect(svc.encounter()).toBeNull();
      expect(svc.members()).toEqual([]);
    });
  });
});
