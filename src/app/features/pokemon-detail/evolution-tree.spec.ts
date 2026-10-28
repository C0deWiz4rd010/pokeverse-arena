import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import type { EvolutionNode } from '../../core/models/pokemon.model';
import { EvolutionTreeComponent } from './evolution-tree';

const node = (
  id: number,
  name: string,
  trigger: string | null,
  children: EvolutionNode[] = [],
): EvolutionNode => ({ id, name, artwork: `art-${id}.png`, trigger, children });

const EEVEE = node(133, 'eevee', null, [
  node(134, 'vaporeon', 'water stone'),
  node(135, 'jolteon', 'Lv. 20', [node(136, 'x', null)]),
]);

function render(root: EvolutionNode, currentId?: number) {
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  const fixture = TestBed.createComponent(EvolutionTreeComponent);
  fixture.componentRef.setInput('node', root);
  if (currentId !== undefined) fixture.componentRef.setInput('currentId', currentId);
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement };
}

describe('EvolutionTreeComponent', () => {
  it('renders the root and every descendant recursively', () => {
    const { el } = render(EEVEE);
    const names = Array.from(el.querySelectorAll('.node > span:last-child')).map((n) =>
      n.textContent!.trim(),
    );
    expect(names).toEqual(['Eevee', 'Vaporeon', 'Jolteon', 'X']);
    expect(el.querySelectorAll('.branch')).toHaveLength(3);
  });

  it('links every node to its detail page', () => {
    const { el } = render(EEVEE);
    const hrefs = Array.from(el.querySelectorAll('a.node')).map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(['/pokemon/133', '/pokemon/134', '/pokemon/135', '/pokemon/136']);
  });

  it('shows triggers only where present', () => {
    const { el } = render(EEVEE);
    expect(Array.from(el.querySelectorAll('.trigger')).map((t) => t.textContent!.trim())).toEqual([
      'water stone',
      'Lv. 20',
    ]);
  });

  it('marks only the current Pokémon', () => {
    const { el } = render(EEVEE, 135);
    const current = el.querySelectorAll('a.node.current');
    expect(current).toHaveLength(1);
    expect(current[0]!.getAttribute('href')).toBe('/pokemon/135');
  });

  it('highlights nothing by default and renders a leaf without branches', () => {
    const { el } = render(node(25, 'pikachu', null));
    expect(el.querySelector('.current')).toBeNull();
    expect(el.querySelector('.branches')).toBeNull();
  });

  it('falls back to the CDN artwork on image error', () => {
    const { el } = render(node(25, 'pikachu', null));
    const img = el.querySelector<HTMLImageElement>('img')!;
    expect(img.getAttribute('src')).toBe('art-25.png');
    img.dispatchEvent(new Event('error'));
    expect(img.src).toContain('/other/official-artwork/25.png');
  });
});
