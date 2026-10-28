import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { CryService } from '../../core/audio/cry.service';
import { I18nService } from '../../core/i18n/i18n.service';
import type { PokedexEntry } from '../../core/models/pokemon.model';
import { PokedexDetailService, type EvoStage, type QuickDetail } from './pokedex-detail.service';
import { PokemonQuickviewComponent } from './pokemon-quickview';

const ENTRY: PokedexEntry = {
  id: 5,
  name: 'charmeleon',
  artwork: 'entry-art.png',
  types: ['fire'],
  gen: 1,
};

const DETAIL: QuickDetail = {
  id: 5,
  name: 'charmeleon',
  types: ['fire'],
  heightM: 1.1,
  weightKg: 19,
  baseExperience: 142,
  stats: {
    hp: 58,
    attack: 64,
    defense: 58,
    'special-attack': 80,
    'special-defense': 65,
    speed: 80,
  },
  baseStatTotal: 405,
  abilities: [
    { name: 'blaze', isHidden: false },
    { name: 'solar-power', isHidden: true },
  ],
  moves: [],
  sprites: { default: 'detail.png', shiny: '', animatedFront: null, animatedBack: null },
  cry: null,
  speciesId: 5,
  genus: 'Flame Pokémon',
  flavor: 'It lashes about with its tail.',
  genusDe: 'Flammen-Pokémon',
  flavorDe: 'Es schlägt mit dem Schwanz.',
};

const CHAIN: EvoStage[][] = [
  [{ id: 4, name: 'charmander', trigger: null }],
  [{ id: 5, name: 'charmeleon', trigger: 'Lv. 16' }],
  [{ id: 6, name: 'charizard', trigger: 'Lv. 36' }],
];

interface Opts {
  detail?: Promise<QuickDetail>;
  chain?: Promise<EvoStage[][]>;
  german?: boolean;
}

async function setup(opts: Opts = {}, inputs: Record<string, unknown> = {}) {
  const detailSvc = {
    load: vi.fn(() => opts.detail ?? Promise.resolve(DETAIL)),
    loadChain: vi.fn(() => opts.chain ?? Promise.resolve(CHAIN)),
  };
  const cry = { play: vi.fn(), muted: signal(false), playing: signal<number | null>(null) };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: PokedexDetailService, useValue: detailSvc },
      { provide: CryService, useValue: cry },
    ],
  });
  if (opts.german) TestBed.inject(I18nService).locale.set('de');
  const fixture = TestBed.createComponent(PokemonQuickviewComponent);
  fixture.componentRef.setInput('entry', ENTRY);
  fixture.componentRef.setInput('rect', {
    top: 100,
    left: 100,
    right: 200,
    bottom: 200,
    width: 100,
    height: 100,
  } as DOMRect);
  for (const [k, v] of Object.entries(inputs)) fixture.componentRef.setInput(k, v);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement, detailSvc, cry };
}

describe('PokemonQuickviewComponent', () => {
  it('shows a skeleton until the detail resolves, then the profile', async () => {
    let resolve!: (d: QuickDetail) => void;
    const detail = new Promise<QuickDetail>((r) => (resolve = r));
    const { fixture, el } = await setup({ detail });
    expect(el.querySelector('.qv-skel')).not.toBeNull();
    expect(el.querySelector('.flavor')).toBeNull();
    expect(el.querySelector<HTMLButtonElement>('.chip[title="Stat radar"]')?.disabled).toBe(true);
    resolve(DETAIL);
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(el.querySelector('.flavor')).not.toBeNull();
    });
    expect(el.querySelector('.qv-skel')).toBeNull();
    expect(el.querySelector('.flavor')?.textContent).toBe(DETAIL.flavor);
    expect(el.querySelector('.genus')?.textContent).toBe('Flame Pokémon');
    expect(el.querySelectorAll('.stats .stat')).toHaveLength(6);
    expect(el.querySelector('.bst strong')?.textContent).toBe('405');
    expect(el.querySelector('.abilities')?.textContent).toBe('Blaze, Solar Power (H)');
  });

  it('renders header info from the entry and an anchored panel', async () => {
    const { el } = await setup();
    expect(el.querySelector('.num')?.textContent).toBe('#005');
    expect(el.querySelector('.qv-name')?.textContent).toBe('Charmeleon');
    expect(el.querySelectorAll('.qv-types pv-type-badge')).toHaveLength(1);
    const panel = el.querySelector<HTMLElement>('.panel')!;
    expect(panel.getAttribute('role')).toBe('dialog');
    expect(panel.style.top).toBe('100px');
    expect(panel.style.left).toBe('212px'); // right + 12
    expect(el.querySelector('.qv-art img')?.getAttribute('src')).toBe('detail.png');
  });

  it('uses the shiny artwork when shiny', async () => {
    const { el } = await setup({}, { shiny: true });
    expect(el.querySelector('.qv-art img')?.getAttribute('src')).toContain(
      'official-artwork/shiny/5.png',
    );
  });

  it('shows the German genus and flavour text in the German UI', async () => {
    const { el } = await setup({ german: true });
    expect(el.querySelector('.genus')?.textContent).toBe('Flammen-Pokémon');
    expect(el.querySelector('.flavor')?.textContent).toBe('Es schlägt mit dem Schwanz.');
  });

  it('shows an error when the detail fails', async () => {
    const { el } = await setup({ detail: Promise.reject(new Error('x')) });
    expect(el.querySelector('.qv-err')).not.toBeNull();
    expect(el.querySelector('.stats')).toBeNull();
  });

  it('renders the evolution line, highlighting the current stage', async () => {
    const { el } = await setup();
    const mons = Array.from(el.querySelectorAll<HTMLElement>('.evo-mon'));
    expect(mons).toHaveLength(3);
    expect(mons.map((m) => m.classList.contains('cur'))).toEqual([false, true, false]);
    expect(mons[1]!.getAttribute('title')).toBe('Charmeleon · Lv. 16');
    expect(mons[2]!.getAttribute('href')).toBe('/pokemon/6');
    expect(el.querySelectorAll('.evo-arrow')).toHaveLength(2);
  });

  it('hides single-stage evolution lines and tolerates chain failures', async () => {
    const single = await setup({ chain: Promise.resolve([[CHAIN[0]![0]!]]) });
    expect(single.el.querySelector('.evo')).toBeNull();
    TestBed.resetTestingModule();
    const failing = await setup({ chain: Promise.reject(new Error('x')) });
    expect(failing.el.querySelector('.evo')).toBeNull();
    expect(failing.el.querySelector('.flavor')).not.toBeNull();
  });

  it('flips to the stat radar and back', async () => {
    const { fixture, el } = await setup();
    const flip = el.querySelector('.flip')!;
    expect(flip.classList.contains('flipped')).toBe(false);
    el.querySelector<HTMLButtonElement>('.chip[title="Stat radar"]')!.click();
    fixture.detectChanges();
    expect(flip.classList.contains('flipped')).toBe(true);
    expect(el.querySelector('.face.back')?.getAttribute('aria-hidden')).toBe('false');
    expect(el.querySelectorAll('svg.radar circle.pt')).toHaveLength(6);
    expect(el.querySelector('svg.radar polygon.shape')?.getAttribute('points')).toBeTruthy();
    expect(el.querySelector('.rd-bst strong')?.textContent).toBe('405');
    el.querySelector<HTMLButtonElement>('.rd-back')!.click();
    fixture.detectChanges();
    expect(flip.classList.contains('flipped')).toBe(false);
  });

  it('plays the cry for the entry', async () => {
    const { el, cry } = await setup();
    el.querySelector<HTMLButtonElement>('.qv-actions .chip')!.click();
    expect(cry.play).toHaveBeenCalledWith(5);
  });

  it('links to the full page and the fusion lab', async () => {
    const { el } = await setup();
    expect(el.querySelector('a.chip.primary')?.getAttribute('href')).toBe('/pokemon/5');
    expect(el.querySelector('a.chip[title="Splice in the Fusion Lab"]')?.getAttribute('href')).toBe(
      '/fusion?head=5',
    );
  });

  it('emits close from the X button and backdrop', async () => {
    const { fixture, el } = await setup();
    let closed = 0;
    fixture.componentInstance.close.subscribe(() => closed++);
    el.querySelector<HTMLButtonElement>('.x')!.click();
    el.querySelector<HTMLElement>('.backdrop')!.click();
    expect(closed).toBe(2);
  });

  it('applies and resets the pointer tilt', async () => {
    const { fixture, el } = await setup();
    const panel = el.querySelector<HTMLElement>('.panel')!;
    panel.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 100, height: 100, right: 100, bottom: 100 }) as DOMRect;
    panel.dispatchEvent(new PointerEvent('pointermove', { clientX: 100, clientY: 0 }));
    fixture.detectChanges();
    expect(panel.style.transform).toContain('rotateX(2.5deg) rotateY(2.5deg)');
    panel.dispatchEvent(new Event('pointerleave'));
    fixture.detectChanges();
    expect(panel.style.transform).toContain('rotateX(0deg) rotateY(0deg)');
  });

  it('falls back to the CDN artwork when the image errors', async () => {
    const { fixture, el } = await setup();
    const img = el.querySelector<HTMLImageElement>('.qv-art img')!;
    img.dispatchEvent(new Event('error'));
    fixture.detectChanges();
    expect(img.src).toContain('/other/official-artwork/5.png');
    expect(el.querySelector('.skel')).toBeNull();
  });

  it('colours stat bars by value band', async () => {
    const { el } = await setup();
    const fills = Array.from(el.querySelectorAll<HTMLElement>('.s-fill'));
    // hp 58 -> orange-yellow band, special-attack 80 -> yellow-green band
    expect(fills[0]!.style.background).toContain('rgb(255, 157, 85)');
    expect(fills[3]!.style.background).toContain('rgb(255, 209, 102), rgb(155, 227, 107)');
    expect(fills[0]!.style.width).toBe(`${(58 / 180) * 100}%`);
  });
});
