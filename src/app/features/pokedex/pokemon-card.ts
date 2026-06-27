import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { padId, titleCase, typeColorVar } from '../../core/ui/format';
import { officialArtwork } from '../../core/api/pokeapi-endpoints';
import { TypeBadgeComponent } from '../../core/ui/type-badge/type-badge';
import type { PokedexEntry } from '../../core/models/pokemon.model';

const REDUCED_MOTION =
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Pokédex grid tile: type-themed, skeleton-loaded, with a 3D cursor tilt. */
@Component({
  selector: 'pv-pokemon-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TypeBadgeComponent],
  template: `
    <a
      class="card"
      [class.loaded]="loaded()"
      [class.hover]="hovering()"
      [style.--t1]="t1()"
      [style.--t2]="t2()"
      [style.animation-delay]="delay()"
      [style.transform]="transform()"
      [routerLink]="['/pokemon', entry().id]"
      (pointermove)="onMove($event)"
      (pointerleave)="onLeave()"
      (pointerenter)="hovering.set(true)"
    >
      <span class="sheen" aria-hidden="true"></span>
      <span class="num">{{ id() }}</span>
      <div class="art">
        @if (!loaded()) { <span class="skeleton" aria-hidden="true"></span> }
        <img
          [src]="entry().artwork"
          [alt]="name()"
          loading="lazy"
          decoding="async"
          (load)="loaded.set(true)"
          (error)="onError($event)"
        />
      </div>
      <span class="name">{{ name() }}</span>
      @if (entry().types.length) {
        <div class="types">
          @for (t of entry().types; track t) { <pv-type-badge [type]="t" /> }
        </div>
      }
    </a>
  `,
  styles: [
    `
      .card {
        --t1: var(--accent);
        --t2: var(--accent-2);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.35rem;
        padding: 0.8rem 0.7rem 0.7rem;
        position: relative;
        border-radius: var(--radius);
        border: 1px solid var(--glass-border);
        background:
          radial-gradient(120% 90% at 50% -10%, color-mix(in srgb, var(--t1) 26%, transparent), transparent 70%),
          linear-gradient(160deg, color-mix(in srgb, var(--t2) 12%, transparent), transparent 60%),
          var(--glass);
        overflow: hidden;
        transform-style: preserve-3d;
        transition: border-color 0.18s ease, box-shadow 0.2s ease, transform 0.12s ease;
        animation: card-in 0.4s ease both;
      }
      .card.hover {
        border-color: color-mix(in srgb, var(--t1) 70%, transparent);
        box-shadow: 0 16px 38px color-mix(in srgb, var(--t1) 28%, transparent);
      }
      /* Sweep of light following the cursor on hover. */
      .sheen {
        position: absolute;
        inset: 0;
        background: radial-gradient(
          200px 200px at var(--mx, 50%) var(--my, 0%),
          color-mix(in srgb, var(--t1) 30%, transparent),
          transparent 60%
        );
        opacity: 0;
        transition: opacity 0.2s ease;
        pointer-events: none;
      }
      .card.hover .sheen { opacity: 0.8; }
      .num {
        position: absolute;
        top: 0.5rem;
        left: 0.7rem;
        font-size: 0.72rem;
        font-weight: 800;
        color: color-mix(in srgb, var(--t1) 60%, var(--text-faint));
        font-variant-numeric: tabular-nums;
      }
      .art {
        position: relative;
        width: 100%;
        aspect-ratio: 1;
        display: grid;
        place-items: center;
      }
      .skeleton {
        position: absolute;
        inset: 8%;
        border-radius: 50%;
        background: linear-gradient(110deg, rgba(255, 255, 255, 0.05) 30%, rgba(255, 255, 255, 0.15) 50%, rgba(255, 255, 255, 0.05) 70%);
        background-size: 200% 100%;
        animation: shimmer 1.2s linear infinite;
      }
      .art img {
        width: 88%;
        height: 88%;
        object-fit: contain;
        filter: drop-shadow(0 8px 12px rgba(0, 0, 0, 0.45));
        opacity: 0;
        transform: translateY(6px) scale(0.96);
        transition: opacity 0.35s ease, transform 0.35s ease;
      }
      .card.loaded .art img { opacity: 1; transform: none; }
      .card.hover .art img { transform: translateZ(30px) scale(1.06); }
      .name { font-weight: 700; font-size: 0.92rem; text-align: center; }
      .types { display: flex; gap: 0.25rem; flex-wrap: wrap; justify-content: center; }
      .types ::ng-deep .badge { padding: 0.12rem 0.45rem; font-size: 0.64rem; }

      @keyframes shimmer { to { background-position: -200% 0; } }
      @keyframes card-in { from { opacity: 0; transform: translateY(14px) scale(0.96); } to { opacity: 1; transform: none; } }

      @media (prefers-reduced-motion: reduce) {
        .card, .art img, .skeleton { animation: none; transition: none; }
        .card.loaded .art img { opacity: 1; transform: none; }
      }
    `,
  ],
})
export class PokemonCardComponent {
  readonly entry = input.required<PokedexEntry>();
  /** Position in the visible grid — drives the staggered entrance. */
  readonly index = input<number>(0);

  protected readonly loaded = signal(false);
  protected readonly hovering = signal(false);
  private readonly tilt = signal<{ rx: number; ry: number }>({ rx: 0, ry: 0 });

  protected id = () => padId(this.entry().id);
  protected name = () => titleCase(this.entry().name);
  protected t1 = computed(() => typeColorVar(this.entry().types[0] ?? 'normal'));
  protected t2 = computed(() => typeColorVar(this.entry().types[1] ?? this.entry().types[0] ?? 'normal'));
  protected delay = computed(() => (REDUCED_MOTION ? '0ms' : `${(this.index() % 24) * 22}ms`));

  protected transform = computed(() => {
    if (REDUCED_MOTION) return '';
    const { rx, ry } = this.tilt();
    const lift = this.hovering() ? -6 : 0;
    return `perspective(700px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(${lift}px)`;
  });

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

  protected onError(event: Event): void {
    const img = event.target as HTMLImageElement;
    const fallback = officialArtwork(this.entry().id);
    if (img.src !== fallback) img.src = fallback;
    this.loaded.set(true);
  }
}
