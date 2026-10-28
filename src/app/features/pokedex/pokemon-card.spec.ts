import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import type { PokedexEntry } from '../../core/models/pokemon.model';
import { PokemonCardComponent, type QuickviewRequest } from './pokemon-card';

const ENTRY: PokedexEntry = {
  id: 6,
  name: 'charizard',
  artwork: 'https://example.test/6.png',
  types: ['fire', 'flying'],
  gen: 1,
};

async function setup(inputs: Record<string, unknown> = {}, entry: PokedexEntry = ENTRY) {
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  const fixture = TestBed.createComponent(PokemonCardComponent);
  fixture.componentRef.setInput('entry', entry);
  for (const [k, v] of Object.entries(inputs)) fixture.componentRef.setInput(k, v);
  fixture.detectChanges();
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  return { fixture, el, card: el.querySelector<HTMLElement>('.card')! };
}

describe('PokemonCardComponent', () => {
  it('renders id, name, types and links to the detail page', async () => {
    const { el, card } = await setup();
    expect(el.querySelector('.num')?.textContent).toBe('#006');
    expect(el.querySelector('.name')?.textContent).toBe('Charizard');
    expect(el.querySelectorAll('pv-type-badge')).toHaveLength(2);
    expect(card.getAttribute('data-id')).toBe('6');
    expect(card.getAttribute('href')).toBe('/pokemon/6');
    expect(el.querySelector<HTMLImageElement>('img.still')?.getAttribute('src')).toBe(
      ENTRY.artwork,
    );
  });

  it('omits the type row for un-enriched entries', async () => {
    const { el } = await setup({}, { ...ENTRY, types: [], gen: 0 });
    expect(el.querySelector('.types')).toBeNull();
  });

  it('switches to the shiny artwork and layout classes', async () => {
    const { el, card } = await setup({ shiny: true, layout: 'list', favorite: true });
    expect(el.querySelector('img.still')?.getAttribute('src')).toContain(
      'official-artwork/shiny/6.png',
    );
    expect(card.classList.contains('shiny')).toBe(true);
    expect(card.classList.contains('list')).toBe(true);
    expect(card.classList.contains('fav')).toBe(true);
    expect(el.querySelector('.fav-btn')?.getAttribute('aria-pressed')).toBe('true');
  });

  it('shows the caught badge only when caught', async () => {
    expect((await setup({ caught: false })).el.querySelector('.dot.caught')).toBeNull();
    TestBed.resetTestingModule();
    expect((await setup({ caught: true })).el.querySelector('.dot.caught')).not.toBeNull();
  });

  it('emits favourite, compare and quickview without navigating', async () => {
    const { fixture, el } = await setup();
    const cmp = fixture.componentInstance;
    const favs: number[] = [];
    const cmps: number[] = [];
    const qvs: QuickviewRequest[] = [];
    cmp.favoriteToggle.subscribe((v) => favs.push(v));
    cmp.compareToggle.subscribe((v) => cmps.push(v));
    cmp.quickview.subscribe((v) => qvs.push(v));

    const click = (sel: string) => {
      const ev = new MouseEvent('click', { bubbles: true, cancelable: true });
      el.querySelector(sel)!.dispatchEvent(ev);
      return ev;
    };
    expect(click('.fav-btn').defaultPrevented).toBe(true);
    expect(click('.compare-btn').defaultPrevented).toBe(true);
    expect(click('.info').defaultPrevented).toBe(true);
    expect(favs).toEqual([6]);
    expect(cmps).toEqual([6]);
    expect(qvs).toHaveLength(1);
    expect(qvs[0]!.entry).toBe(ENTRY);
    expect(qvs[0]!.rect).toBeDefined();
  });

  it('reflects the compare state on the button', async () => {
    const { el } = await setup({ inCompare: true });
    expect(el.querySelector('.compare-btn')?.classList.contains('on')).toBe(true);
  });

  it('removes the skeleton once the image has loaded', async () => {
    const { fixture, el } = await setup();
    expect(el.querySelector('.skeleton')).not.toBeNull();
    el.querySelector('img.still')!.dispatchEvent(new Event('load'));
    fixture.detectChanges();
    expect(el.querySelector('.skeleton')).toBeNull();
    expect(el.querySelector('.card')?.classList.contains('loaded')).toBe(true);
  });

  it('falls back to the CDN artwork when the image errors', async () => {
    const { fixture, el } = await setup();
    const img = el.querySelector<HTMLImageElement>('img.still')!;
    img.dispatchEvent(new Event('error'));
    fixture.detectChanges();
    expect(img.src).toContain('/other/official-artwork/6.png');
    expect(el.querySelector('.skeleton')).toBeNull();
  });

  it('shows an animated sprite on hover and drops it if it fails', async () => {
    const { fixture, el, card } = await setup();
    expect(el.querySelector('img.anim')).toBeNull();
    card.dispatchEvent(new Event('pointerenter'));
    fixture.detectChanges();
    const anim = el.querySelector('img.anim');
    expect(anim?.getAttribute('src')).toContain('/other/showdown/6.gif');
    anim!.dispatchEvent(new Event('error'));
    fixture.detectChanges();
    expect(el.querySelector('img.anim')).toBeNull();
    card.dispatchEvent(new Event('pointerleave'));
    fixture.detectChanges();
    expect(card.classList.contains('hover')).toBe(false);
  });

  it('tilts towards the pointer and resets on leave', async () => {
    const { fixture, card } = await setup();
    card.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 100, height: 100, right: 100, bottom: 100 }) as DOMRect;
    card.dispatchEvent(new PointerEvent('pointermove', { clientX: 90, clientY: 10 }));
    fixture.detectChanges();
    expect(card.style.getPropertyValue('--mx')).toBe('90%');
    expect(card.style.getPropertyValue('--my')).toBe('10%');
    expect(card.style.transform).toContain('rotateY(4.8');
    card.dispatchEvent(new Event('pointerleave'));
    fixture.detectChanges();
    expect(card.style.transform).toContain('rotateX(0deg) rotateY(0deg)');
  });

  it('derives the type colour variables', async () => {
    const { card } = await setup();
    expect(card.style.getPropertyValue('--t1')).toContain('fire');
    expect(card.style.getPropertyValue('--t2')).toContain('flying');
  });
});
