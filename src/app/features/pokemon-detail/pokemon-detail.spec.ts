import { Location } from '@angular/common';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CryService } from '../../core/audio/cry.service';
import type {
  AbilityInfo,
  EvolutionNode,
  MoveInfo,
  Pokemon,
  SpeciesInfo,
} from '../../core/models/pokemon.model';
import { PokedexService } from '../pokedex/pokedex.service';
import { TeamBuilderService } from '../team-builder/team-builder.service';
import { PokemonDetailComponent } from './pokemon-detail';
import { PokemonDetailService } from './pokemon-detail.service';

const POKEMON: Pokemon = {
  id: 6,
  name: 'charizard',
  types: ['fire', 'flying'],
  heightM: 1.7,
  weightKg: 90.5,
  baseExperience: 267,
  stats: {
    hp: 78,
    attack: 84,
    defense: 78,
    'special-attack': 109,
    'special-defense': 85,
    speed: 100,
  },
  baseStatTotal: 534,
  abilities: [
    { name: 'blaze', isHidden: false },
    { name: 'solar-power', isHidden: true },
  ],
  moves: [
    { name: 'ember', levelLearnedAt: 7, method: 'level-up' },
    { name: 'flamethrower', levelLearnedAt: 34, method: 'level-up' },
    { name: 'fire-blast', levelLearnedAt: 0, method: 'machine' },
  ],
  sprites: {
    default: 'still.png',
    shiny: 'still-shiny.png',
    animatedFront: 'front.gif',
    animatedBack: 'back.gif',
  },
  cry: 'cry.ogg',
  speciesId: 6,
};

const SPECIES: SpeciesInfo = {
  id: 6,
  name: 'charizard',
  genus: 'Flame Pokémon',
  flavorText: 'It spits fire.',
  de: { name: 'Glurak', genus: 'Flammen-Pokémon', flavorText: 'Es speit Feuer.' },
  color: 'red',
  shape: 'upright',
  habitat: 'mountain',
  generation: 'generation-i',
  eggGroups: ['monster', 'dragon'],
  captureRate: 45,
  baseHappiness: 50,
  genderRate: 1,
  isBaby: false,
  isLegendary: false,
  isMythical: false,
  evolutionChainId: 2,
  varieties: [],
};

const EVO: EvolutionNode = {
  id: 4,
  name: 'charmander',
  artwork: 'a4.png',
  trigger: null,
  children: [
    {
      id: 5,
      name: 'charmeleon',
      artwork: 'a5.png',
      trigger: 'Lv. 16',
      children: [{ id: 6, name: 'charizard', artwork: 'a6.png', trigger: 'Lv. 36', children: [] }],
    },
  ],
};

const ABILITY: AbilityInfo = {
  id: 66,
  name: 'blaze',
  effect: 'Long',
  shortEffect: 'Powers up fire.',
};
const MOVE: MoveInfo = {
  id: 52,
  name: 'ember',
  type: 'fire',
  damageClass: 'special',
  power: 40,
  accuracy: 100,
  pp: 25,
  priority: 0,
  effect: 'May burn the target.',
  ailment: 'burn',
  ailmentChance: 10,
  critRate: 0,
  minHits: null,
  maxHits: null,
};

type State = { pokemon: Pokemon; species: SpeciesInfo; evolution: EvolutionNode };

function setup(initial: State | null = { pokemon: POKEMON, species: SPECIES, evolution: EVO }) {
  const state = signal<State | null>(null);
  const loading = signal(false);
  const error = signal<string | null>(null);
  const store = {
    state,
    loading,
    error,
    load: vi.fn(async () => {
      state.set(initial);
    }),
    ability: vi.fn(() => Promise.resolve(ABILITY)),
    move: vi.fn(() => Promise.resolve(MOVE)),
  };
  const favs = new Set<number>();
  const favTick = signal(0);
  const dex = {
    ensureLoaded: vi.fn(() => Promise.resolve()),
    isFavorite: (id: number) => (favTick(), favs.has(id)),
    toggleFavorite: vi.fn((id: number) => {
      if (favs.has(id)) favs.delete(id);
      else favs.add(id);
      favTick.update((n) => n + 1);
    }),
  };
  const teamFull = signal(false);
  const team = { full: teamFull, add: vi.fn(() => Promise.resolve()) };
  const cry = { play: vi.fn(), muted: signal(false), playing: signal<number | null>(null) };
  const location = { back: vi.fn() };

  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: PokemonDetailService, useValue: store },
      { provide: PokedexService, useValue: dex },
      { provide: TeamBuilderService, useValue: team },
      { provide: CryService, useValue: cry },
      { provide: Location, useValue: location },
    ],
  });
  const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  const fixture = TestBed.createComponent(PokemonDetailComponent);
  fixture.componentRef.setInput('id', 'Charizard');
  return {
    fixture,
    el: fixture.nativeElement as HTMLElement,
    store,
    dex,
    team,
    cry,
    location,
    navigate,
    teamFull,
    loading,
    error,
    state,
  };
}

async function render(ctx: ReturnType<typeof setup>) {
  ctx.fixture.detectChanges();
  await ctx.fixture.whenStable();
  ctx.fixture.detectChanges();
}

const q = (el: HTMLElement, sel: string) => el.querySelector<HTMLElement>(sel);
const qa = (el: HTMLElement, sel: string) => Array.from(el.querySelectorAll<HTMLElement>(sel));

describe('PokemonDetailComponent', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('loads the lower-cased id and renders the hero', async () => {
    const ctx = setup();
    await render(ctx);
    expect(ctx.store.load).toHaveBeenCalledWith('charizard');
    expect(q(ctx.el, 'h1')?.textContent).toBe('Charizard');
    expect(q(ctx.el, '.hero .num')?.textContent).toBe('#006');
    expect(q(ctx.el, '.genus')?.textContent!.trim()).toBe('Flame Pokémon');
    expect(q(ctx.el, '.flavor')?.textContent).toContain('It spits fire.');
    expect(qa(ctx.el, '.hero .types pv-type-badge')).toHaveLength(2);
    expect(ctx.dex.ensureLoaded).toHaveBeenCalled();
  });

  it('shows the loading and error states, and retries', async () => {
    const ctx = setup();
    ctx.loading.set(true);
    await render(ctx);
    expect(q(ctx.el, 'pv-state')).not.toBeNull();
    expect(q(ctx.el, 'h1')).toBeNull();

    ctx.loading.set(false);
    ctx.state.set(null);
    ctx.error.set('Could not load this Pokémon.');
    ctx.fixture.detectChanges();
    expect(q(ctx.el, '[role="alert"]')).not.toBeNull();
    expect(ctx.el.textContent).toContain('Could not load this Pokémon.');
    ctx.store.load.mockClear();
    q(ctx.el, 'pv-state button')!.click();
    expect(ctx.store.load).toHaveBeenCalledWith('charizard');
  });

  it('uses the animated front sprite and toggles back / still / shiny', async () => {
    const ctx = setup();
    await render(ctx);
    const img = () => q(ctx.el, 'img.sprite') as HTMLImageElement;
    expect(img().getAttribute('src')).toBe('front.gif');

    const segs = qa(ctx.el, '.sprite-controls .seg-btn');
    segs[1]!.click(); // Front/Back
    ctx.fixture.detectChanges();
    expect(img().getAttribute('src')).toBe('back.gif');
    segs[1]!.click();

    segs[0]!.click(); // Animated -> still
    ctx.fixture.detectChanges();
    expect(img().getAttribute('src')).toBe('still.png');

    q(ctx.el, '.icon-btn[aria-label="Shiny"]')!.click();
    ctx.fixture.detectChanges();
    expect(img().getAttribute('src')).toBe('still-shiny.png');
    expect(ctx.cry.play).toHaveBeenCalledWith(6);
    expect(q(ctx.el, '.sparkle-burst')).not.toBeNull();
  });

  it('drops back to the still image when the animated sprite errors', async () => {
    const ctx = setup();
    await render(ctx);
    const img = q(ctx.el, 'img.sprite') as HTMLImageElement;
    img.dispatchEvent(new Event('error'));
    ctx.fixture.detectChanges();
    expect(img.src).toContain('still.png');
    expect(q(ctx.el, '.sprite-controls .seg-btn')?.textContent!.trim()).toBe('Still image');
  });

  it('plays the cry and toggles the favourite', async () => {
    const ctx = setup();
    await render(ctx);
    q(ctx.el, '.icon-btn[aria-label="Play cry"]')!.click();
    expect(ctx.cry.play).toHaveBeenCalledWith(6);
    const fav = q(ctx.el, '.icon-btn.fav')!;
    expect(fav.getAttribute('aria-pressed')).toBe('false');
    fav.click();
    ctx.fixture.detectChanges();
    expect(ctx.dex.toggleFavorite).toHaveBeenCalledWith(6);
    expect(fav.getAttribute('aria-pressed')).toBe('true');
  });

  it('hides the cry button when the Pokémon has no cry', async () => {
    const ctx = setup({ pokemon: { ...POKEMON, cry: null }, species: SPECIES, evolution: EVO });
    await render(ctx);
    expect(q(ctx.el, '.icon-btn[aria-label="Play cry"]')).toBeNull();
  });

  it('adds to the team once, then disables the button; disabled when the team is full', async () => {
    const ctx = setup();
    await render(ctx);
    const btn = q(ctx.el, '.quick-actions .btn') as HTMLButtonElement;
    expect(btn.textContent!.trim()).toBe('Add to team');
    btn.click();
    await ctx.fixture.whenStable();
    ctx.fixture.detectChanges();
    expect(ctx.team.add).toHaveBeenCalledWith('charizard');
    expect(btn.textContent!.trim()).toBe('Added!');
    expect(btn.disabled).toBe(true);

    TestBed.resetTestingModule();
    const full = setup();
    full.teamFull.set(true);
    await render(full);
    const b2 = q(full.el, '.quick-actions .btn') as HTMLButtonElement;
    expect(b2.textContent!.trim()).toBe('Team full');
    expect(b2.disabled).toBe(true);
  });

  it('shows type matchups', async () => {
    const ctx = setup();
    await render(ctx);
    // fire/flying: rock is 4x
    expect(qa(ctx.el, '.mu.x4 pv-type-badge')).toHaveLength(1);
    expect(q(ctx.el, '.mu.x4')?.textContent).toMatch(/rock/i);
    expect(q(ctx.el, '.mu.immune')?.textContent).toMatch(/ground/i);
  });

  it('reveals bars and the BST meter after the load', async () => {
    const ctx = setup();
    await render(ctx);
    expect(qa(ctx.el, '.stat-row')).toHaveLength(6);
    expect(qa(ctx.el, '.stat-row.best')).toHaveLength(1); // special attack 109
    await vi.waitFor(
      () => {
        ctx.fixture.detectChanges();
        expect(q(ctx.el, '.bst-fill')?.style.width).toBe(`${(534 / 720) * 100}%`);
        expect(q(ctx.el, '.bst-meter strong')?.textContent).toBe('534');
      },
      { timeout: 3000 },
    );
  });

  it('shows the profile: gender, rates, generation, egg groups', async () => {
    const ctx = setup();
    await render(ctx);
    expect(q(ctx.el, '.g-label.male')?.textContent).toContain('87');
    expect(q(ctx.el, '.g-label.female')?.textContent).toContain('13');
    expect(qa(ctx.el, '.rate-row strong').map((s) => s.textContent)).toEqual(['45', '50']);
    const profile = q(ctx.el, 'ul.profile')!.textContent!;
    expect(profile).toContain('Generation I');
    expect(profile).toMatch(/Monster\s+Dragon/);
    expect(profile).toContain('Mountain');
    expect(q(ctx.el, '.flag')).toBeNull();
  });

  it('handles genderless, flagged species', async () => {
    const ctx = setup({
      pokemon: POKEMON,
      species: {
        ...SPECIES,
        genderRate: -1,
        habitat: null,
        eggGroups: [],
        isLegendary: true,
        isMythical: true,
        isBaby: true,
        baseHappiness: null,
      },
      evolution: { ...EVO, children: [] },
    });
    await render(ctx);
    expect(q(ctx.el, '.gender')).toBeNull();
    expect(ctx.el.textContent).toContain('Genderless');
    expect(qa(ctx.el, '.flag')).toHaveLength(3);
    expect(ctx.el.textContent).toContain('This Pokémon does not evolve.');
    expect(q(ctx.el, 'pv-evolution-tree')).toBeNull();
    expect(qa(ctx.el, '.rate-row strong')[1]?.textContent).toBe('—');
  });

  it('renders the evolution tree for evolving species', async () => {
    const ctx = setup();
    await render(ctx);
    expect(q(ctx.el, 'pv-evolution-tree')).not.toBeNull();
    expect(qa(ctx.el, 'pv-evolution-tree a.node.current')).toHaveLength(1);
  });

  it('expands an ability lazily and caches the result', async () => {
    const ctx = setup();
    await render(ctx);
    const btn = qa(ctx.el, '.ability')[0]!;
    btn.click();
    ctx.fixture.detectChanges();
    expect(q(ctx.el, '.ability-effect')?.textContent).toContain('Loading');
    await vi.waitFor(() => {
      ctx.fixture.detectChanges();
      expect(q(ctx.el, '.ability-effect')?.textContent).toContain('Powers up fire.');
    });
    btn.click(); // collapse
    ctx.fixture.detectChanges();
    expect(q(ctx.el, '.ability-effect')).toBeNull();
    btn.click(); // expand again -> cached
    ctx.fixture.detectChanges();
    expect(ctx.store.ability).toHaveBeenCalledTimes(1);
    expect(qa(ctx.el, '.ability')[1]!.textContent).toContain('Hidden');
  });

  it('lists moves per tab and expands a move with its detail', async () => {
    const ctx = setup();
    await render(ctx);
    expect(qa(ctx.el, '.move .mname').map((m) => m.textContent)).toEqual(['Ember', 'Flamethrower']);
    expect(qa(ctx.el, '.move .lvl')[0]?.textContent).toBe('Lv 7');

    qa(ctx.el, '.move')[0]!.click();
    ctx.fixture.detectChanges();
    await vi.waitFor(() => {
      ctx.fixture.detectChanges();
      expect(q(ctx.el, '.md-effect')?.textContent).toBe('May burn the target.');
    });
    expect(q(ctx.el, '.md-head')?.textContent).toContain('PWR 40');
    expect(q(ctx.el, '.md-class')?.textContent).toBe('special');
    expect(ctx.store.move).toHaveBeenCalledWith('ember');

    qa(ctx.el, '.tab')[1]!.click(); // TM/HM
    ctx.fixture.detectChanges();
    expect(qa(ctx.el, '.move .mname').map((m) => m.textContent)).toEqual(['Fire Blast']);
    expect(q(ctx.el, '.move .lvl')).toBeNull();

    qa(ctx.el, '.tab')[2]!.click(); // Egg: nothing
    ctx.fixture.detectChanges();
    expect(ctx.el.textContent).toContain('No moves in this category.');
  });

  it('shows German genus and flavour in the German UI', async () => {
    const { I18nService } = await import('../../core/i18n/i18n.service');
    const ctx = setup();
    TestBed.inject(I18nService).locale.set('de');
    await render(ctx);
    expect(q(ctx.el, '.genus')?.textContent!.trim()).toBe('Flammen-Pokémon');
    expect(q(ctx.el, '.flavor')?.textContent).toContain('Es speit Feuer.');
  });

  it('navigates with the prev/next buttons, wrapping around the dex', async () => {
    const ctx = setup();
    await render(ctx);
    const [prev, next] = qa(ctx.el, '.dexnav .nav-btn');
    prev!.click();
    next!.click();
    expect(ctx.navigate).toHaveBeenNthCalledWith(1, ['/pokemon', 5]);
    expect(ctx.navigate).toHaveBeenNthCalledWith(2, ['/pokemon', 7]);

    TestBed.resetTestingModule();
    const first = setup({ pokemon: { ...POKEMON, id: 1 }, species: SPECIES, evolution: EVO });
    await render(first);
    qa(first.el, '.dexnav .nav-btn')[0]!.click();
    expect(first.navigate).toHaveBeenCalledWith(['/pokemon', 1025]);

    TestBed.resetTestingModule();
    const last = setup({ pokemon: { ...POKEMON, id: 1025 }, species: SPECIES, evolution: EVO });
    await render(last);
    qa(last.el, '.dexnav .nav-btn')[1]!.click();
    expect(last.navigate).toHaveBeenCalledWith(['/pokemon', 1]);
  });

  it('goes back through the Location', async () => {
    const ctx = setup();
    await render(ctx);
    q(ctx.el, '.topnav .nav-btn')!.click();
    expect(ctx.location.back).toHaveBeenCalled();
  });

  it('supports keyboard navigation but ignores typing in inputs', async () => {
    const ctx = setup();
    await render(ctx);
    const key = (k: string, target: EventTarget = document.body) =>
      target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
    key('ArrowLeft');
    key('ArrowRight');
    expect(ctx.navigate).toHaveBeenNthCalledWith(1, ['/pokemon', 5]);
    expect(ctx.navigate).toHaveBeenNthCalledWith(2, ['/pokemon', 7]);
    key('s');
    ctx.fixture.detectChanges();
    expect(ctx.cry.play).toHaveBeenCalledWith(6);

    const input = document.createElement('input');
    document.body.appendChild(input);
    key('ArrowLeft', input);
    input.remove();
    expect(ctx.navigate).toHaveBeenCalledTimes(2);
  });

  it('navigates on horizontal swipes', async () => {
    const ctx = setup();
    await render(ctx);
    const host = ctx.el;
    const swipe = (dx: number) => {
      host.dispatchEvent(
        new MouseEvent('pointerdown', { clientX: 200, clientY: 100, bubbles: true }),
      );
      host.dispatchEvent(
        new MouseEvent('pointerup', { clientX: 200 + dx, clientY: 100, bubbles: true }),
      );
    };
    swipe(-100); // left -> next
    swipe(100); // right -> prev
    expect(ctx.navigate).toHaveBeenNthCalledWith(1, ['/pokemon', 7]);
    expect(ctx.navigate).toHaveBeenNthCalledWith(2, ['/pokemon', 5]);
  });
});
