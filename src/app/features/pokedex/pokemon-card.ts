import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { padId, titleCase } from '../../core/ui/format';
import { officialArtwork } from '../../core/api/pokeapi-endpoints';
import type { PokedexEntry } from '../../core/models/pokemon.model';

/** Pokedex grid tile with lazy image and a gentle hover tilt. */
@Component({
  selector: 'pv-pokemon-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <a class="card glass" [routerLink]="['/pokemon', entry().id]">
      <span class="num">{{ id() }}</span>
      <div class="art">
        <img
          [src]="entry().artwork"
          [alt]="name()"
          loading="lazy"
          decoding="async"
          (error)="onError($event)"
        />
      </div>
      <span class="name">{{ name() }}</span>
    </a>
  `,
  styles: [
    `
      .card {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 0.8rem;
        position: relative;
        transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
      }
      .card:hover {
        transform: translateY(-6px);
        border-color: var(--accent);
        box-shadow: 0 12px 30px rgba(108, 224, 255, 0.25);
      }
      .num {
        position: absolute;
        top: 0.5rem;
        left: 0.7rem;
        font-size: 0.75rem;
        font-weight: 700;
        color: var(--text-faint);
        font-variant-numeric: tabular-nums;
      }
      .art {
        width: 100%;
        aspect-ratio: 1;
        display: grid;
        place-items: center;
      }
      .art img {
        width: 86%;
        height: 86%;
        object-fit: contain;
        filter: drop-shadow(0 6px 10px rgba(0, 0, 0, 0.4));
        transition: transform 0.2s ease;
      }
      .card:hover .art img { transform: scale(1.08); }
      .name {
        font-weight: 700;
        font-size: 0.9rem;
        text-align: center;
      }
    `,
  ],
})
export class PokemonCardComponent {
  readonly entry = input.required<PokedexEntry>();

  id = () => padId(this.entry().id);
  name = () => titleCase(this.entry().name);

  protected onError(event: Event): void {
    // Fall back to the front_default sprite if official artwork is missing.
    const img = event.target as HTMLImageElement;
    const fallback = officialArtwork(this.entry().id);
    if (img.src !== fallback) img.src = fallback;
  }
}
