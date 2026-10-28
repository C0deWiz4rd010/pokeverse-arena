import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PokeApiClient } from '../../core/api/pokeapi.client';
import type { PokemonDto } from '../../core/dto/pokeapi.dto';
import { ContestComponent } from './contest';
import { ContestService } from './contest.service';

const ref = (name: string) => ({ name, url: '' });

function pokemonDto(id: number, name: string): PokemonDto {
  return {
    id,
    name,
    sprites: { other: { 'official-artwork': { front_default: `${name}.png`, front_shiny: null } } },
  } as unknown as PokemonDto;
}

describe('ContestComponent', () => {
  let fixture: ComponentFixture<ContestComponent>;
  let svc: ContestService;
  let api: { berryFlavor: ReturnType<typeof vi.fn>; pokemon: ReturnType<typeof vi.fn> };

  const root = () => fixture.nativeElement as HTMLElement;
  const text = () => root().textContent ?? '';
  const flush = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const buttons = (sel = 'button') => [...root().querySelectorAll<HTMLButtonElement>(sel)];
  const byText = (label: string) => buttons().find((b) => b.textContent?.includes(label));

  async function mount(): Promise<void> {
    TestBed.configureTestingModule({ providers: [{ provide: PokeApiClient, useValue: api }] });
    svc = TestBed.inject(ContestService);
    fixture = TestBed.createComponent(ContestComponent);
    await vi.waitFor(() => expect(svc.status()).not.toBe('loading'));
    await flush();
  }

  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
    api = {
      berryFlavor: vi.fn().mockImplementation((flavor: string) =>
        Promise.resolve({
          id: 1,
          name: flavor,
          contest_type: ref('cool'),
          berries: flavor === 'spicy' ? [{ potency: 10, berry: ref('cheri') }] : [],
        }),
      ),
      pokemon: vi
        .fn()
        .mockImplementation((q: number | string) =>
          q === 133 || q === 'pikachu'
            ? Promise.resolve(pokemonDto(q === 133 ? 133 : 25, q === 133 ? 'eevee' : 'pikachu'))
            : Promise.reject(new Error('404')),
        ),
    };
  });

  it('renders the backstage with the performer, themes and berry pantry', async () => {
    await mount();
    expect(text()).toContain('Backstage');
    expect(text()).toContain('Eevee');
    expect(text()).toContain('Normal Rank');
    expect(root().querySelectorAll('.cat')).toHaveLength(5);
    expect(root().querySelectorAll('.berry')).toHaveLength(1);
    expect(root().querySelector<HTMLButtonElement>('.enter')!.disabled).toBe(true);
    expect(text()).toContain('Pick up to four berries');
  });

  it('shows the error state with a retry that recovers', async () => {
    api.berryFlavor.mockRejectedValueOnce(new Error('x'));
    await mount();
    expect(text()).toContain('could not be stocked');
    byText('Try again')!.click();
    await vi.waitFor(() => expect(svc.status()).toBe('ready'));
    await flush();
    expect(root().querySelectorAll('.berry')).toHaveLength(1);
  });

  it('picking a berry fills the mix and enables the stage; clearing empties it', async () => {
    await mount();
    svc.setCategory('cool');
    await flush();
    root().querySelector<HTMLButtonElement>('.berry')!.click();
    await flush();
    expect(root().querySelector('.mix-tray .chip')?.textContent).toContain('Cheri');
    expect(root().querySelector('.mix-count')?.textContent).toContain('1 / 4');
    expect(root().querySelector<HTMLButtonElement>('.enter')!.disabled).toBe(false);
    expect(root().querySelector('.berry-pot')?.textContent).toContain('+10');

    byText('Clear mix')!.click();
    await flush();
    expect(svc.mix()).toEqual([]);
  });

  it('changes the theme via the category buttons', async () => {
    await mount();
    const smart = [...root().querySelectorAll<HTMLButtonElement>('.cat')].find((b) =>
      b.textContent?.includes('Smart'),
    )!;
    smart.click();
    await flush();
    expect(svc.category()).toBe('smart');
    expect(smart.classList.contains('active')).toBe(true);
  });

  it('swaps the performer by name and reports unknown ones', async () => {
    await mount();
    const input = root().querySelector<HTMLInputElement>('input[name="performer"]')!;
    const form = root().querySelector<HTMLFormElement>('form.swap')!;

    input.value = 'pikachu';
    input.dispatchEvent(new Event('input'));
    await flush();
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    await vi.waitFor(() => expect(svc.performer()!.name).toBe('Pikachu'));
    await flush();
    expect(text()).toContain('Pikachu');
    expect(input.value).toBe('');

    input.value = 'ghost';
    input.dispatchEvent(new Event('input'));
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    await vi.waitFor(() => expect(svc.searchError()).toBeTruthy());
    await flush();
    expect(root().querySelector('.msg.err')?.textContent).toContain('No Pokémon called');
  });

  it('plays a whole performance and ends on the result screen', async () => {
    await mount();
    root().querySelector<HTMLButtonElement>('.berry')!.click();
    await flush();
    root().querySelector<HTMLButtonElement>('.enter')!.click();
    await flush();

    expect(text()).toContain('Appeal 1 / 4');
    expect(root().querySelectorAll('.move')).toHaveLength(5);
    expect(text()).toContain('On-theme'); // default theme is cute

    const order = ['Dazzling Flash', 'Graceful Charm', 'Endearing Wink', 'Clever Trick'];
    for (const [i, name] of order.entries()) {
      const move = [...root().querySelectorAll<HTMLButtonElement>('.move')].find((b) =>
        b.textContent?.includes(name),
      )!;
      move.click();
      await flush();
      if (i === 0) {
        expect(root().querySelector('.gain')?.textContent).toContain('hearts');
        expect(root().querySelector('.breakdown')?.textContent).toContain('Base 24');
        expect(text()).toContain('Combo!'); // beauty now chains from cool
      }
    }

    expect(svc.phase()).toBe('result');
    expect(root().querySelectorAll('.ranking li')).toHaveLength(4);
    expect(root().querySelectorAll('.recap-round')).toHaveLength(4);
    expect(root().querySelector('.ranking li.me')).not.toBeNull();

    byText('Perform again')!.click();
    await flush();
    expect(text()).toContain('Backstage');
  });
});
