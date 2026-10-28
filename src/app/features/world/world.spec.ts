import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PokeApiClient } from '../../core/api/pokeapi.client';
import { CryService } from '../../core/audio/cry.service';
import type { GenerationDto, PokemonDto } from '../../core/dto/pokeapi.dto';
import { WorldComponent } from './world';
import { WorldService } from './world.service';

const species = (name: string, id: number) => ({
  name,
  url: `https://pokeapi.co/api/v2/pokemon-species/${id}/`,
});

describe('WorldComponent', () => {
  let fixture: ComponentFixture<WorldComponent>;
  let svc: WorldService;
  let api: { generation: ReturnType<typeof vi.fn>; pokemon: ReturnType<typeof vi.fn> };

  const root = () => fixture.nativeElement as HTMLElement;
  const text = () => root().textContent ?? '';
  const q = <T extends HTMLElement>(sel: string) => root().querySelector<T>(sel);
  const flush = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const buttonByText = (label: string) =>
    [...root().querySelectorAll<HTMLButtonElement>('button')].find((b) =>
      b.textContent?.includes(label),
    );

  beforeEach(async () => {
    localStorage.clear();
    TestBed.resetTestingModule();
    api = {
      generation: vi.fn().mockResolvedValue({
        id: 1,
        name: 'generation-i',
        main_region: { name: 'kanto', url: '' },
        pokemon_species: [species('bulbasaur', 1), species('pikachu', 25)],
      } satisfies GenerationDto),
      pokemon: vi
        .fn()
        .mockImplementation((term: string) =>
          term === 'pikachu'
            ? Promise.resolve({ id: 25, name: 'pikachu' } as unknown as PokemonDto)
            : Promise.reject(new Error('404')),
        ),
    };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: PokeApiClient, useValue: api },
        { provide: CryService, useValue: { play: vi.fn() } },
      ],
    });
    svc = TestBed.inject(WorldService);
    fixture = TestBed.createComponent(WorldComponent);
    await flush();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('shows the world dex and one card per region on the overview', () => {
    expect(text()).toContain('World Dex');
    expect(text()).toContain('0 / 1025 registered');
    expect(root().querySelectorAll('.region-card')).toHaveLength(svc.regions.length);
  });

  it('opens a region when its card is clicked and lists the natives', async () => {
    q<HTMLButtonElement>('.region-card button')!.click();
    await flush();
    expect(api.generation).toHaveBeenCalledWith(1);
    expect(text()).toContain('Kanto');
    expect(root().querySelectorAll('.dex-grid .mon')).toHaveLength(2);
    expect(text()).toContain('Bulbasaur');
    expect(text()).toContain('0 / 2 caught');
  });

  it('shows a spinner while loading and an error with a way back on failure', async () => {
    api.generation.mockRejectedValueOnce(new Error('boom'));
    q<HTMLButtonElement>('.region-card button')!.click();
    await flush();
    expect(text()).toContain('Could not reach the region');

    buttonByText('Back to the map')!.click();
    await flush();
    expect(root().querySelectorAll('.region-card').length).toBeGreaterThan(0);
  });

  it('searches for a Pokémon, highlights it, and clears the search', async () => {
    const input = q<HTMLInputElement>('#world-search')!;
    input.value = 'pikachu';
    input.dispatchEvent(new Event('input'));
    q<HTMLFormElement>('form.finder')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await vi.waitFor(() => expect(svc.status()).toBe('ready'));
    await flush();

    expect(api.pokemon).toHaveBeenCalledWith('pikachu');
    expect(q('.finder-msg.hit')?.textContent).toContain('Pikachu');
    expect(q('.finder-msg.hit')?.textContent).toContain('Kanto');
    expect(q('.mon.spotlight')?.textContent).toContain('Pikachu');

    buttonByText('Clear')!.click();
    await flush();
    expect(q('.finder-msg')).toBeNull();
    expect(q<HTMLInputElement>('#world-search')!.value).toBe('');
  });

  it('reports a failed search', async () => {
    const input = q<HTMLInputElement>('#world-search')!;
    input.value = 'nope';
    input.dispatchEvent(new Event('input'));
    q<HTMLFormElement>('form.finder')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await flush();
    expect(q('.finder-msg.err')?.textContent).toContain('No Pokémon called');
  });

  it('runs an expedition: pick a ball, roam, throw and register the catch', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    q<HTMLButtonElement>('.region-card button')!.click();
    await flush();

    buttonByText('Ultra Ball')!.click();
    await flush();
    expect(svc.ball()).toBe('ultra');
    expect(buttonByText('Ultra Ball')!.classList.contains('on')).toBe(true);

    buttonByText('Roam')!.click();
    await flush();
    expect(q('.encounter')).not.toBeNull();
    expect(text()).toContain('Throw Ultra Ball');

    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0);
    buttonByText('Throw')!.click();
    await flush();
    expect(text()).toContain('Wobble');
    vi.advanceTimersByTime(850);
    await flush();
    expect(q('.encounter.caught')).not.toBeNull();
    expect(text()).toContain('registered to your dex');
    expect(svc.worldCaught()).toBe(1);

    buttonByText('Roam again')!.click();
    await flush();
    expect(q('.encounter')).not.toBeNull();
  });

  it('can leave an encounter', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    q<HTMLButtonElement>('.region-card button')!.click();
    await flush();
    buttonByText('Roam')!.click();
    await flush();
    buttonByText('Leave')!.click();
    await flush();
    expect(q('.encounter')).toBeNull();
  });
});
