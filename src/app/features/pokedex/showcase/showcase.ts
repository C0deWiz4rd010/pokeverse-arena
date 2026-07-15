import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { PokedexDetailService, type EvoStage, type QuickDetail } from '../pokedex-detail.service';
import { TypeBadgeComponent } from '../../../core/ui/type-badge/type-badge';
import { IconComponent } from '../../../core/ui/icon/icon';
import { CryService } from '../../../core/audio/cry.service';
import { padId, titleCase, typeColorVar } from '../../../core/ui/format';
import { SPRITE_BASE, officialArtwork } from '../../../core/api/pokeapi-endpoints';
import { RADAR_RINGS, RADAR_STATS, RADAR_VIEWBOX, labelPoint, radarPoint, shapePoints } from '../stat-radar';

const REDUCED =
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const DEX_MAX = 1025;

/**
 * The 3D **Showcase Pokédex** — an immersive, one-Pokémon-at-a-time stage
 * (the classic grid dex stays untouched; a toolbar chip switches versions).
 * Type-colored scenery, a giant parallax artwork with tilt + levitation,
 * orbiting ring, stat radar and swipe/arrow navigation. Deep-linkable via
 * `#/showcase?id=25`.
 */
@Component({
  selector: 'pv-showcase',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TypeBadgeComponent, IconComponent],
  template: `
    <section
      class="stage"
      [style.--t1]="t1()"
      [style.--t2]="t2()"
      (pointermove)="onTilt($event)"
      (pointerleave)="resetTilt()"
      (touchstart)="onTouchStart($event)"
      (touchend)="onTouchEnd($event)"
    >
      <div class="scene" aria-hidden="true">
        <span class="glow"></span>
        <span class="ring"></span>
        <span class="ring r2"></span>
        @if (detail(); as d) { <img class="echo" [src]="art()" alt="" /> }
      </div>

      <header class="bar">
        <a class="chip" routerLink="/pokedex" title="Back to the classic Pokédex"><pv-icon name="book" /> Classic</a>
        <span class="ttl">Showcase</span>
        <div class="jump">
          <input
            type="number"
            min="1"
            [max]="dexMax"
            [value]="id()"
            (change)="jump($any($event.target).valueAsNumber)"
            aria-label="Jump to Pokédex number"
          />
          <span>/ {{ dexMax }}</span>
        </div>
      </header>

      <div class="body" [class.entering]="entering()">
        <button class="nav prev" type="button" (click)="step(-1)" aria-label="Previous Pokémon">‹</button>

        <figure class="art-wrap" [style.transform]="tiltT()">
          <img
            class="art"
            [src]="art()"
            [alt]="name()"
            (load)="loaded.set(true)"
            [class.loaded]="loaded()"
            (error)="onArtError($event)"
          />
          <figcaption class="plate">
            <span class="num">{{ num() }}</span>
            <h1 class="name">{{ name() }}</h1>
            @if (detail(); as d) { <span class="genus">{{ d.genus }}</span> }
            <div class="types">
              @if (detail(); as d) { @for (t of d.types; track t) { <pv-type-badge [type]="t" /> } }
            </div>
          </figcaption>
        </figure>

        <button class="nav next" type="button" (click)="step(1)" aria-label="Next Pokémon">›</button>
      </div>

      <div class="panels">
        @if (detail(); as d) {
          <div class="panel flavor-panel">
            <p class="flavor">{{ d.flavor }}</p>
            <div class="quick-facts">
              <span>{{ d.heightM }} m</span>
              <span>{{ d.weightKg }} kg</span>
              <span>BST <strong>{{ d.baseStatTotal }}</strong></span>
            </div>
            <div class="actions">
              <button class="chip" type="button" (click)="playCry()" [class.on]="cry.playing() === id()">
                <pv-icon name="volume-2" /> Cry
              </button>
              <button class="chip" type="button" (click)="shiny.set(!shiny())" [class.on]="shiny()">
                <pv-icon name="sparkles" /> Shiny
              </button>
              <a class="chip" [routerLink]="['/pokemon', id()]"><pv-icon name="arrow-right" /> Full page</a>
            </div>
          </div>

          <div class="panel radar-panel">
            <svg class="radar" [attr.viewBox]="viewBox" role="img" [attr.aria-label]="'Stat radar for ' + name()">
              @for (ring of rings; track $index) { <polygon class="ring-l" [attr.points]="ring" /> }
              @for (r of radarStats; track r.key; let i = $index) {
                <line class="axis" x1="90" y1="86" [attr.x2]="axisPt(i).x" [attr.y2]="axisPt(i).y" />
                <text class="lbl" [attr.x]="lblPt(i).x" [attr.y]="lblPt(i).y" text-anchor="middle">{{ r.label }} {{ d.stats[r.key] }}</text>
              }
              <polygon class="shape" [attr.points]="shape(d)" />
            </svg>
          </div>

          @if (evo(); as chain) {
            @if (chain.length > 1) {
              <div class="panel evo-panel">
                <span class="evo-title">Evolution</span>
                <div class="evo">
                  @for (stage of chain; track $index; let last = $last) {
                    <div class="evo-stage">
                      @for (s of stage; track s.id) {
                        <button class="evo-mon" type="button" [class.cur]="s.id === id()" (click)="jump(s.id)" [title]="titleCase(s.name)">
                          <img [src]="evoSprite(s.id)" [alt]="s.name" loading="lazy" />
                        </button>
                      }
                    </div>
                    @if (!last) { <span class="evo-arrow" aria-hidden="true">›</span> }
                  }
                </div>
              </div>
            }
          }
        } @else {
          <div class="panel"><p class="loading">Summoning…</p></div>
        }
      </div>
    </section>
  `,
  styleUrl: './showcase.scss',
})
export class ShowcaseComponent {
  /** Deep link `?id=…` via router component-input binding. */
  readonly idParam = input<string | undefined>(undefined, { alias: 'id' });

  private readonly detailSvc = inject(PokedexDetailService);
  private readonly router = inject(Router);
  protected readonly cry = inject(CryService);

  protected readonly dexMax = DEX_MAX;
  protected readonly viewBox = RADAR_VIEWBOX;
  protected readonly rings = RADAR_RINGS;
  protected readonly radarStats = RADAR_STATS;
  protected readonly titleCase = titleCase;

  protected readonly id = signal(25);
  protected readonly detail = signal<QuickDetail | null>(null);
  protected readonly evo = signal<EvoStage[][] | null>(null);
  protected readonly loaded = signal(false);
  protected readonly shiny = signal(false);
  protected readonly entering = signal(false);
  private readonly tilt = signal<{ rx: number; ry: number }>({ rx: 0, ry: 0 });
  private touchX: number | null = null;

  protected num = () => padId(this.id());
  protected name = computed(() => titleCase(this.detail()?.name ?? '…'));
  protected t1 = computed(() => typeColorVar(this.detail()?.types[0] ?? 'normal'));
  protected t2 = computed(() => typeColorVar(this.detail()?.types[1] ?? this.detail()?.types[0] ?? 'normal'));

  protected art = computed(() => officialArtwork(this.id(), this.shiny()));

  protected readonly tiltT = computed(() => {
    if (REDUCED) return '';
    const { rx, ry } = this.tilt();
    return `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg)`;
  });

  constructor() {
    effect(() => {
      const raw = Number(this.idParam());
      if (Number.isInteger(raw) && raw >= 1 && raw <= DEX_MAX) this.id.set(raw);
    });
    effect(() => {
      const id = this.id();
      this.detail.set(null);
      this.evo.set(null);
      this.loaded.set(false);
      if (!REDUCED) {
        this.entering.set(true);
        setTimeout(() => this.entering.set(false), 450);
      }
      this.detailSvc.load(id).then(
        (d) => this.detail.set(d),
        () => undefined,
      );
      this.detailSvc.loadChain(id).then(
        (c) => this.evo.set(c),
        () => this.evo.set([]),
      );
    });
  }

  /* ------------------------------------------------------------ nav */

  protected step(delta: number): void {
    this.jump(this.id() + delta);
  }

  protected jump(to: number): void {
    if (!Number.isInteger(to)) return;
    const id = Math.min(DEX_MAX, Math.max(1, to));
    this.id.set(id);
    void this.router.navigate([], { queryParams: { id }, replaceUrl: true });
  }

  @HostListener('document:keydown', ['$event'])
  protected onKey(e: KeyboardEvent): void {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); this.step(-1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); this.step(1); }
  }

  protected onTouchStart(e: TouchEvent): void {
    this.touchX = e.touches[0]?.clientX ?? null;
  }
  protected onTouchEnd(e: TouchEvent): void {
    if (this.touchX === null) return;
    const dx = (e.changedTouches[0]?.clientX ?? this.touchX) - this.touchX;
    this.touchX = null;
    if (Math.abs(dx) > 60) this.step(dx < 0 ? 1 : -1);
  }

  /* ------------------------------------------------------------ fx */

  protected onTilt(event: PointerEvent): void {
    if (REDUCED || event.pointerType === 'touch') return;
    const r = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const px = (event.clientX - r.left) / r.width;
    const py = (event.clientY - r.top) / r.height;
    this.tilt.set({ rx: (0.5 - py) * 10, ry: (px - 0.5) * 10 });
  }
  protected resetTilt(): void {
    this.tilt.set({ rx: 0, ry: 0 });
  }

  protected playCry(): void {
    this.cry.play(this.id());
  }

  protected axisPt(i: number): { x: number; y: number } {
    return radarPoint(i, 1);
  }
  protected lblPt(i: number): { x: number; y: number } {
    return labelPoint(i);
  }
  protected shape(d: QuickDetail): string {
    return shapePoints(d.stats);
  }
  protected evoSprite(id: number): string {
    return `${SPRITE_BASE}/pokemon/${id}.png`;
  }

  protected onArtError(event: Event): void {
    const img = event.target as HTMLImageElement;
    const fallback = officialArtwork(this.id());
    if (img.src !== fallback) img.src = fallback;
  }
}
