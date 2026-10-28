import { Component, input, output, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PokeApiClient } from '../../core/api/pokeapi.client';
import { CryService } from '../../core/audio/cry.service';
import type { PokedexEntry } from '../../core/models/pokemon.model';
import { PokedexComponent } from './pokedex';
import { PokedexService } from './pokedex.service';
import { WhosThatComponent } from './whos-that';

const url = (id: number) => `https://pokeapi.co/api/v2/pokemon/${id}/`;

@Component({
  selector: 'pv-whos-that',
  template: '<div class="whos-stub">{{ pool().length }}</div>',
})
class WhosThatStub {
  readonly pool = input.required<readonly PokedexEntry[]>();
  readonly close = output<void>();
}

const NAMED = [
  { id: 1, name: 'bulbasaur' },
  { id: 4, name: 'charmander' },
  { id: 25, name: 'pikachu' },
  { id: 152, name: 'chikorita' },
];

interface Options {
  total?: number;
  failList?: boolean;
  pendingList?: boolean;
  query?: Record<string, string>;
  preload?: boolean;
}

async function setup(opts: Options = {}) {
  const total = opts.total ?? NAMED.length;
  const rows = [
    ...NAMED,
    ...Array.from({ length: Math.max(0, total - NAMED.length) }, (_, i) => ({
      id: 1000 + i,
      name: `filler-${i}`,
    })),
  ];
  const api = {
    get: vi.fn((u: string) => {
      if (u.includes('/pokemon?')) {
        if (opts.pendingList) return new Promise(() => undefined);
        if (opts.failList) return Promise.reject(new Error('offline'));
        return Promise.resolve({
          results: rows.map((r) => ({ name: r.name, url: url(r.id) })),
        });
      }
      const gen = Number(/generation\/(\d+)/.exec(u)?.[1]);
      const members: Record<number, string[]> = {
        1: ['bulbasaur', 'charmander', 'pikachu'],
        2: ['chikorita'],
      };
      return Promise.resolve({
        pokemon_species: (members[gen] ?? []).map((n) => ({ name: n, url: '' })),
      });
    }),
    type: vi.fn((t: string) => {
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
    pokemon: vi.fn((id: number) =>
      Promise.resolve({
        id,
        name: `mon-${id}`,
        height: 10,
        weight: 10,
        base_experience: 1,
        order: id,
        is_default: true,
        sprites: { front_default: null, front_shiny: null, back_default: null, back_shiny: null },
        types: [{ slot: 1, type: { name: 'grass', url: '' } }],
        abilities: [],
        stats: [],
        moves: [],
        species: { name: `mon-${id}`, url: `https://pokeapi.co/api/v2/pokemon-species/${id}/` },
      }),
    ),
    species: vi.fn((id: number) =>
      Promise.resolve({
        id,
        name: `mon-${id}`,
        gender_rate: 1,
        capture_rate: 1,
        base_happiness: 1,
        is_baby: false,
        is_legendary: false,
        is_mythical: false,
        egg_groups: [],
        color: { name: 'green', url: '' },
        shape: null,
        habitat: null,
        generation: { name: 'generation-i', url: '' },
        evolution_chain: { url: 'https://pokeapi.co/api/v2/evolution-chain/1/' },
        flavor_text_entries: [],
        genera: [],
        varieties: [],
      }),
    ),
    evolutionChain: vi.fn(() =>
      Promise.resolve({
        id: 1,
        chain: {
          is_baby: false,
          species: { name: 'x', url: 'https://pokeapi.co/api/v2/pokemon-species/1/' },
          evolution_details: [],
          evolves_to: [],
        },
      }),
    ),
  };
  const muted = signal(false);
  const cry = {
    muted,
    playing: signal<number | null>(null),
    toggleMute: vi.fn(() => muted.update((m) => !m)),
    play: vi.fn(),
  };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: PokeApiClient, useValue: api },
      { provide: CryService, useValue: cry },
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { queryParamMap: convertToParamMap(opts.query ?? {}) } },
      },
    ],
  });
  TestBed.overrideComponent(PokedexComponent, {
    remove: { imports: [WhosThatComponent] },
    add: { imports: [WhosThatStub] },
  });
  const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  const store = TestBed.inject(PokedexService);
  if (opts.preload) {
    await store.ensureLoaded();
    await vi.waitFor(() => expect(store.enriched()).toBe(true));
  }
  const fixture = TestBed.createComponent(PokedexComponent);
  // the component queries `document` for the search box and cards, so it must be attached
  document.body.appendChild(fixture.nativeElement as HTMLElement);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const q = (sel: string) => el.querySelector<HTMLElement>(sel);
  const qa = (sel: string) => Array.from(el.querySelectorAll<HTMLElement>(sel));
  const settle = async () => {
    await vi.waitFor(() => expect(store.loading()).toBe(false));
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const enriched = async () => {
    await vi.waitFor(() => expect(store.enriched()).toBe(true));
    fixture.detectChanges();
  };
  const type = (input: HTMLInputElement, value: string) => {
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
  };
  const key = (k: string, init: KeyboardEventInit = {}, target: EventTarget = document.body) => {
    const ev = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init });
    target.dispatchEvent(ev);
    fixture.detectChanges();
    return ev;
  };
  const names = () => qa('.grid .card .name').map((n) => n.textContent);
  return { fixture, el, q, qa, store, api, cry, navigate, settle, enriched, type, key, names };
}

describe('PokedexComponent', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  describe('loading states', () => {
    it('shows a skeleton while the index loads', async () => {
      const { q, qa } = await setup({ pendingList: true });
      expect(qa('.skel-card')).toHaveLength(12);
      expect(q('[role="status"]')?.textContent).toContain('Loading the Pokédex');
      expect(q('.grid .card')).toBeNull();
    });

    it('shows an error with a retry action', async () => {
      const { q, store, settle, api, fixture } = await setup({ failList: true });
      await settle();
      expect(q('pv-state[kind="error"], pv-state')?.textContent).toContain(
        'Could not load the Pokédex',
      );
      expect(q('[role="alert"]')).not.toBeNull();
      api.get.mockClear();
      q('pv-state button')!.click();
      await vi.waitFor(() => expect(api.get).toHaveBeenCalled());
      expect(store.error()).not.toBeNull();
      fixture.detectChanges();
    });

    it('renders a card per entry and the result count', async () => {
      const { q, names, settle } = await setup();
      await settle();
      expect(names()).toEqual(['Bulbasaur', 'Charmander', 'Pikachu', 'Chikorita']);
      expect(q('.result-count')?.textContent).toBe('4 results');
      expect(q('pv-page-header')?.textContent).toContain('4 of 4 Pokémon');
    });

    it('shows a loading hint until types are enriched', async () => {
      const { q, settle, enriched } = await setup();
      await settle();
      await enriched();
      expect(q('.hint')).toBeNull();
      expect(q('.gen-pips')).not.toBeNull();
    });
  });

  describe('search and filters', () => {
    it('filters by the search text and shows the empty state', async () => {
      const { q, names, type, settle, fixture } = await setup();
      await settle();
      const input = q('.search input') as HTMLInputElement;
      type(input, 'pika');
      expect(names()).toEqual(['Pikachu']);
      expect(q('.result-count')?.textContent).toBe('1 result');
      type(input, 'zzz');
      expect(q('pv-state')?.textContent).toContain('No Pokémon match your filters');
      expect(q('.grid .card')).toBeNull();
      // the empty-state action clears the filters and the input
      q('pv-state button')!.click();
      fixture.detectChanges();
      expect(input.value).toBe('');
      expect(names()).toHaveLength(4);
    });

    it('toggles type chips and the any/all mode', async () => {
      const { q, qa, names, settle, enriched, fixture } = await setup();
      await settle();
      await enriched();
      const chip = (t: string) => qa('.type-chip').find((c) => c.textContent!.trim() === t)!;
      chip('Grass').click();
      fixture.detectChanges();
      expect(names()).toEqual(['Bulbasaur', 'Chikorita']);
      expect(chip('Grass').classList.contains('active')).toBe(true);
      expect(q('.seg')).toBeNull();
      chip('Poison').click();
      fixture.detectChanges();
      expect(q('.seg')).not.toBeNull();
      expect(names()).toEqual(['Bulbasaur', 'Chikorita']);
      const [any, all] = qa('.seg button');
      expect(any!.classList.contains('on')).toBe(true);
      all!.click();
      fixture.detectChanges();
      expect(names()).toEqual(['Bulbasaur']);
      expect(all!.getAttribute('aria-pressed')).toBe('true');
      expect(q('.f-count')?.textContent).toBe('2');
      // reset
      q('.btn.clear')!.click();
      fixture.detectChanges();
      expect(names()).toHaveLength(4);
      expect(q('.btn.clear')).toBeNull();
    });

    it('disables type chips and the generation select before enrichment', async () => {
      const { qa, q } = await setup({ pendingList: true });
      expect(qa('.type-chip').every((c) => (c as HTMLButtonElement).disabled)).toBe(true);
      expect((q('select.gen') as HTMLSelectElement).disabled).toBe(true);
    });

    it('filters by generation via the select and the HUD pips', async () => {
      const { q, qa, names, settle, enriched, fixture } = await setup();
      await settle();
      await enriched();
      const sel = q('select.gen') as HTMLSelectElement;
      sel.value = '2';
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      fixture.detectChanges();
      expect(names()).toEqual(['Chikorita']);
      sel.value = '';
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      fixture.detectChanges();
      expect(names()).toHaveLength(4);

      qa('.pip')[0]!.click(); // gen 1
      fixture.detectChanges();
      expect(names()).toEqual(['Bulbasaur', 'Charmander', 'Pikachu']);
      expect(qa('.pip')[0]!.classList.contains('on')).toBe(true);
      qa('.pip')[0]!.click(); // toggles off
      fixture.detectChanges();
      expect(names()).toHaveLength(4);
    });

    it('sorts, switches view and persists both', async () => {
      const { q, qa, names, settle, store, fixture } = await setup();
      await settle();
      const sort = q('select.sort') as HTMLSelectElement;
      sort.value = 'name';
      sort.dispatchEvent(new Event('change', { bubbles: true }));
      fixture.detectChanges();
      expect(names()).toEqual(['Bulbasaur', 'Charmander', 'Chikorita', 'Pikachu']);
      sort.value = 'id-desc';
      sort.dispatchEvent(new Event('change', { bubbles: true }));
      fixture.detectChanges();
      expect(names()[0]).toBe('Chikorita');
      expect(store.sort()).toBe('id-desc');

      qa('.view-btn')[2]!.click();
      fixture.detectChanges();
      expect(q('.grid')?.classList.contains('list')).toBe(true);
      expect(store.view()).toBe('list');
      qa('.view-btn')[1]!.click();
      fixture.detectChanges();
      expect(q('.grid')?.classList.contains('compact')).toBe(true);
    });

    it('toggles shiny mode on cards', async () => {
      const { q, qa, settle, fixture, store } = await setup();
      await settle();
      const btn = qa('.controls .btn.toggle').find((b) => b.textContent!.includes('Shiny'))!;
      btn.click();
      fixture.detectChanges();
      expect(store.shiny()).toBe(true);
      expect(btn.getAttribute('aria-pressed')).toBe('true');
      expect(q('.card img.still')?.getAttribute('src')).toContain('official-artwork/shiny/1.png');
    });

    it('collapses and expands the filter panels', async () => {
      const { q, fixture } = await setup();
      expect(q('.types-row')).not.toBeNull();
      q('.filter-toggle')!.click();
      fixture.detectChanges();
      expect(q('.types-row')).toBeNull();
      expect(q('.dex-hud')).toBeNull();
      expect(q('.filter-toggle')?.getAttribute('aria-expanded')).toBe('false');
    });

    it('toggles the cry mute button', async () => {
      const { q, cry, fixture } = await setup();
      const btn = q('.btn.icon-only')!;
      expect(btn.getAttribute('title')).toBe('Mute cries');
      btn.click();
      fixture.detectChanges();
      expect(cry.toggleMute).toHaveBeenCalled();
      expect(btn.getAttribute('title')).toBe('Unmute cries');
    });
  });

  describe('favourites, caught and progress', () => {
    it('toggles favourites from cards and filters to favourites only', async () => {
      const { q, qa, names, settle, store, fixture } = await setup();
      await settle();
      qa('.card .fav-btn')[2]!.click(); // pikachu
      fixture.detectChanges();
      expect(store.isFavorite(25)).toBe(true);
      expect(qa('.card')[2]!.classList.contains('fav')).toBe(true);
      expect(q('.hud-stat.fav strong')?.textContent).toBe('1');
      q('.fav-filter')!.click();
      fixture.detectChanges();
      expect(names()).toEqual(['Pikachu']);
      expect(q('.fav-filter')?.classList.contains('on')).toBe(true);
    });

    it('marks caught species and shows the caught total', async () => {
      localStorage.setItem('pv:world:caught', JSON.stringify({ v: 1, data: [1, 4] }));
      const { q, qa, settle } = await setup();
      await settle();
      expect(qa('.card .dot.caught')).toHaveLength(2);
      expect(q('.hud-stat.caught strong')?.textContent).toBe('2');
    });

    it('fills the generation pip bars from caught progress', async () => {
      localStorage.setItem('pv:world:caught', JSON.stringify({ v: 1, data: [1] }));
      const { qa, settle, enriched } = await setup();
      await settle();
      await enriched();
      const fill = qa('.pip-fill')[0]!;
      expect(fill.style.width).toBe(`${(1 / 3) * 100}%`);
      expect(qa('.pip')[0]!.getAttribute('title')).toBe('Gen 1 — 1/3 caught, 0 ♥');
    });
  });

  describe('paging', () => {
    it('shows 48 cards and loads more on demand', async () => {
      const { q, qa, settle, fixture } = await setup({ total: 60 });
      await settle();
      expect(qa('.grid .card')).toHaveLength(48);
      q('.more .btn')!.click();
      fixture.detectChanges();
      expect(qa('.grid .card')).toHaveLength(60);
      expect(q('.more')).toBeNull();
    });

    it('loads more when the sentinel scrolls into view', async () => {
      let callback!: IntersectionObserverCallback;
      const observe = vi.fn();
      vi.stubGlobal(
        'IntersectionObserver',
        class {
          constructor(cb: IntersectionObserverCallback) {
            callback = cb;
          }
          observe = observe;
          disconnect = vi.fn();
        },
      );
      const { qa, fixture } = await setup({ total: 60, preload: true });
      await fixture.whenStable();
      expect(observe).toHaveBeenCalledTimes(1);
      expect(qa('.grid .card')).toHaveLength(48);
      callback(
        [{ isIntersecting: false } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
      fixture.detectChanges();
      expect(qa('.grid .card')).toHaveLength(48);
      callback([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
      fixture.detectChanges();
      expect(qa('.grid .card')).toHaveLength(60);
    });
  });

  describe('compare', () => {
    it('collects up to four entries in the tray and opens the overlay', async () => {
      const { q, qa, settle, store, fixture } = await setup();
      await settle();
      expect(q('.compare-tray')).toBeNull();
      qa('.card .compare-btn')[0]!.click();
      fixture.detectChanges();
      expect(q('.compare-tray')).not.toBeNull();
      expect(qa('.tray-mon')).toHaveLength(1);
      const open = q('.tray-actions .btn') as HTMLButtonElement;
      expect(open.disabled).toBe(true);
      expect(open.textContent!.trim()).toBe('Compare (1)');
      qa('.card .compare-btn')[1]!.click();
      fixture.detectChanges();
      expect(open.disabled).toBe(false);
      open.click();
      fixture.detectChanges();
      expect(q('pv-pokemon-compare')).not.toBeNull();
      expect(store.compareIds()).toEqual([1, 4]);
    });

    it('removes from the tray, closing the overlay when fewer than two remain', async () => {
      const { q, qa, settle, store, fixture } = await setup();
      await settle();
      qa('.card .compare-btn')[0]!.click();
      qa('.card .compare-btn')[1]!.click();
      fixture.detectChanges();
      (q('.tray-actions .btn') as HTMLButtonElement).click();
      fixture.detectChanges();
      qa('.tray-mon')[0]!.click();
      fixture.detectChanges();
      expect(store.compareIds()).toEqual([4]);
      expect(q('pv-pokemon-compare')).toBeNull();
    });

    it('clears the tray', async () => {
      const { q, qa, settle, fixture } = await setup();
      await settle();
      qa('.card .compare-btn')[0]!.click();
      fixture.detectChanges();
      q('.tray-actions .btn.ghost')!.click();
      fixture.detectChanges();
      expect(q('.compare-tray')).toBeNull();
    });

    it('closes the overlay from its close button', async () => {
      const { q, qa, settle, fixture } = await setup();
      await settle();
      qa('.card .compare-btn')[0]!.click();
      qa('.card .compare-btn')[1]!.click();
      fixture.detectChanges();
      (q('.tray-actions .btn') as HTMLButtonElement).click();
      fixture.detectChanges();
      q('pv-pokemon-compare .x')!.click();
      fixture.detectChanges();
      expect(q('pv-pokemon-compare')).toBeNull();
    });
  });

  describe('overlays', () => {
    it('opens the quick view from a card and closes it with Escape or scrolling', async () => {
      const { q, qa, settle, fixture } = await setup();
      await settle();
      qa('.card .info')[1]!.click();
      fixture.detectChanges();
      expect(q('pv-pokemon-quickview')).not.toBeNull();
      expect(q('pv-pokemon-quickview .qv-name')?.textContent).toBe('Charmander');
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      fixture.detectChanges();
      expect(q('pv-pokemon-quickview')).toBeNull();

      qa('.card .info')[0]!.click();
      fixture.detectChanges();
      expect(q('pv-pokemon-quickview')).not.toBeNull();
      window.dispatchEvent(new Event('scroll'));
      fixture.detectChanges();
      expect(q('pv-pokemon-quickview')).toBeNull();
    });

    it('closes the quick view from its own close button', async () => {
      const { q, qa, settle, fixture } = await setup();
      await settle();
      qa('.card .info')[0]!.click();
      fixture.detectChanges();
      q('pv-pokemon-quickview .x')!.click();
      fixture.detectChanges();
      expect(q('pv-pokemon-quickview')).toBeNull();
    });

    it("opens Who's That with the full pool and closes it with Escape", async () => {
      const { q, settle, fixture } = await setup();
      await settle();
      const btn = q('.game-btn') as HTMLButtonElement;
      expect(btn.disabled).toBe(false);
      btn.click();
      fixture.detectChanges();
      expect(q('.whos-stub')?.textContent).toBe('4');
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      fixture.detectChanges();
      expect(q('.whos-stub')).toBeNull();
    });

    it("disables Who's That when there are fewer than three Pokémon", async () => {
      const { q } = await setup({ pendingList: true });
      expect((q('.game-btn') as HTMLButtonElement).disabled).toBe(true);
    });
  });

  describe('scroll', () => {
    it('shows a back-to-top button after scrolling and scrolls up', async () => {
      const scrollTo = vi.fn();
      vi.stubGlobal('scrollTo', scrollTo);
      const { q, settle, fixture } = await setup();
      await settle();
      expect(q('.top-fab')).toBeNull();
      Object.defineProperty(window, 'scrollY', { value: 1200, configurable: true });
      window.dispatchEvent(new Event('scroll'));
      fixture.detectChanges();
      q('.top-fab')!.click();
      expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
      Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
      window.dispatchEvent(new Event('scroll'));
      fixture.detectChanges();
      expect(q('.top-fab')).toBeNull();
    });
  });

  describe('keyboard', () => {
    it('focuses the search box with "/" but not while typing', async () => {
      const { q, settle, key } = await setup();
      await settle();
      const input = q('.search input') as HTMLInputElement;
      expect(key('/').defaultPrevented).toBe(true);
      expect(document.activeElement).toBe(input);
      expect(key('/', {}, input).defaultPrevented).toBe(false);
    });

    it('toggles shiny with "s" unless a modifier is held or typing', async () => {
      const { settle, key, store, q } = await setup();
      await settle();
      key('s');
      expect(store.shiny()).toBe(true);
      key('s', { ctrlKey: true });
      expect(store.shiny()).toBe(true);
      key('s', {}, q('.search input')!);
      expect(store.shiny()).toBe(true);
      key('s');
      expect(store.shiny()).toBe(false);
    });

    it('moves focus between cards with the arrow keys and favourites with "f"', async () => {
      const { qa, settle, key, store } = await setup();
      await settle();
      const cards = () => qa('.grid .card');
      key('ArrowRight'); // nothing focused -> first
      expect(document.activeElement).toBe(cards()[0]);
      key('ArrowRight');
      expect(document.activeElement).toBe(cards()[1]);
      key('ArrowLeft');
      expect(document.activeElement).toBe(cards()[0]);
      key('ArrowLeft'); // clamped
      expect(document.activeElement).toBe(cards()[0]);
      key('ArrowDown'); // jsdom lays every card at top 0 -> one big row -> jumps to the end
      expect(document.activeElement).toBe(cards()[3]);
      key('ArrowUp');
      expect(document.activeElement).toBe(cards()[0]);
      key('f');
      expect(store.isFavorite(1)).toBe(true);
      expect(key('x').defaultPrevented).toBe(false);
    });

    it('ignores "f" without a focused card', async () => {
      const { settle, key, store } = await setup();
      await settle();
      key('f');
      expect(store.favCount()).toBe(0);
    });
  });

  describe('URL state', () => {
    it('restores filters, sort and view from the query string', async () => {
      const { q, names, settle, enriched, store, fixture } = await setup({
        query: {
          q: 'a',
          types: 'grass,poison',
          mode: 'and',
          gen: '1',
          sort: 'name',
          view: 'list',
          shiny: '1',
          fav: '1',
        },
      });
      await settle();
      await enriched();
      expect(store.query()).toBe('a');
      expect([...store.typeFilters()].sort()).toEqual(['grass', 'poison']);
      expect(store.typeMode()).toBe('and');
      expect(store.generationFilter()).toBe(1);
      expect(store.sort()).toBe('name');
      expect(store.view()).toBe('list');
      expect(store.shiny()).toBe(true);
      expect(store.favOnly()).toBe(true);
      expect(names()).toEqual([]); // no favourites -> empty
      expect(q('pv-state')).not.toBeNull();
      fixture.detectChanges();
    });

    it('writes the live state back to the URL (and omits defaults)', async () => {
      const { navigate, settle, store, fixture } = await setup();
      await settle();
      await fixture.whenStable();
      expect(navigate).toHaveBeenCalled();
      expect(navigate.mock.calls.at(-1)![1]).toMatchObject({
        replaceUrl: true,
        queryParams: {
          q: null,
          types: null,
          mode: null,
          gen: null,
          sort: null,
          view: null,
          shiny: null,
          fav: null,
        },
      });
      store.setQuery('pika');
      store.toggleType('electric');
      store.setTypeMode('and');
      store.setSort('name');
      store.setView('compact');
      store.setGeneration(1);
      fixture.detectChanges();
      await fixture.whenStable();
      expect(navigate.mock.calls.at(-1)![1]).toMatchObject({
        queryParams: {
          q: 'pika',
          types: 'electric',
          mode: 'and',
          gen: 1,
          sort: 'name',
          view: 'compact',
        },
      });
    });
  });
});
