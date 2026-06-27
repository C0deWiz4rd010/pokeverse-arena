import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { titleCase } from '../../core/ui/format';
import { officialArtwork } from '../../core/api/pokeapi-endpoints';
import type { EvolutionNode } from '../../core/models/pokemon.model';

/** Recursively renders an evolution chain; highlights the current Pokémon. */
@Component({
  selector: 'pv-evolution-tree',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <div class="stage">
      <a class="node" [class.current]="node().id === currentId()" [routerLink]="['/pokemon', node().id]">
        <span class="halo" aria-hidden="true"></span>
        <img [src]="node().artwork" [alt]="name()" loading="lazy" (error)="onError($event)" />
        <span>{{ name() }}</span>
      </a>

      @if (node().children.length) {
        <div class="branches">
          @for (child of node().children; track child.id) {
            <div class="branch">
              <div class="arrow" aria-hidden="true">
                @if (child.trigger) { <span class="trigger">{{ child.trigger }}</span> }
                <span class="line"></span>
                <span class="tip">▸</span>
              </div>
              <pv-evolution-tree [node]="child" [currentId]="currentId()" />
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [
    `
      .stage { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.6rem; }
      @media (min-width: 768px) { .stage { flex-direction: row; } }
      .node {
        position: relative;
        display: grid;
        place-items: center;
        gap: 0.2rem;
        padding: 0.5rem;
        border-radius: var(--radius-sm);
        transition: transform 0.15s ease, background 0.15s ease;
        text-transform: capitalize;
        font-weight: 700;
        font-size: 0.85rem;
        color: var(--text);
        text-decoration: none;
      }
      .node:hover { transform: translateY(-3px); background: rgba(255, 255, 255, 0.06); }
      .node img { width: 76px; height: 76px; object-fit: contain; position: relative; z-index: 1; }
      .halo { position: absolute; inset: 0; border-radius: 50%; opacity: 0; transition: opacity 0.3s ease; }
      .node.current {
        background: color-mix(in srgb, var(--accent, #6ce0ff) 14%, transparent);
        box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent, #6ce0ff) 45%, transparent);
      }
      .node.current .halo {
        opacity: 1;
        background: radial-gradient(circle at 50% 45%, color-mix(in srgb, var(--accent, #6ce0ff) 40%, transparent), transparent 65%);
        animation: pulse 2.4s ease-in-out infinite;
      }
      .node.current img { animation: bob 2.6s ease-in-out infinite; }
      .branches { display: flex; flex-direction: column; gap: 0.6rem; }
      .branch { display: flex; align-items: center; gap: 0.4rem; }
      .arrow { display: grid; justify-items: center; color: var(--text-faint); min-width: 64px; }
      .line { width: 40px; height: 2px; background: linear-gradient(90deg, var(--glass-border), var(--accent, #6ce0ff)); }
      .trigger { font-size: 0.68rem; color: var(--accent-3); white-space: nowrap; }
      .tip { color: var(--accent); }
      @keyframes pulse { 0%, 100% { transform: scale(1); opacity: 0.8; } 50% { transform: scale(1.08); opacity: 1; } }
      @keyframes bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
      @media (prefers-reduced-motion: reduce) { .node.current .halo, .node.current img { animation: none; } }
    `,
  ],
})
export class EvolutionTreeComponent {
  readonly node = input.required<EvolutionNode>();
  readonly currentId = input<number>(0);

  name = () => titleCase(this.node().name);

  protected onError(event: Event): void {
    const img = event.target as HTMLImageElement;
    const fb = officialArtwork(this.node().id);
    if (img.src !== fb) img.src = fb;
  }
}
