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
import { padId, titleCase } from '../../core/ui/format';
import { officialArtwork } from '../../core/api/pokeapi-endpoints';
import { defensiveProfile, POKEMON_TYPES, type PokemonType } from '../../core/utils/type-chart';
import type { StatKey } from '../../core/utils/stat-calculator';

const STAT_ROWS: { key: StatKey; label: string }[] = [
  { key: 'hp', label: 'HP' },
  { key: 'attack', label: 'Attack' },
  { key: 'defense', label: 'Defense' },
  { key: 'special-attack', label: 'Sp. Atk' },
  { key: 'special-defense', label: 'Sp. Def' },
  { key: 'speed', label: 'Speed' },
];

/** Side-by-side comparison overlay for 2–4 Pokémon. */
@Component({
  selector: 'pv-pokemon-compare',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TypeBadgeComponent, IconComponent],
  template: `
    <div class="backdrop" (click)="close.emit()"></div>
    <div class="panel" role="dialog" aria-label="Compare Pokémon">
      <header class="head">
        <h2>Compare</h2>
        <button class="x" type="button" (click)="close.emit()" aria-label="Close"><pv-icon name="x" /></button>
      </header>

      @if (!mons().length) {
        <p class="loading">Loading…</p>
      } @else {
        <div class="table" [style.--cols]="mons().length">
          <!-- header row -->
          <div class="corner"></div>
          @for (m of mons(); track m.id) {
            <div class="mon-head">
              <button class="rm" type="button" (click)="removeId.emit(m.id)" aria-label="Remove"><pv-icon name="x" /></button>
              <a [routerLink]="['/pokemon', m.id]"><img [src]="art(m)" [alt]="m.name" /></a>
              <strong>{{ titleCase(m.name) }}</strong>
              <span class="num">{{ padId(m.id) }}</span>
              <div class="types">@for (t of m.types; track t) { <pv-type-badge [type]="t" /> }</div>
            </div>
          }

          <!-- stat rows -->
          @for (r of statRows; track r.key) {
            <div class="row-label">{{ r.label }}</div>
            @for (m of mons(); track m.id) {
              <div class="cell" [class.best]="m.stats[r.key] === maxStat(r.key)">
                <span class="v">{{ m.stats[r.key] }}</span>
                <span class="bar"><span class="fill" [style.width.%]="pct(m.stats[r.key])"></span></span>
              </div>
            }
          }

          <!-- BST -->
          <div class="row-label bst">BST</div>
          @for (m of mons(); track m.id) {
            <div class="cell bst" [class.best]="m.baseStatTotal === maxBst()"><strong>{{ m.baseStatTotal }}</strong></div>
          }

          <!-- weaknesses -->
          <div class="row-label">Weak to</div>
          @for (m of mons(); track m.id) {
            <div class="cell weak">
              @for (t of weaknesses(m); track t) { <pv-type-badge [type]="t" /> }
            </div>
          }
        </div>
      }
    </div>
  `,
  styleUrl: './pokemon-compare.scss',
})
export class PokemonCompareComponent {
  readonly ids = input.required<number[]>();
  readonly shiny = input<boolean>(false);
  readonly close = output<void>();
  readonly removeId = output<number>();

  private readonly detailSvc = inject(PokedexDetailService);
  protected readonly statRows = STAT_ROWS;
  protected readonly titleCase = titleCase;
  protected readonly padId = padId;

  protected readonly mons = signal<QuickDetail[]>([]);

  constructor() {
    effect(() => {
      const ids = this.ids();
      Promise.all(ids.map((id) => this.detailSvc.load(id).catch(() => null))).then((list) =>
        this.mons.set(list.filter((m): m is QuickDetail => m !== null)),
      );
    });
  }

  protected art(m: QuickDetail): string {
    return this.shiny() ? officialArtwork(m.id, true) : m.sprites.default;
  }

  protected pct(v: number): number {
    return Math.min(100, (v / 200) * 100);
  }

  protected maxStat(key: StatKey): number {
    return Math.max(...this.mons().map((m) => m.stats[key]), 0);
  }

  protected maxBst = computed(() => Math.max(...this.mons().map((m) => m.baseStatTotal), 0));

  protected weaknesses(m: QuickDetail): PokemonType[] {
    const profile = defensiveProfile(m.types);
    return POKEMON_TYPES.filter((t) => profile[t] > 1);
  }
}
