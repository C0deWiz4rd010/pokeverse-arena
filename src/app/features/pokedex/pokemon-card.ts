import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { padId, titleCase, typeColorVar } from '../../core/ui/format';
import { animatedSprite, officialArtwork } from '../../core/api/pokeapi-endpoints';
import { TypeBadgeComponent } from '../../core/ui/type-badge/type-badge';
import { IconComponent } from '../../core/ui/icon/icon';
import type { PokedexEntry } from '../../core/models/pokemon.model';

const REDUCED_MOTION =
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export interface QuickviewRequest {
  readonly entry: PokedexEntry;
  readonly rect: DOMRect;
}

/** Pokédex grid tile: type-themed, skeleton-loaded, shiny-aware, with a 3D tilt,
 *  an animated sprite on hover and a quick-view trigger. */
@Component({
  selector: 'pv-pokemon-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TypeBadgeComponent, IconComponent],
  template: `
    <a
      class="card"
      [class.loaded]="loaded()"
      [class.hover]="hovering()"
      [class.fav]="favorite()"
      [class.compact]="layout() === 'compact'"
      [class.list]="layout() === 'list'"
      [style.--t1]="t1()"
      [style.--t2]="t2()"
      [style.animation-delay]="delay()"
      [style.transform]="transform()"
      [attr.data-id]="entry().id"
      [routerLink]="['/pokemon', entry().id]"
      (pointermove)="onMove($event)"
      (pointerleave)="onLeave()"
      (pointerenter)="hovering.set(true)"
    >
      <span class="sheen" aria-hidden="true"></span>

      <div class="top">
        <span class="num">{{ id() }}</span>
        <span class="badges">
          @if (caught()) { <span class="dot caught" title="Caught in the World"><pv-icon name="check" /></span> }
          <button
            class="fav-btn"
            type="button"
            [class.on]="favorite()"
            [attr.aria-pressed]="favorite()"
            aria-label="Toggle favorite"
            (click)="onFav($event)"
          >
            <pv-icon name="heart" />
          </button>
        </span>
      </div>

      <div class="art">
        @if (!loaded()) { <span class="skeleton" aria-hidden="true"></span> }
        <img
          class="still"
          [src]="art()"
          [alt]="name()"
          loading="lazy"
          decoding="async"
          (load)="loaded.set(true)"
          (error)="onError($event)"
        />
        @if (hovering() && !animFail()) {
          <img class="anim" [src]="animSrc()" [alt]="''" aria-hidden="true" (error)="animFail.set(true)" />
        }
      </div>

      <span class="name">{{ name() }}</span>
      @if (entry().types.length) {
        <div class="types">
          @for (t of entry().types; track t) { <pv-type-badge [type]="t" /> }
        </div>
      }

      <button class="info" type="button" aria-label="Quick view" (click)="onInfo($event)">
        <pv-icon name="search" />
      </button>
      <button
        class="compare-btn"
        type="button"
        [class.on]="inCompare()"
        aria-label="Add to compare"
        title="Compare"
        (click)="onCompare($event)"
      >⇄</button>
    </a>
  `,
  styleUrl: './pokemon-card.scss',
})
export class PokemonCardComponent {
  readonly entry = input.required<PokedexEntry>();
  readonly index = input<number>(0);
  readonly shiny = input<boolean>(false);
  readonly layout = input<'gallery' | 'compact' | 'list'>('gallery');
  readonly favorite = input<boolean>(false);
  readonly caught = input<boolean>(false);
  readonly inCompare = input<boolean>(false);
  readonly quickview = output<QuickviewRequest>();
  readonly favoriteToggle = output<number>();
  readonly compareToggle = output<number>();

  protected readonly loaded = signal(false);
  protected readonly hovering = signal(false);
  protected readonly animFail = signal(false);
  private readonly tilt = signal<{ rx: number; ry: number }>({ rx: 0, ry: 0 });

  protected id = () => padId(this.entry().id);
  protected name = () => titleCase(this.entry().name);
  protected art = computed(() => (this.shiny() ? officialArtwork(this.entry().id, true) : this.entry().artwork));
  protected animSrc = computed(() => animatedSprite(this.entry().id, this.shiny()));
  protected t1 = computed(() => typeColorVar(this.entry().types[0] ?? 'normal'));
  protected t2 = computed(() => typeColorVar(this.entry().types[1] ?? this.entry().types[0] ?? 'normal'));
  protected delay = computed(() => (REDUCED_MOTION ? '0ms' : `${(this.index() % 24) * 22}ms`));

  protected transform = computed(() => {
    if (REDUCED_MOTION) return '';
    const { rx, ry } = this.tilt();
    const lift = this.hovering() ? -6 : 0;
    return `perspective(700px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(${lift}px)`;
  });

  constructor() {
    // Re-test the animated sprite when shiny mode flips (a shiny GIF may differ).
    effect(() => {
      this.shiny();
      this.animFail.set(false);
    });
  }

  protected onMove(event: PointerEvent): void {
    if (REDUCED_MOTION) return;
    const el = event.currentTarget as HTMLElement;
    const r = el.getBoundingClientRect();
    const px = (event.clientX - r.left) / r.width;
    const py = (event.clientY - r.top) / r.height;
    this.hovering.set(true);
    this.tilt.set({ rx: (0.5 - py) * 9, ry: (px - 0.5) * 9 });
    el.style.setProperty('--mx', `${px * 100}%`);
    el.style.setProperty('--my', `${py * 100}%`);
  }

  protected onLeave(): void {
    this.hovering.set(false);
    this.tilt.set({ rx: 0, ry: 0 });
  }

  protected onInfo(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    const card = (event.currentTarget as HTMLElement).closest('.card') as HTMLElement;
    this.quickview.emit({ entry: this.entry(), rect: card.getBoundingClientRect() });
  }

  protected onFav(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.favoriteToggle.emit(this.entry().id);
  }

  protected onCompare(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.compareToggle.emit(this.entry().id);
  }

  protected onError(event: Event): void {
    const img = event.target as HTMLImageElement;
    const fallback = officialArtwork(this.entry().id, this.shiny());
    if (img.src !== fallback) img.src = fallback;
    this.loaded.set(true);
  }
}
