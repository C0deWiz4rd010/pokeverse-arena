import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { titleCase } from '../../core/ui/format';
import { officialArtwork } from '../../core/api/pokeapi-endpoints';
import type { EvolutionNode } from '../../core/models/pokemon.model';

/** Recursively renders an evolution chain as connected stages. */
@Component({
  selector: 'pv-evolution-tree',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <div class="stage">
      <a class="node" [routerLink]="['/pokemon', node().id]">
        <img [src]="node().artwork" [alt]="name()" loading="lazy" (error)="onError($event)" />
        <span>{{ name() }}</span>
      </a>

      @if (node().children.length) {
        <div class="branches">
          @for (child of node().children; track child.id) {
            <div class="branch">
              <div class="arrow" aria-hidden="true">
                <span class="line"></span>
                @if (child.trigger) {
                  <span class="trigger">{{ child.trigger }}</span>
                }
                <span class="tip">▸</span>
              </div>
              <pv-evolution-tree [node]="child" />
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [
    `
      .stage { display: flex; align-items: center; gap: 0.6rem; }
      .node {
        display: grid;
        place-items: center;
        gap: 0.2rem;
        padding: 0.5rem;
        border-radius: var(--radius-sm);
        transition: transform 0.15s ease, background 0.15s ease;
        text-transform: capitalize;
        font-weight: 700;
        font-size: 0.85rem;
      }
      .node:hover { transform: translateY(-3px); background: rgba(255, 255, 255, 0.06); }
      .node img { width: 76px; height: 76px; object-fit: contain; }
      .branches { display: flex; flex-direction: column; gap: 0.6rem; }
      .branch { display: flex; align-items: center; gap: 0.4rem; }
      .arrow { display: grid; justify-items: center; color: var(--text-faint); min-width: 64px; }
      .line { width: 40px; height: 2px; background: var(--glass-border); }
      .trigger { font-size: 0.68rem; color: var(--accent-3); white-space: nowrap; }
      .tip { color: var(--accent); }
      @media (max-width: 640px) {
        .stage { flex-direction: column; }
      }
    `,
  ],
})
export class EvolutionTreeComponent {
  readonly node = input.required<EvolutionNode>();

  name = () => titleCase(this.node().name);

  protected onError(event: Event): void {
    const img = event.target as HTMLImageElement;
    const fb = officialArtwork(this.node().id);
    if (img.src !== fb) img.src = fb;
  }
}
