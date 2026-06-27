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

/** A lazy, anchored quick-view popover for a Pokédex entry. */
@Component({
  selector: 'pv-pokemon-quickview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TypeBadgeComponent, IconComponent],
  template: `
    <div class="backdrop" (click)="close.emit()"></div>
    <div class="panel" [style.--t1]="t1()" [style.--t2]="t2()" [style.top.px]="pos().top" [style.left.px]="pos().left" role="dialog">
      <button class="x" type="button" (click)="close.emit()" aria-label="Close"><pv-icon name="x" /></button>

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
