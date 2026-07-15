import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { PokedexDetailService, type QuickDetail } from './pokedex-detail.service';
import { TypeBadgeComponent } from '../../core/ui/type-badge/type-badge';
import { IconComponent } from '../../core/ui/icon/icon';
import { CryService } from '../../core/audio/cry.service';
import { padId, titleCase, typeColorVar } from '../../core/ui/format';
import { officialArtwork } from '../../core/api/pokeapi-endpoints';
import type { PokedexEntry } from '../../core/models/pokemon.model';
import type { StatKey } from '../../core/utils/stat-calculator';

const STAT_ROWS: { key: StatKey; label: string }[] = [
  { key: 'hp', label: 'HP' },
  { key: 'attack', label: 'Atk' },
  { key: 'defense', label: 'Def' },
  { key: 'special-attack', label: 'SpA' },
  { key: 'special-defense', label: 'SpD' },
  { key: 'speed', label: 'Spe' },
];

const REDUCED =
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Radar geometry: hexagon around (90,86), radius 64, HP at 12 o'clock. */
const RADAR_CX = 90;
const RADAR_CY = 86;
const RADAR_R = 64;
const RADAR_MAX = 180;

function radarPoint(i: number, frac: number): { x: number; y: number } {
  const a = -Math.PI / 2 + (i * Math.PI) / 3;
  return { x: RADAR_CX + Math.cos(a) * RADAR_R * frac, y: RADAR_CY + Math.sin(a) * RADAR_R * frac };
}

function ringPoints(frac: number): string {
  return STAT_ROWS.map((_, i) => {
    const p = radarPoint(i, frac);
    return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
  }).join(' ');
}

const RADAR_RINGS = [0.25, 0.5, 0.75, 1].map(ringPoints);

/** A lazy, anchored quick-view popover for a Pokédex entry. */
@Component({
  selector: 'pv-pokemon-quickview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TypeBadgeComponent, IconComponent],
  template: `
    <div class="backdrop" (click)="close.emit()"></div>
    <div
      class="panel"
      [style.--t1]="t1()"
      [style.--t2]="t2()"
      [style.top.px]="pos().top"
      [style.left.px]="pos().left"
      [style.transform]="tiltT()"
      (pointermove)="onTilt($event)"
      (pointerleave)="resetTilt()"
      role="dialog"
    >
      <button class="x" type="button" (click)="close.emit()" aria-label="Close"><pv-icon name="x" /></button>

      <div class="flip" [class.flipped]="flipped()">
        <div class="face front" [attr.aria-hidden]="flipped()">
          <header class="qv-head">
            <div class="qv-art">
              @if (!loaded()) { <span class="skel" aria-hidden="true"></span> }
              <img [src]="art()" [alt]="name()" (load)="loaded.set(true)" (error)="onArtError($event)" />
            </div>
            <div class="qv-id">
              <span class="num">{{ num() }}</span>
              <strong class="qv-name">{{ name() }}</strong>
              @if (detail(); as d) { <span class="genus">{{ d.genus }}</span> }
              <div class="qv-types">
                @for (t of entry().types; track t) { <pv-type-badge [type]="t" /> }
              </div>
            </div>
          </header>

          <div class="qv-actions">
            <button class="chip" type="button" (click)="playCry()" [class.on]="cry.playing() === entry().id">
              <pv-icon name="volume-2" /> Cry
            </button>
            <button class="chip" type="button" (click)="flipped.set(true)" [disabled]="!detail()" title="Stat radar">
              <pv-icon name="star" /> Radar
            </button>
            <a class="chip" [routerLink]="['/fusion']" [queryParams]="{ head: entry().id }" title="Splice in the Fusion Lab"><pv-icon name="flask-conical" /> Fuse</a>
            <a class="chip primary" [routerLink]="['/pokemon', entry().id]"><pv-icon name="arrow-right" /> Full page</a>
          </div>

          @if (error()) {
            <p class="qv-err">Couldn’t load details.</p>
          } @else if (!detail()) {
            <div class="qv-skel">
              @for (r of statRows; track r.key) { <span class="bar-skel"></span> }
            </div>
          } @else if (detail(); as d) {
            <p class="flavor">{{ d.flavor }}</p>
            <div class="stats">
              @for (r of statRows; track r.key) {
                <div class="stat">
                  <span class="s-label">{{ r.label }}</span>
                  <span class="s-val">{{ d.stats[r.key] }}</span>
                  <span class="s-track"><span class="s-fill" [style.width.%]="pct(d.stats[r.key])" [style.background]="statColor(d.stats[r.key])"></span></span>
                </div>
              }
              <div class="bst"><span>BST</span><strong>{{ d.baseStatTotal }}</strong></div>
            </div>
            <div class="meta">
              <span>{{ d.heightM }} m · {{ d.weightKg }} kg</span>
              <span class="abilities">{{ abilities(d) }}</span>
            </div>
          }
        </div>

        <div class="face back" [attr.aria-hidden]="!flipped()">
          @if (detail(); as d) {
            <header class="rd-head">
              <button class="chip rd-back" type="button" (click)="flipped.set(false)" aria-label="Back to profile">‹</button>
              <strong class="qv-name">{{ name() }}</strong>
              <span class="rd-bst">BST <strong>{{ d.baseStatTotal }}</strong></span>
            </header>
            <svg class="radar" viewBox="0 0 180 176" role="img" [attr.aria-label]="'Stat radar for ' + name()">
              @for (ring of rings; track $index) {
                <polygon class="ring" [attr.points]="ring" />
              }
              @for (r of statRows; track r.key; let i = $index) {
                <line class="axis" x1="90" y1="86" [attr.x2]="axisPt(i).x" [attr.y2]="axisPt(i).y" />
                <text class="lbl" [attr.x]="lblPt(i).x" [attr.y]="lblPt(i).y" text-anchor="middle">{{ r.label }} {{ d.stats[r.key] }}</text>
              }
              <polygon class="shape" [attr.points]="radarShape()" />
              @for (r of statRows; track r.key; let i = $index) {
                <circle class="pt" [attr.cx]="statPt(i, d).x" [attr.cy]="statPt(i, d).y" r="2.4" />
              }
            </svg>
            <div class="meta">
              <span>{{ d.heightM }} m · {{ d.weightKg }} kg</span>
              <span class="abilities">{{ abilities(d) }}</span>
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styleUrl: './pokemon-quickview.scss',
})
export class PokemonQuickviewComponent {
  readonly entry = input.required<PokedexEntry>();
  readonly rect = input.required<DOMRect>();
  readonly shiny = input<boolean>(false);
  readonly close = output<void>();

  private readonly detailSvc = inject(PokedexDetailService);
  protected readonly cry = inject(CryService);
  protected readonly statRows = STAT_ROWS;

  protected readonly detail = signal<QuickDetail | null>(null);
  protected readonly error = signal(false);
  protected readonly loaded = signal(false);
  /** Back face shows the stat radar; flipping is a plain rotateY toggle. */
  protected readonly flipped = signal(false);
  protected readonly rings = RADAR_RINGS;
  private readonly tilt = signal<{ rx: number; ry: number }>({ rx: 0, ry: 0 });

  /** Subtle parallax tilt following the pointer across the panel. */
  protected readonly tiltT = computed(() => {
    if (REDUCED) return '';
    const { rx, ry } = this.tilt();
    return `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg)`;
  });

  protected onTilt(event: PointerEvent): void {
    if (REDUCED) return;
    const r = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const px = (event.clientX - r.left) / r.width;
    const py = (event.clientY - r.top) / r.height;
    this.tilt.set({ rx: (0.5 - py) * 5, ry: (px - 0.5) * 5 });
  }

  protected resetTilt(): void {
    this.tilt.set({ rx: 0, ry: 0 });
  }

  /* ------------------------------------------------------------- radar */

  protected axisPt(i: number): { x: number; y: number } {
    return radarPoint(i, 1);
  }

  /** Labels sit just outside their axis tip. */
  protected lblPt(i: number): { x: number; y: number } {
    const p = radarPoint(i, 1.22);
    return { x: p.x, y: p.y + 3 };
  }

  protected statPt(i: number, d: QuickDetail): { x: number; y: number } {
    const v = d.stats[STAT_ROWS[i].key];
    return radarPoint(i, Math.min(1, v / RADAR_MAX));
  }

  protected readonly radarShape = computed(() => {
    const d = this.detail();
    if (!d) return '';
    return STAT_ROWS.map((r, i) => {
      const p = radarPoint(i, Math.min(1, d.stats[r.key] / RADAR_MAX));
      return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    }).join(' ');
  });

  protected num = () => padId(this.entry().id);
  protected name = () => titleCase(this.entry().name);
  protected t1 = computed(() => typeColorVar(this.entry().types[0] ?? 'normal'));
  protected t2 = computed(() => typeColorVar(this.entry().types[1] ?? this.entry().types[0] ?? 'normal'));

  protected art = computed(() => {
    const d = this.detail();
    if (this.shiny()) return officialArtwork(this.entry().id, true);
    return d?.sprites.animatedFront ?? d?.sprites.default ?? this.entry().artwork;
  });

  /** Anchored, viewport-clamped position relative to the source tile. */
  protected pos = computed(() => {
    const r = this.rect();
    const w = 300;
    const h = 340;
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1024;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 768;
    let left = r.right + 12;
    if (left + w > vw - 8) left = r.left - w - 12;
    if (left < 8) left = Math.max(8, (vw - w) / 2);
    let top = r.top;
    if (top + h > vh - 8) top = Math.max(8, vh - h - 8);
    return { top: Math.max(8, top), left };
  });

  constructor() {
    effect(() => {
      const id = this.entry().id;
      this.detail.set(null);
      this.error.set(false);
      this.flipped.set(false);
      this.detailSvc.load(id).then(
        (d) => this.detail.set(d),
        () => this.error.set(true),
      );
    });
  }

  protected playCry(): void {
    this.cry.play(this.entry().id);
  }

  protected pct(v: number): number {
    return Math.min(100, (v / 180) * 100);
  }

  protected statColor(v: number): string {
    if (v >= 120) return 'linear-gradient(90deg,#56e39f,#6ce0ff)';
    if (v >= 90) return 'linear-gradient(90deg,#9be36b,#56e39f)';
    if (v >= 60) return 'linear-gradient(90deg,#ffd166,#9be36b)';
    if (v >= 40) return 'linear-gradient(90deg,#ff9d55,#ffd166)';
    return 'linear-gradient(90deg,#ff5d73,#ff9d55)';
  }

  protected abilities(d: QuickDetail): string {
    return d.abilities.map((a) => titleCase(a.name) + (a.isHidden ? ' (H)' : '')).join(', ');
  }

  protected onArtError(event: Event): void {
    const img = event.target as HTMLImageElement;
    const fallback = officialArtwork(this.entry().id, this.shiny());
    if (img.src !== fallback) img.src = fallback;
    this.loaded.set(true);
  }
}
