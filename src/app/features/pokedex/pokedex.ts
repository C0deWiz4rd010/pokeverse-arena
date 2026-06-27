import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { PokedexService } from './pokedex.service';
import { PokemonCardComponent, type QuickviewRequest } from './pokemon-card';
import { PokemonQuickviewComponent } from './pokemon-quickview';
import { SpinnerComponent } from '../../core/ui/spinner/spinner';
import { PageHeaderComponent } from '../../core/ui/page-header/page-header';
import { IconComponent } from '../../core/ui/icon/icon';
import { CryService } from '../../core/audio/cry.service';
import { POKEMON_TYPES, type PokemonType } from '../../core/utils/type-chart';
import { titleCase } from '../../core/ui/format';
import { asSort, asView, parseTypes, type DexSort, type DexView } from './pokedex-filter';

interface SortOption {
  readonly id: DexSort;
  readonly label: string;
}
const SORTS: SortOption[] = [
  { id: 'id', label: '# Lowest' },
  { id: 'id-desc', label: '# Highest' },
  { id: 'name', label: 'Name A–Z' },
  { id: 'gen', label: 'Generation' },
  { id: 'type', label: 'Type' },
  { id: 'fav', label: 'Favorites' },
  { id: 'random', label: 'Shuffle' },
];
const VIEWS: { id: DexView; label: string; glyph: string }[] = [
  { id: 'gallery', label: 'Gallery', glyph: '▦' },
  { id: 'compact', label: 'Compact', glyph: '▤' },
  { id: 'list', label: 'List', glyph: '☰' },
];

@Component({
  selector: 'pv-pokedex',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PokemonCardComponent,
    PokemonQuickviewComponent,
    SpinnerComponent,
    PageHeaderComponent,
    IconComponent,
  ],
  templateUrl: './pokedex.html',
  styleUrl: './pokedex.scss',
  host: {
    '(document:keydown.escape)': 'closeQuickview()',
    '(window:scroll)': 'closeQuickview()',
  },
})
export class PokedexComponent {
  protected readonly store = inject(PokedexService);
  protected readonly cry = inject(CryService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly types = POKEMON_TYPES;
  protected readonly generations = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  protected readonly sorts = SORTS;
  protected readonly views = VIEWS;
  protected readonly titleCase = titleCase;

  protected readonly quickview = signal<QuickviewRequest | null>(null);
  private restored = false;

  private readonly sentinel = viewChild<ElementRef<HTMLElement>>('sentinel');

  constructor() {
    void this.store.ensureLoaded();
    this.restoreFromUrl();
    afterNextRender(() => this.observeSentinel());
    // Keep the URL in sync with the live filter/sort/view state (shareable).
    effect(() => this.writeUrl());
  }

  protected onSearch(event: Event): void {
    this.store.setQuery((event.target as HTMLInputElement).value);
  }

  protected toggleType(type: PokemonType): void {
    this.store.toggleType(type);
  }

  protected onGeneration(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.store.setGeneration(value ? Number(value) : null);
  }

  protected onSort(event: Event): void {
    this.store.setSort(asSort((event.target as HTMLSelectElement).value));
  }

  protected setView(view: DexView): void {
    this.store.setView(view);
  }

  protected onFavorite(id: number): void {
    this.store.toggleFavorite(id);
  }

  protected clear(): void {
    this.store.clearFilters();
    const input = document.querySelector<HTMLInputElement>('.search input');
    if (input) input.value = '';
  }

  protected openQuickview(req: QuickviewRequest): void {
    this.quickview.set(req);
  }

  protected closeQuickview(): void {
    this.quickview.set(null);
  }

  /* ----------------------------------------------------------- url sync */

  private restoreFromUrl(): void {
    const p = this.route.snapshot.queryParamMap;
    if (p.get('q')) this.store.setQuery(p.get('q')!);
    for (const t of parseTypes(p.get('types'))) this.store.toggleType(t);
    if (p.get('mode') === 'and') this.store.setTypeMode('and');
    if (p.get('gen')) this.store.setGeneration(Number(p.get('gen')));
    if (p.get('sort')) this.store.setSort(asSort(p.get('sort')));
    if (p.get('view')) this.store.setView(asView(p.get('view')));
    if (p.get('shiny') === '1' && !this.store.shiny()) this.store.toggleShiny();
    if (p.get('fav') === '1') this.store.toggleFavOnly();
    this.restored = true;
  }

  private writeUrl(): void {
    // Touch every signal so the effect tracks them.
    const q = this.store.query();
    const types = [...this.store.typeFilters()];
    const mode = this.store.typeMode();
    const gen = this.store.generationFilter();
    const sort = this.store.sort();
    const view = this.store.view();
    const shiny = this.store.shiny();
    const fav = this.store.favOnly();
    if (!this.restored) return;
    const queryParams = {
      q: q || null,
      types: types.length ? types.join(',') : null,
      mode: mode === 'and' ? 'and' : null,
      gen: gen ?? null,
      sort: sort === 'id' ? null : sort,
      view: view === 'gallery' ? null : view,
      shiny: shiny ? '1' : null,
      fav: fav ? '1' : null,
    };
    void this.router.navigate([], { relativeTo: this.route, queryParams, replaceUrl: true });
  }

  private observeSentinel(): void {
    const el = this.sentinel()?.nativeElement;
    if (!el || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting) && this.store.hasMore()) {
        this.store.loadMore();
      }
    });
    io.observe(el);
  }
}
