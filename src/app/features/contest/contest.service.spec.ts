import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PokeApiClient } from '../../core/api/pokeapi.client';
import { SaveService } from '../../core/storage/save.service';
import type { BerryFlavorDto, PokemonDto } from '../../core/dto/pokeapi.dto';
import { type Berry, type ContestCategory, MAX_MIX } from '../../game/contest/contest';
import { ContestService } from './contest.service';

const berryRef = (name: string) => ({ name, url: '' });

/** Flavour tables: razz is spicy+dry, pecha sweet, oran bitter, sitrus sour, ghost is potency 0. */
const FLAVOR_TABLE: Record<string, [string, number][]> = {
  spicy: [
    ['razz', 10],
    ['ghost', 0],
  ],
  dry: [['razz', 12]],
  sweet: [['pecha', 20]],
  bitter: [['oran', 5]],
  sour: [['sitrus', 15]],
};

function pokemonDto(id: number, name: string, art: string | null = null): PokemonDto {
  return {
    id,
    name,
    sprites: { other: { 'official-artwork': { front_default: art, front_shiny: null } } },
  } as unknown as PokemonDto;
}

const berry = (name: string, flavors: Partial<Berry['flavors']> = {}): Berry => ({
  name,
  flavors: { spicy: 0, dry: 0, sweet: 0, bitter: 0, sour: 0, ...flavors },
});

const CHAIN: ContestCategory[] = ['cool', 'beauty', 'cute', 'smart', 'tough'];

describe('ContestService', () => {
  let api: { berryFlavor: ReturnType<typeof vi.fn>; pokemon: ReturnType<typeof vi.fn> };

  function create(): ContestService {
    TestBed.configureTestingModule({ providers: [{ provide: PokeApiClient, useValue: api }] });
    return TestBed.inject(ContestService);
  }

  async function ready(): Promise<ContestService> {
    const svc = create();
    await vi.waitFor(() => expect(svc.status()).not.toBe('loading'));
    return svc;
  }

  /** Play a whole performance along the combo chain. */
  function perform(svc: ContestService): void {
    svc.beginPerformance();
    for (let i = 0; i < svc.totalRounds; i++) svc.appeal(CHAIN[i]!);
  }

  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
    api = {
      berryFlavor: vi.fn().mockImplementation((flavor: string) =>
        Promise.resolve({
          id: 1,
          name: flavor,
          contest_type: berryRef('cool'),
          berries: (FLAVOR_TABLE[flavor] ?? []).map(([name, potency]) => ({
            potency,
            berry: berryRef(name),
          })),
        } satisfies BerryFlavorDto),
      ),
      pokemon: vi.fn().mockImplementation((q: number | string) => {
        if (q === 133) return Promise.resolve(pokemonDto(133, 'eevee', 'eevee.png'));
        if (q === 'pikachu') return Promise.resolve(pokemonDto(25, 'pikachu'));
        return Promise.reject(new Error('404'));
      }),
    };
  });

  it('stocks the pantry from the flavour endpoints, merging flavours and sorting by potency', async () => {
    const svc = create();
    expect(svc.status()).toBe('loading');
    await vi.waitFor(() => expect(svc.status()).toBe('ready'));

    expect(api.berryFlavor).toHaveBeenCalledTimes(5);
    expect(svc.pantry().map((b) => b.name)).toEqual(['Razz', 'Pecha', 'Sitrus', 'Oran']);
    expect(svc.pantry()[0]!.flavors).toMatchObject({ spicy: 10, dry: 12, sweet: 0 });
    expect(svc.performer()).toEqual({ dex: 133, name: 'Eevee', sprite: 'eevee.png' });
    expect(svc.rank()).toBe('normal');
    expect(svc.rankLabel()).toBe('Normal Rank');
  });

  it('falls back to the artwork URL when the DTO has no official artwork', async () => {
    const svc = await ready();
    await svc.choosePerformer('pikachu');
    expect(svc.performer()!.name).toBe('Pikachu');
    expect(svc.performer()!.sprite).toContain('25');
  });

  it('shows an error and retries the pantry load', async () => {
    api.berryFlavor.mockRejectedValueOnce(new Error('down'));
    const svc = await ready();
    expect(svc.status()).toBe('error');
    expect(svc.error()).toContain('could not be stocked');

    svc.retry();
    await vi.waitFor(() => expect(svc.status()).toBe('ready'));
    expect(svc.error()).toBeNull();
    expect(svc.pantry().length).toBe(4);
  });

  it('toggles berries into the mix, caps it, and exposes conditions', async () => {
    const svc = await ready();
    const [razz, pecha, sitrus, oran] = svc.pantry();
    expect(svc.canEnter()).toBe(false);

    svc.toggleBerry(razz!);
    expect(svc.inMix(razz!)).toBe(true);
    expect(svc.canEnter()).toBe(true);
    expect(svc.conditions().cool).toBeGreaterThan(0);

    svc.toggleBerry(razz!);
    expect(svc.mix()).toEqual([]);

    [razz, pecha, sitrus, oran].forEach((b) => svc.toggleBerry(b!));
    expect(svc.mix()).toHaveLength(MAX_MIX);
    expect(svc.mixFull()).toBe(true);
    svc.toggleBerry(berry('extra', { sweet: 5 })); // over the cap: ignored
    expect(svc.mix()).toHaveLength(MAX_MIX);

    svc.clearMix();
    expect(svc.mix()).toEqual([]);
    expect(svc.mixFull()).toBe(false);
  });

  it('swapping the performer reports unknown names and ignores blank input', async () => {
    const svc = await ready();
    await svc.choosePerformer('   ');
    expect(api.pokemon).toHaveBeenCalledTimes(1); // only the default load

    await svc.choosePerformer(' nobody ');
    expect(svc.searchError()).toBe('No Pokémon called “nobody” could take the stage.');
    expect(svc.performer()!.name).toBe('Eevee');

    await svc.choosePerformer('pikachu');
    expect(svc.searchError()).toBeNull();
  });

  it('refuses to start without a mix, then runs a full interactive performance', async () => {
    const svc = await ready();
    svc.beginPerformance();
    expect(svc.phase()).toBe('prep');

    svc.toggleBerry(svc.pantry()[0]!);
    svc.setCategory('cool');
    svc.beginPerformance();
    expect(svc.phase()).toBe('stage');
    expect(svc.performance()!.round).toBe(1);
    expect(svc.comboHint('beauty')).toBe(false);

    svc.appeal('cool');
    expect(svc.lastOutcome()!.category).toBe('cool');
    expect(svc.playerHearts()).toBe(svc.lastOutcome()!.total);
    expect(svc.comboHint('beauty')).toBe(true);
    expect(svc.topRivalHearts()).toBeGreaterThan(0);
    expect(svc.phase()).toBe('stage');

    for (const c of CHAIN.slice(1, 4)) svc.appeal(c);
    expect(svc.performance()!.finished).toBe(true);
    expect(svc.phase()).toBe('result');
    const res = svc.result()!;
    expect(res.category).toBe('cool');
    expect(res.ranking).toHaveLength(4);

    svc.appeal('cool'); // finished: ignored
    expect(svc.performance()!.history).toHaveLength(4);
  });

  it('changing the mix, theme or going back drops a running show', async () => {
    const svc = await ready();
    svc.toggleBerry(svc.pantry()[0]!);
    svc.beginPerformance();
    svc.setCategory('smart');
    expect(svc.phase()).toBe('prep');
    expect(svc.performance()).toBeNull();

    svc.beginPerformance();
    svc.appeal('cool');
    svc.backToPrep();
    expect(svc.lastOutcome()).toBeNull();
    expect(svc.result()).toBeNull();
  });

  it('winning awards a ribbon, promotes the rank, and persists both', async () => {
    const svc = await ready();
    svc.toggleBerry(svc.pantry()[0]!);
    let won = false;
    for (let attempt = 0; attempt < 40 && !won; attempt++) {
      perform(svc);
      won = svc.result()!.won;
      if (!won) svc.backToPrep();
    }
    expect(won).toBe(true);
    expect(svc.result()!.promoted).toBe(true);
    expect(svc.rank()).toBe('super');
    expect(svc.hasRibbon(svc.category())).toBe(true);

    TestBed.resetTestingModule();
    const again = await ready();
    expect(again.rank()).toBe('super');
    expect(again.hasRibbon('cute')).toBe(true);
  });

  it('losing keeps the rank and awards nothing', async () => {
    TestBed.configureTestingModule({ providers: [{ provide: PokeApiClient, useValue: api }] });
    TestBed.inject(SaveService).write('contest:rank', 'master');
    const svc = TestBed.inject(ContestService);
    await vi.waitFor(() => expect(svc.status()).toBe('ready'));
    svc.toggleBerry(svc.pantry()[0]!);

    let lost = false;
    for (let attempt = 0; attempt < 40 && !lost; attempt++) {
      perform(svc);
      lost = !svc.result()!.won;
      if (!lost) {
        svc.backToPrep();
        svc.ribbons.set(new Set());
      }
    }
    expect(lost).toBe(true);
    expect(svc.result()!.promoted).toBe(false);
    expect(svc.rank()).toBe('master');
    expect(svc.result()!.playerRank).toBeGreaterThan(1);
  });
});
