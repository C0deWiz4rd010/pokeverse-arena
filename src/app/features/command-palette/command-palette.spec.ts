/* eslint-disable @typescript-eslint/no-unsafe-call */
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { type Mock, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PokedexEntry } from '../../core/models/pokemon.model';
import { RecentPokemonService } from '../../core/recent/recent-pokemon.service';
import { PokedexService } from '../pokedex/pokedex.service';
import { CommandPaletteComponent } from './command-palette';

const entry = (id: number, name: string, types: PokedexEntry['types'] = []): PokedexEntry => ({
  id,
  name,
  artwork: '',
  types,
  gen: 1,
});

describe('CommandPaletteComponent', () => {
  let fixture: ComponentFixture<CommandPaletteComponent>;
  let router: Router;
  let navigate: ReturnType<typeof vi.spyOn>;
  let navigateByUrl: ReturnType<typeof vi.spyOn>;
  let dex: {
    entries: ReturnType<typeof signal<PokedexEntry[]>>;
    shiny: ReturnType<typeof signal<boolean>>;
    ensureLoaded: ReturnType<typeof vi.fn>;
    toggleShiny: ReturnType<typeof vi.fn>;
  };
  let scrollIntoView: ReturnType<typeof vi.fn>;
  let closed: Mock<() => void>;

  const root = () => fixture.nativeElement as HTMLElement;
  const input = () => root().querySelector<HTMLInputElement>('input')!;
  const items = () => [...root().querySelectorAll<HTMLButtonElement>('.cmd-item')];
  const labels = () => items().map((i) => i.querySelector('.cmd-label')!.textContent!.trim());
  const groupTitles = () =>
    [...root().querySelectorAll('.cmd-group')].map((g) => g.textContent!.trim());
  const flush = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const type = async (value: string) => {
    input().value = value;
    input().dispatchEvent(new Event('input'));
    await flush();
  };
  const key = async (k: string) => {
    const ev = new KeyboardEvent('keydown', { key: k, cancelable: true, bubbles: true });
    input().dispatchEvent(ev);
    await flush();
    return ev;
  };
  const activeLabel = () =>
    root().querySelector('.cmd-item.active .cmd-label')?.textContent?.trim();

  async function open(): Promise<void> {
    fixture.componentRef.setInput('open', true);
    await flush();
  }

  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView as unknown as Element['scrollIntoView'];
    dex = {
      entries: signal([
        entry(25, 'pikachu', ['electric']),
        entry(26, 'raichu', ['electric']),
        entry(172, 'pichu', ['electric']),
        entry(6, 'charizard', ['fire', 'flying']),
      ]),
      shiny: signal(false),
      ensureLoaded: vi.fn().mockResolvedValue(undefined),
      toggleShiny: vi.fn(),
    };
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: PokedexService, useValue: dex }],
    });
    router = TestBed.inject(Router);
    navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    navigateByUrl = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(CommandPaletteComponent);
    document.body.appendChild(fixture.nativeElement);
    closed = vi.fn<() => void>();
    fixture.componentInstance.closed.subscribe(() => closed());
    fixture.componentRef.setInput('open', false);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    document.body.innerHTML = '';
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('renders nothing while closed', () => {
    expect(root().querySelector('.cmd-panel')).toBeNull();
    expect(dex.ensureLoaded).not.toHaveBeenCalled();
  });

  it('opens with pages and actions, warms the dex and focuses the search box', async () => {
    await open();
    expect(root().querySelector('[role="dialog"]')).not.toBeNull();
    expect(dex.ensureLoaded).toHaveBeenCalled();
    expect(groupTitles()).toEqual(['Go to', 'Actions']);
    expect(labels()).toContain('Pokédex');
    expect(labels()).toContain('Fight the Daily Challenge');
    expect(labels()).toContain('Enable shiny sprites');
    expect(activeLabel()).toBe('Home');
    vi.advanceTimersByTime(1);
    expect(document.activeElement).toBe(input());
  });

  it('shows the recently viewed Pokémon first when the query is empty', async () => {
    TestBed.inject(RecentPokemonService).record(25, 'pikachu');
    TestBed.inject(RecentPokemonService).record(6, 'charizard');
    await open();
    expect(groupTitles()[0]).toBe('Recent');
    expect(labels().slice(0, 2)).toEqual(['Charizard', 'Pikachu']);
    expect(items()[0]!.querySelector('.cmd-sprite')).not.toBeNull();

    items()[1]!.click();
    expect(navigate).toHaveBeenCalledWith(['/pokemon', 25]);
  });

  it('filters pages by label and by keyword', async () => {
    await open();
    await type('fight');
    expect(labels()).toEqual(['Battle', 'Fight the Daily Challenge']);

    await type('arena');
    expect(labels()).toEqual(['Arena']);
    expect(groupTitles()).toEqual(['Go to']);
  });

  it('searches Pokémon only from two characters and ranks prefix matches first', async () => {
    await open();
    await type('p');
    expect(groupTitles()).not.toContain('Pokémon');

    await type('pi');
    expect(groupTitles()).toContain('Pokémon');
    expect(labels().slice(-2)).toEqual(['Pikachu', 'Pichu']);

    await type('chu');
    const mons = items().filter((i) => i.querySelector('.cmd-sprite'));
    expect(mons.map((m) => m.querySelector('.cmd-label')!.textContent!.trim())).toEqual([
      'Pikachu',
      'Raichu',
      'Pichu',
    ]);
    expect(mons[0]!.querySelector('.cmd-hint')!.textContent).toContain('#25 · Electric');
  });

  it('finds a Pokémon by dex number and shows multiple types in the hint', async () => {
    await open();
    await type('#6');
    const hit = items().find((i) => i.querySelector('.cmd-sprite'))!;
    expect(hit.querySelector('.cmd-label')!.textContent!.trim()).toBe('Charizard');
    expect(hit.querySelector('.cmd-hint')!.textContent).toContain('Fire / Flying');
  });

  it('shows the empty state when nothing matches', async () => {
    await open();
    await type('zzzzzz');
    expect(items()).toHaveLength(0);
    expect(root().querySelector('.cmd-empty')?.textContent).toContain('No matches');
    expect(input().hasAttribute('aria-activedescendant')).toBe(false);
  });

  it('arrow keys walk the list, wrap around, and keep aria-activedescendant in sync', async () => {
    await open();
    expect(activeLabel()).toBe('Home');
    const down = await key('ArrowDown');
    expect(down.defaultPrevented).toBe(true);
    expect(activeLabel()).toBe('Pokédex');
    expect(input().getAttribute('aria-activedescendant')).toBe('cmd-opt-1');
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' });

    await key('ArrowUp');
    await key('ArrowUp'); // wraps to the last entry
    expect(root().querySelector('.cmd-item.active')).toBe(items()[items().length - 1]);
    await key('ArrowDown'); // and back to the first
    expect(activeLabel()).toBe('Home');
  });

  it('arrow keys do nothing on an empty result list', async () => {
    await open();
    await type('zzzzzz');
    await key('ArrowDown');
    await key('Enter');
    expect(navigate).not.toHaveBeenCalled();
    expect(navigateByUrl).not.toHaveBeenCalled();
    expect(closed).not.toHaveBeenCalled();
  });

  it('Enter runs the highlighted page, closes the palette', async () => {
    await open();
    await key('ArrowDown');
    await key('Enter');
    expect(navigateByUrl).toHaveBeenCalledWith('/pokedex');
    expect(closed).toHaveBeenCalledTimes(1);
  });

  it('clicking a Pokémon hit opens its detail page', async () => {
    await open();
    await type('char');
    items()
      .find((i) => i.textContent?.includes('Charizard'))!
      .click();
    expect(navigate).toHaveBeenCalledWith(['/pokemon', 6]);
    expect(closed).toHaveBeenCalled();
  });

  it('hovering moves the highlight', async () => {
    await open();
    items()[3]!.dispatchEvent(new Event('pointermove'));
    await flush();
    expect(root().querySelector('.cmd-item.active')).toBe(items()[3]);
  });

  it('Escape closes and typing resets the selection to the top', async () => {
    await open();
    await key('ArrowDown');
    await type('b');
    expect(root().querySelector('.cmd-item.active')).toBe(items()[0]);
    const esc = await key('Escape');
    expect(esc.defaultPrevented).toBe(true);
    expect(closed).toHaveBeenCalled();
  });

  it('clicking the backdrop closes, clicking inside the panel does not', async () => {
    await open();
    root().querySelector<HTMLElement>('.cmd-panel')!.click();
    expect(closed).not.toHaveBeenCalled();
    root().querySelector<HTMLElement>('.cmd-backdrop')!.click();
    expect(closed).toHaveBeenCalledTimes(1);
  });

  it('resets the query every time it is reopened', async () => {
    await open();
    await type('arena');
    fixture.componentRef.setInput('open', false);
    await flush();
    await open();
    expect(input().value).toBe('');
    expect(items().length).toBeGreaterThan(5);
  });

  describe('actions', () => {
    const run = async (label: string) => {
      await open();
      await type(label);
      items()
        .find((i) => i.textContent?.includes(label))!
        .click();
    };

    it('daily challenge', async () => {
      await run('Daily Challenge');
      expect(navigate).toHaveBeenCalledWith(['/battle'], { queryParams: { daily: '1' } });
    });

    it('random Pokémon', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0);
      await run('Surprise me');
      expect(navigate).toHaveBeenCalledWith(['/pokemon', 1]);
    });

    it("today's lab special and random fusion", async () => {
      await run("Splice today's Lab Special");
      const [, extras] = navigate.mock.calls[0]!;
      expect(navigate.mock.calls[0]![0]).toEqual(['/fusion']);
      expect(extras.queryParams.head).toBeGreaterThan(0);
      expect(extras.queryParams.body).toBeGreaterThan(0);

      navigate.mockClear();
      fixture.componentRef.setInput('open', false);
      await flush();
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      await run('Fuse two random');
      expect(navigate).toHaveBeenCalledWith(['/fusion'], {
        queryParams: { head: 513, body: 513 },
      });
    });

    it('shiny toggle label follows the dex state', async () => {
      await run('Enable shiny sprites');
      expect(dex.toggleShiny).toHaveBeenCalled();

      fixture.componentRef.setInput('open', false);
      await flush();
      dex.shiny.set(true);
      await open();
      await type('shiny');
      expect(labels()).toEqual(['Disable shiny sprites']);
    });

    it('favourites', async () => {
      await run('Show my favorites');
      expect(navigate).toHaveBeenCalledWith(['/pokedex'], { queryParams: { fav: '1' } });
    });
  });
});
