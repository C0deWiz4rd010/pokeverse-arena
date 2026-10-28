import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PokeApiClient } from '../../core/api/pokeapi.client';
import { CacheService } from '../../core/cache/cache.service';
import type { PokemonDto } from '../../core/dto/pokeapi.dto';
import { PokedexService } from '../pokedex/pokedex.service';
import { TeamBuilderComponent } from './team-builder';
import { TeamBuilderService } from './team-builder.service';

const res = (name: string) => ({ name, url: '' });

interface Mon {
  id: number;
  name: string;
  types: string[];
  speed: number;
}
const MONS: Mon[] = [
  { id: 6, name: 'charizard', types: ['fire', 'flying'], speed: 100 },
  { id: 25, name: 'pikachu', types: ['electric'], speed: 90 },
  { id: 143, name: 'snorlax', types: ['normal'], speed: 30 },
  { id: 9, name: 'blastoise', types: ['water'], speed: 78 },
];

function dto(m: Mon): PokemonDto {
  const stats = {
    hp: 80,
    attack: 80,
    defense: 80,
    'special-attack': 80,
    'special-defense': 80,
    speed: m.speed,
  };
  return {
    id: m.id,
    name: m.name,
    height: 1,
    weight: 1,
    base_experience: 1,
    order: m.id,
    is_default: true,
    sprites: { front_default: null, front_shiny: null, back_default: null, back_shiny: null },
    types: m.types.map((t, i) => ({ slot: i + 1, type: res(t) })),
    abilities: [
      { slot: 1, is_hidden: false, ability: res('ability-one') },
      { slot: 2, is_hidden: false, ability: res('ability-two') },
    ],
    stats: Object.entries(stats).map(([k, v]) => ({ base_stat: v, effort: 0, stat: res(k) })),
    moves: ['tackle', 'growl', 'scratch', 'ember', 'flamethrower'].map((n) => ({
      move: res(n),
      version_group_details: [
        { level_learned_at: 1, move_learn_method: res('level-up'), version_group: res('x') },
      ],
    })),
    species: res(m.name),
  };
}

function setup() {
  const api = {
    pokemon: vi.fn((k: string | number) => {
      const m = MONS.find((x) => x.id === Number(k) || x.name === k);
      return m ? Promise.resolve(dto(m)) : Promise.reject(new Error('404'));
    }),
    get: vi.fn(() => Promise.resolve({ pokemon: [], pokemon_species: [] })),
  };
  const dex = {
    ensureLoaded: vi.fn(() => Promise.resolve()),
    names: vi.fn(() => MONS.map((m) => m.name)),
  };
  const cache = {
    loadState: vi.fn(() => Promise.resolve(undefined)),
    saveState: vi.fn(() => Promise.resolve(true)),
  };
  TestBed.configureTestingModule({
    providers: [
      { provide: PokeApiClient, useValue: api },
      { provide: PokedexService, useValue: dex },
      { provide: CacheService, useValue: cache },
    ],
  });
  const fixture = TestBed.createComponent(TeamBuilderComponent);
  const store = TestBed.inject(TeamBuilderService);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const q = (sel: string) => el.querySelector<HTMLElement>(sel);
  const qa = (sel: string) => Array.from(el.querySelectorAll<HTMLElement>(sel));
  const flush = async () => {
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const type = (input: HTMLInputElement | HTMLTextAreaElement, value: string) => {
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
  };
  const add = async (value: string) => {
    type(q('form.add input')! as HTMLInputElement, value);
    q('form.add')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await vi.waitFor(() => expect(store.adding()).toBe(false));
    await flush();
  };
  const button = (label: string) =>
    qa('button, label.btn').find((b) => b.textContent!.trim().includes(label))!;
  return { fixture, el, store, api, dex, cache, q, qa, flush, type, add, button };
}

describe('TeamBuilderComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());
  afterEach(() => vi.restoreAllMocks());

  it('starts empty with the pokédex names as suggestions', () => {
    const { q, qa, dex } = setup();
    expect(dex.ensureLoaded).toHaveBeenCalled();
    expect(q('pv-state')).not.toBeNull();
    expect(q('.count')?.textContent).toBe('0 / 6');
    expect(qa('#dex-names option').map((o) => o.getAttribute('value'))).toEqual(
      MONS.map((m) => m.name),
    );
    expect(q('.roster')).toBeNull();
    expect(q('.toolbar')).toBeNull();
  });

  it('adds a Pokémon via the form and clears the field on success', async () => {
    const { q, qa, add } = setup();
    await add('Charizard');
    expect(qa('.member')).toHaveLength(1);
    expect(q('.species')?.textContent).toBe('Charizard · #6');
    expect(q('.count')?.textContent).toBe('1 / 6');
    expect((q('form.add input') as HTMLInputElement).value).toBe('');
    expect(q('pv-state')).toBeNull();
    expect(qa('.m-types pv-type-badge')).toHaveLength(2);
  });

  it('keeps the text and shows an error when the Pokémon is unknown', async () => {
    const { q, add } = setup();
    await add('missingno');
    expect(q('.err')?.textContent).toContain('missingno');
    expect((q('form.add input') as HTMLInputElement).value).toBe('missingno');
    expect(q('.roster')).toBeNull();
  });

  it('ignores a blank submit', async () => {
    const { q, api, type, fixture } = setup();
    type(q('form.add input') as HTMLInputElement, '   ');
    q('form.add')!.dispatchEvent(new Event('submit', { cancelable: true }));
    fixture.detectChanges();
    expect(api.pokemon).not.toHaveBeenCalled();
  });

  it('disables input at six members', async () => {
    const { q, store, add, flush } = setup();
    await add('pikachu');
    for (let i = 0; i < 5; i++) await store.add('pikachu');
    await flush();
    expect(store.full()).toBe(true);
    expect((q('form.add input') as HTMLInputElement).disabled).toBe(true);
    expect((q('form.add button') as HTMLButtonElement).disabled).toBe(true);
    expect(q('.count')?.classList.contains('full')).toBe(true);
  });

  it('edits nickname, level, nature and ability through the store', async () => {
    const { q, el, store, add, type, fixture } = setup();
    await add('pikachu');
    type(q('input.nick') as HTMLInputElement, 'Sparky');
    type(q('input[type=range]') as HTMLInputElement, '75');
    const selects = Array.from(
      document.createElement('div').querySelectorAll('select'),
    ) as HTMLSelectElement[];
    expect(selects).toHaveLength(0);
    const nature = el.querySelectorAll('.m-config select')[0] as HTMLSelectElement;
    nature.value = 'Adamant';
    nature.dispatchEvent(new Event('change', { bubbles: true }));
    const ability = el.querySelectorAll('.m-config select')[1] as HTMLSelectElement;
    ability.value = 'ability-two';
    ability.dispatchEvent(new Event('change', { bubbles: true }));
    fixture.detectChanges();
    expect(store.team()[0]).toMatchObject({
      nickname: 'Sparky',
      level: 75,
      natureName: 'Adamant',
      ability: 'ability-two',
    });
    expect(q('.field strong')?.textContent).toBe('75');
    expect(q('.tier-list .t-name')?.textContent).toBe('Sparky');
    // Adamant: +Atk -SpA arrows
    expect(q('.stat-row.up .nat.up')).not.toBeNull();
    expect(q('.stat-row.down .nat.down')).not.toBeNull();
  });

  it('toggles moves and limits to four', async () => {
    const { q, qa, store, add, fixture } = setup();
    await add('pikachu');
    expect(store.team()[0]!.moves).toHaveLength(4);
    expect(q('.m-count')?.textContent).toBe('4/4');
    const flame = qa('.move-grid .mv').find(
      (b) => b.textContent!.trim() === 'Flamethrower',
    )! as HTMLButtonElement;
    expect(flame.disabled).toBe(true);
    const tackle = qa('.move-grid .mv').find((b) => b.textContent!.trim() === 'Tackle')!;
    expect(tackle.classList.contains('on')).toBe(true);
    tackle.click();
    fixture.detectChanges();
    expect(store.team()[0]!.moves).not.toContain('tackle');
    expect(q('.m-count')?.textContent).toBe('3/4');
    expect(flame.disabled).toBe(false);
  });

  it('removes a member and returns to the empty state', async () => {
    const { q, add, fixture } = setup();
    await add('pikachu');
    q('.remove')!.click();
    fixture.detectChanges();
    expect(q('pv-state')).not.toBeNull();
    expect(q('.member')).toBeNull();
  });

  it('shows team averages, speed tier and analysis', async () => {
    const { q, qa, add } = setup();
    await add('charizard');
    await add('snorlax');
    expect(qa('.avg-row')).toHaveLength(6);
    const tier = qa('.tier-list li .t-name').map((n) => n.textContent);
    expect(tier).toEqual(['Charizard', 'Snorlax']); // faster first
    // fire/flying + normal -> rock weakness shared by charizard (4x), fighting by snorlax
    const weak = qa('.weak-list li .wt').map((w) => w.textContent!.trim().toLowerCase());
    expect(weak).toContain('rock');
    expect(weak).toContain('fighting');
    expect(q('.rating')?.getAttribute('data-grade')).toMatch(/^[SABCDF]/);
    expect(q('.rating-verdict')?.textContent!.length).toBeGreaterThan(0);
    expect(q('.coverage .cov.covered')).not.toBeNull();
  });

  it('counts the rating score up to its target', async () => {
    // jsdom's rAF timestamps are not on the performance.now() timebase; drive frames ourselves.
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) =>
      setTimeout(() => cb(performance.now() + 1000), 0),
    );
    const { q, store, add, fixture } = setup();
    await add('charizard');
    const target = store.rating().score;
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(q('.g-score')?.textContent).toBe(String(target));
    });
    expect(target).toBeGreaterThan(0);
    vi.unstubAllGlobals();
  });

  describe('discovery', () => {
    it('sets type and generation filters and rolls random Pokémon', async () => {
      const { q, el, store, button, flush } = setup();
      const [typeSel, genSel] = Array.from(
        el.querySelectorAll('.filters select'),
      ) as HTMLSelectElement[];
      typeSel!.value = 'fire';
      typeSel!.dispatchEvent(new Event('change', { bubbles: true }));
      genSel!.value = '3';
      genSel!.dispatchEvent(new Event('change', { bubbles: true }));
      expect(store.filterType()).toBe('fire');
      expect(store.filterGen()).toBe(3);
      typeSel!.value = '';
      typeSel!.dispatchEvent(new Event('change', { bubbles: true }));
      genSel!.value = '';
      genSel!.dispatchEvent(new Event('change', { bubbles: true }));
      expect(store.filterType()).toBeNull();
      expect(store.filterGen()).toBeNull();

      button('Random').click();
      await vi.waitFor(() => expect(store.team()).toHaveLength(1));
      await flush();
      button('Fill team').click();
      await vi.waitFor(() => expect(store.team()).toHaveLength(MONS.length));
      await flush();
      expect(q('.roster')).not.toBeNull();
      expect(new Set(store.team().map((m) => m.name)).size).toBe(MONS.length);
    });
  });

  describe('import / export', () => {
    it('exports the team as a JSON download', async () => {
      const { add, button } = setup();
      await add('pikachu');
      const create = vi.fn(() => 'blob:fake');
      const revoke = vi.fn();
      vi.stubGlobal(
        'URL',
        Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke }),
      );
      let download = '';
      vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
        this: HTMLAnchorElement,
      ) {
        download = this.download;
      });
      button('Export JSON').click();
      expect(download).toBe('pokeverse-team.json');
      expect(create).toHaveBeenCalledTimes(1);
      const blob = (create.mock.calls[0] as unknown as [Blob])[0];
      expect(blob.type).toBe('application/json');
      expect(JSON.parse(await blob.text()).team[0].id).toBe(25);
      expect(revoke).toHaveBeenCalledWith('blob:fake');
      vi.unstubAllGlobals();
    });

    it('copies to the clipboard and shows a confirmation', async () => {
      const { add, button, q, fixture, store } = setup();
      await add('pikachu');
      const writeText = vi.fn(() => Promise.resolve());
      vi.stubGlobal(
        'navigator',
        Object.assign(Object.create(navigator), { clipboard: { writeText } }),
      );
      button('Copy').click();
      await vi.waitFor(() => {
        fixture.detectChanges();
        expect(button('Copied')).toBeDefined();
      });
      expect(writeText).toHaveBeenCalledWith(store.exportJson());
      expect(q('.toolbar')?.textContent).toContain('Copied');
      vi.unstubAllGlobals();
    });

    it('swallows a blocked clipboard', async () => {
      const { add, button, q } = setup();
      await add('pikachu');
      vi.stubGlobal(
        'navigator',
        Object.assign(Object.create(navigator), {
          clipboard: { writeText: () => Promise.reject(new Error('denied')) },
        }),
      );
      button('Copy').click();
      await Promise.resolve();
      await Promise.resolve();
      expect(q('.toolbar')?.textContent).not.toContain('Copied');
      vi.unstubAllGlobals();
    });

    it('imports pasted JSON and closes the panel on success', async () => {
      const { add, button, q, qa, fixture, type, store } = setup();
      await add('pikachu');
      expect(q('.import')).toBeNull();
      button('Paste JSON').click();
      fixture.detectChanges();
      expect(q('.import')).not.toBeNull();
      type(
        q('.import textarea') as HTMLTextAreaElement,
        JSON.stringify({
          team: [
            { id: 6, nickname: 'Zard', level: 30 },
            { id: 143, level: 12 },
          ],
        }),
      );
      button('Load team').click();
      await vi.waitFor(() => expect(store.team()).toHaveLength(2));
      await fixture.whenStable();
      fixture.detectChanges();
      expect(qa('.member')).toHaveLength(2);
      expect((q('input.nick') as HTMLInputElement).value).toBe('Zard');
      expect(q('.import')).toBeNull();
    });

    it('keeps the panel open and shows an error for invalid JSON', async () => {
      const { add, button, q, fixture, type } = setup();
      await add('pikachu');
      button('Paste JSON').click();
      fixture.detectChanges();
      type(q('.import textarea') as HTMLTextAreaElement, 'not json');
      button('Load team').click();
      await vi.waitFor(() => {
        fixture.detectChanges();
        expect(q('.err')).not.toBeNull();
      });
      expect(q('.err')?.textContent).toContain('valid team JSON');
      expect(q('.import')).not.toBeNull();
      expect((q('.import textarea') as HTMLTextAreaElement).value).toBe('not json');
    });

    it('imports a chosen file', async () => {
      const { add, q, store, fixture } = setup();
      await add('pikachu');
      const input = q('input[type=file]') as HTMLInputElement;
      const file = new File([JSON.stringify({ team: [{ id: 9, level: 20 }] })], 'team.json', {
        type: 'application/json',
      });
      Object.defineProperty(input, 'files', { value: [file], configurable: true });
      input.dispatchEvent(new Event('change', { bubbles: true }));
      await vi.waitFor(() => expect(store.team().map((m) => m.name)).toEqual(['blastoise']));
      fixture.detectChanges();
      // no file chosen: ignored
      Object.defineProperty(input, 'files', { value: [], configurable: true });
      input.dispatchEvent(new Event('change', { bubbles: true }));
      expect(store.team()).toHaveLength(1);
    });

    it('clears the whole team', async () => {
      const { add, button, q, fixture } = setup();
      await add('pikachu');
      button('Clear').click();
      fixture.detectChanges();
      expect(q('pv-state')).not.toBeNull();
    });
  });
});
