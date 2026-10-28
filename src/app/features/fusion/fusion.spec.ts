import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PokeApiClient } from '../../core/api/pokeapi.client';
import { CryService } from '../../core/audio/cry.service';
import type { PokemonDto } from '../../core/dto/pokeapi.dto';
import type { PokedexEntry } from '../../core/models/pokemon.model';
import { ToastService } from '../../core/ui/toast/toast.service';
import { PokedexService } from '../pokedex/pokedex.service';
import { FusionComponent } from './fusion';
import { FusionService } from './fusion.service';

const STAT_NAMES = [
  'hp',
  'attack',
  'defense',
  'special-attack',
  'special-defense',
  'speed',
] as const;

function dto(id: number): PokemonDto {
  return {
    id,
    name: `mon${id}`,
    height: 10,
    weight: 100,
    base_experience: 100,
    order: id,
    is_default: true,
    sprites: { front_default: null, front_shiny: null, back_default: null, back_shiny: null },
    types: [{ slot: 1, type: { name: id % 2 ? 'fire' : 'water', url: '' } }],
    abilities: [{ slot: 1, is_hidden: false, ability: { name: 'static', url: '' } }],
    stats: STAT_NAMES.map((s) => ({ base_stat: 50 + id, effort: 0, stat: { name: s, url: '' } })),
    moves: [],
    species: { name: `mon${id}`, url: `https://pokeapi.co/api/v2/pokemon-species/${id}/` },
  };
}

const entry = (id: number): PokedexEntry => ({
  id,
  name: id === 6 ? 'charizard' : id === 150 ? 'mewtwo' : id === 25 ? 'pikachu' : `mon${id}`,
  artwork: '',
  types: [],
  gen: 1,
});

describe('FusionComponent', () => {
  let fixture: ComponentFixture<FusionComponent>;
  let lab: FusionService;
  let toasts: { show: ReturnType<typeof vi.fn> };
  let cries: { muted: ReturnType<typeof signal<boolean>>; playPair: ReturnType<typeof vi.fn> };
  const dexEntries = signal<PokedexEntry[]>([entry(6), entry(25), entry(150), entry(151)]);

  const root = () => fixture.nativeElement as HTMLElement;
  const text = () => root().textContent ?? '';
  const flush = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const byText = (label: string) =>
    [...root().querySelectorAll<HTMLButtonElement>('button')].find((b) =>
      b.textContent?.includes(label),
    );

  async function mount(url = '/'): Promise<void> {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: PokeApiClient,
          useValue: { pokemon: (id: number) => Promise.resolve(dto(id)) },
        },
        {
          provide: PokedexService,
          useValue: {
            entries: dexEntries,
            ensureLoaded: vi.fn().mockResolvedValue(undefined),
            entryById: (id: number) => entry(id),
          },
        },
        { provide: ToastService, useValue: toasts },
        { provide: CryService, useValue: cries },
      ],
    });
    await TestBed.inject(Router).navigateByUrl(url);
    lab = TestBed.inject(FusionService);
    fixture = TestBed.createComponent(FusionComponent);
    await flush();
  }

  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
    toasts = { show: vi.fn() };
    cries = { muted: signal(false), playPair: vi.fn() };
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("shows the empty lab prompt and today's special", async () => {
    await mount();
    expect(text()).toContain('Pick a head and a body');
    expect(root().querySelector('.special')).not.toBeNull();
    expect(root().querySelector('.stage.empty')).not.toBeNull();
  });

  it("loads today's lab special into both slots", async () => {
    await mount();
    root().querySelector<HTMLButtonElement>('.special')!.click();
    await vi.waitFor(() => expect(lab.fusion()).not.toBeNull());
    await flush();
    expect(root().querySelector('.special.active')).not.toBeNull();
    expect(root().querySelector('.fused-name')).not.toBeNull();
  });

  it('restores a shared fusion from the deep link and stages the merge', async () => {
    await mount('/?head=6&body=150');
    await vi.waitFor(() => expect(lab.fusion()).not.toBeNull());
    await flush();

    expect(lab.headId()).toBe(6);
    expect(lab.bodyId()).toBe(150);
    expect(root().querySelector<HTMLInputElement>('#head-input')!.value).toBe('Mon6');
    expect(root().querySelector('.stage.merging')).not.toBeNull();
    vi.advanceTimersByTime(1000);
    await flush();
    expect(root().querySelector('.stage.done')).not.toBeNull();

    expect(text()).toContain(lab.fusion()!.name);
    expect(root().querySelectorAll('pv-stat-bar')).toHaveLength(6);
    expect(TestBed.inject(Router).url).toContain('head=6');
  });

  it('suggests matching Pokémon while typing and picks one', async () => {
    await mount();
    const input = root().querySelector<HTMLInputElement>('#head-input')!;
    input.value = 'pika';
    input.dispatchEvent(new Event('input'));
    await flush();
    const items = root().querySelectorAll<HTMLLIElement>('.suggest li');
    expect(items).toHaveLength(1);
    expect(items[0]!.textContent).toContain('Pikachu');

    items[0]!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    await vi.waitFor(() => expect(lab.headId()).toBe(25));
    await flush();
    expect(root().querySelector('.suggest')).toBeNull();
    expect(input.value).toBe('Mon25');
  });

  it('suggests by dex number and ranks prefix matches before substrings', async () => {
    await mount();
    const input = root().querySelector<HTMLInputElement>('#body-input')!;
    input.value = '#150';
    input.dispatchEvent(new Event('input'));
    await flush();
    expect(root().querySelector('.suggest li')?.textContent).toContain('Mewtwo');

    input.value = 'mon';
    input.dispatchEvent(new Event('input'));
    await flush();
    expect(root().querySelectorAll('.suggest li')).toHaveLength(1);

    input.value = 'zzz';
    input.dispatchEvent(new Event('input'));
    await flush();
    expect(root().querySelector('.suggest')).toBeNull();
  });

  it('closes the suggestions shortly after blur', async () => {
    await mount();
    const input = root().querySelector<HTMLInputElement>('#head-input')!;
    input.value = 'pika';
    input.dispatchEvent(new Event('input'));
    await flush();
    input.dispatchEvent(new Event('blur'));
    vi.advanceTimersByTime(130);
    await flush();
    expect(root().querySelector('.suggest')).toBeNull();
  });

  it('surprise fusion randomises both donors and swap exchanges them', async () => {
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.005).mockReturnValueOnce(0.5);
    await mount();
    byText('Surprise fusion')!.click();
    await vi.waitFor(() => expect(lab.fusion()).not.toBeNull());
    await flush();
    const head = lab.headId();
    const body = lab.bodyId();
    expect(head).not.toBe(body);

    byText('Swap')!.click();
    await flush();
    expect(lab.headId()).toBe(body);
    expect(lab.bodyId()).toBe(head);
    expect(root().querySelector<HTMLInputElement>('#head-input')!.value).toBe(`Mon${body}`);
  });

  it('dice buttons pick a random donor for that slot only', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.01);
    await mount();
    const dice = root().querySelectorAll<HTMLButtonElement>('.dice');
    dice[1]!.click();
    await vi.waitFor(() => expect(lab.bodyId()).not.toBeNull());
    expect(lab.headId()).toBeNull();
  });

  it('plays the chimera cry unless muted', async () => {
    await mount('/?head=6&body=150');
    await vi.waitFor(() => expect(lab.fusion()).not.toBeNull());
    await flush();
    byText('Chimera cry')!.click();
    expect(cries.playPair).toHaveBeenCalledWith(6, 150);

    cries.muted.set(true);
    byText('Chimera cry')!.click();
    expect(cries.playPair).toHaveBeenCalledTimes(1);
  });

  it('copies a share link and falls back to a toast with the text when the clipboard fails', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    await mount('/?head=6&body=150');
    await vi.waitFor(() => expect(lab.fusion()).not.toBeNull());
    await flush();

    byText('Share')!.click();
    await vi.waitFor(() => expect(toasts.show).toHaveBeenCalled());
    const copied = writeText.mock.calls[0]![0] as string;
    expect(copied).toContain(lab.fusion()!.name);
    expect(copied).toContain('head=6');
    expect(toasts.show.mock.calls[0]![0].title).toBe('Fusion copied');

    writeText.mockRejectedValueOnce(new Error('denied'));
    byText('Share')!.click();
    await vi.waitFor(() => expect(toasts.show).toHaveBeenCalledTimes(2));
    expect(toasts.show.mock.calls[1]![0].title).toBe('Could not copy');
  });

  it('registers a fusion in the Fusion Dex, reloads it from the gallery and removes it', async () => {
    await mount('/?head=6&body=150');
    await vi.waitFor(() => expect(lab.fusion()).not.toBeNull());
    await flush();

    byText('Register')!.click();
    await flush();
    expect(lab.dex()).toHaveLength(1);
    expect(toasts.show.mock.calls[0]![0].kind).toBe('achievement');
    expect(text()).toContain('In Fusion Dex');
    expect(root().querySelectorAll('.dex-card')).toHaveLength(1);

    byText('In Fusion Dex')!.click(); // un-register: no new toast
    await flush();
    expect(lab.dex()).toHaveLength(0);
    expect(toasts.show).toHaveBeenCalledTimes(1);

    lab.toggleSaved();
    await flush();
    vi.stubGlobal('scrollTo', vi.fn());
    await lab.setPair(25, 151);
    root().querySelector<HTMLButtonElement>('.dex-card')!.click();
    await vi.waitFor(() => expect(lab.headId()).toBe(6));
    await flush();
    expect(root().querySelector<HTMLInputElement>('#head-input')!.value).toBe('Mon6');

    root().querySelector<HTMLElement>('.dex-remove')!.click();
    await flush();
    expect(lab.dex()).toHaveLength(0);
    expect(root().querySelector('.dex-section')).toBeNull();
    vi.unstubAllGlobals();
  });

  it('shows an error when a donor cannot be loaded', async () => {
    await mount();
    TestBed.inject(PokeApiClient).pokemon = () => Promise.reject(new Error('x'));
    await lab.setSlot('head', 77);
    await flush();
    expect(root().querySelector('.error')?.textContent).toContain('Could not load that Pokémon');
  });
});
