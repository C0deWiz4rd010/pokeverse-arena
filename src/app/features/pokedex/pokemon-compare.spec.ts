import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { PokedexDetailService, type QuickDetail } from './pokedex-detail.service';
import { PokemonCompareComponent } from './pokemon-compare';

function mon(id: number, name: string, types: string[], hp: number, speed: number): QuickDetail {
  const stats = {
    hp,
    attack: 80,
    defense: 80,
    'special-attack': 80,
    'special-defense': 80,
    speed,
  };
  return {
    id,
    name,
    types,
    heightM: 1,
    weightKg: 10,
    baseExperience: 100,
    stats,
    baseStatTotal: hp + speed + 320,
    abilities: [],
    moves: [],
    sprites: { default: `art-${id}.png`, shiny: '', animatedFront: null, animatedBack: null },
    cry: null,
    speciesId: id,
    genus: '',
    flavor: '',
    genusDe: '',
    flavorDe: '',
  } as QuickDetail;
}

const DB: Record<number, QuickDetail> = {
  6: mon(6, 'charizard', ['fire', 'flying'], 78, 100),
  9: mon(9, 'blastoise', ['water'], 79, 78),
  13: mon(13, 'weedle', ['bug', 'poison'], 40, 50),
};

async function setup(ids: number[], inputs: Record<string, unknown> = {}) {
  const load = vi.fn((id: number) =>
    DB[id] ? Promise.resolve(DB[id]!) : Promise.reject(new Error('missing')),
  );
  TestBed.configureTestingModule({
    providers: [provideRouter([]), { provide: PokedexDetailService, useValue: { load } }],
  });
  const fixture = TestBed.createComponent(PokemonCompareComponent);
  fixture.componentRef.setInput('ids', ids);
  for (const [k, v] of Object.entries(inputs)) fixture.componentRef.setInput(k, v);
  fixture.detectChanges();
  await fixture.whenStable();
  await vi.waitFor(() => {
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('.loading')).toBeNull();
  });
  return { fixture, el: fixture.nativeElement as HTMLElement, load };
}

describe('PokemonCompareComponent', () => {
  it('renders one column, polygon and legend entry per Pokémon', async () => {
    const { el, load } = await setup([6, 9]);
    expect(load).toHaveBeenCalledTimes(2);
    expect(el.querySelectorAll('.mon-head')).toHaveLength(2);
    expect(el.querySelectorAll('polygon.shape')).toHaveLength(2);
    expect(Array.from(el.querySelectorAll('.leg')).map((l) => l.textContent!.trim())).toEqual([
      'Charizard',
      'Blastoise',
    ]);
    expect(el.querySelector('.mon-head img')?.getAttribute('src')).toBe('art-6.png');
    expect(el.querySelector('.mon-head .num')?.textContent).toBe('#006');
    expect(el.querySelector('.mon-head a')?.getAttribute('href')).toBe('/pokemon/6');
  });

  it('highlights the best value per stat row and the best BST', async () => {
    const { el } = await setup([6, 9]);
    const cells = Array.from(el.querySelectorAll<HTMLElement>('.cell'));
    // first row = HP: charizard 78 vs blastoise 79 -> blastoise best
    expect(cells[0]!.classList.contains('best')).toBe(false);
    expect(cells[1]!.classList.contains('best')).toBe(true);
    const bst = Array.from(el.querySelectorAll<HTMLElement>('.cell.bst'));
    // 78+100+320 = 498 vs 79+78+320 = 477
    expect(bst.map((c) => c.classList.contains('best'))).toEqual([true, false]);
    expect(bst[0]!.textContent!.trim()).toBe('498');
  });

  it('lists type weaknesses per Pokémon', async () => {
    const { el } = await setup([6]);
    const weak = Array.from(el.querySelectorAll('.cell.weak pv-type-badge')).map((b) =>
      b.textContent!.trim().toLowerCase(),
    );
    // charizard: 4x rock, plus water and electric
    expect(weak).toEqual(expect.arrayContaining(['rock', 'water', 'electric']));
    expect(weak).not.toContain('fire');
  });

  it('uses the shiny artwork when shiny is set', async () => {
    const { el } = await setup([9], { shiny: true });
    expect(el.querySelector('.mon-head img')?.getAttribute('src')).toContain(
      'official-artwork/shiny/9.png',
    );
  });

  it('skips Pokémon that fail to load', async () => {
    const { el } = await setup([6, 999]);
    expect(el.querySelectorAll('.mon-head')).toHaveLength(1);
  });

  it('emits removeId and close', async () => {
    const { fixture, el } = await setup([6, 9]);
    const removed: number[] = [];
    let closed = 0;
    fixture.componentInstance.removeId.subscribe((id) => removed.push(id));
    fixture.componentInstance.close.subscribe(() => closed++);
    el.querySelectorAll<HTMLButtonElement>('.rm')[1]!.click();
    el.querySelector<HTMLButtonElement>('.x')!.click();
    el.querySelector<HTMLElement>('.backdrop')!.click();
    expect(removed).toEqual([9]);
    expect(closed).toBe(2);
  });

  it('reloads when the ids change', async () => {
    const { fixture, el } = await setup([6, 9]);
    fixture.componentRef.setInput('ids', [13, 6, 9]);
    fixture.detectChanges();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(el.querySelectorAll('.mon-head')).toHaveLength(3);
    });
    expect(el.querySelector('.mon-head strong')?.textContent).toBe('Weedle');
  });
});
