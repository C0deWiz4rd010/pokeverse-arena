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
import { PokemonCompareComponent } from './pokemon-compare';
import { WhosThatComponent } from './whos-that';
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
    PokemonCompareComponent,
    WhosThatComponent,
    PageHeaderComponent,
    IconComponent,
  ],
  templateUrl: './pokedex.html',
  styleUrl: './pokedex.scss',
  host: {
    '(document:keydown.escape)': 'closeQuickview()',
    '(document:keydown)': 'onKey($event)',
    '(window:scroll)': 'onScroll()',
  },
})
export class PokedexComponent {
  protected readonly store = inject(PokedexService);
  protected readonly cry = inject(CryService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly types = POKEMON_TYPES;

  /** Show the back-to-top FAB once the list has scrolled a couple of screens. */
  protected readonly showTop = signal(false);

  protected onScroll(): void {
    this.closeQuickview();
    this.showTop.set(window.scrollY > 900);
  }

  protected scrollTop(): void {
    const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
  }
  protected readonly generations = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  /** Placeholder cards shown while the index loads (shimmer skeleton). */
  protected readonly skeletons = Array.from({ length: 12 });
  protected readonly sorts = SORTS;
  protected readonly views = VIEWS;
  protected readonly titleCase = titleCase;

  protected readonly quickview = signal<QuickviewRequest | null>(null);
  protected readonly showCompare = signal(false);
  protected readonly showGame = signal(false);
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

  protected onCompareToggle(id: number): void {
    this.store.toggleCompare(id);
  }

  protected openCompare(): void {
    if (this.store.canCompare()) this.showCompare.set(true);
  }

  protected closeCompare(): void {
    this.showCompare.set(false);
  }

  protected removeCompare(id: number): void {
    this.store.toggleCompare(id);
    if (!this.store.canCompare()) this.showCompare.set(false);
  }

  protected openGame(): void {
    this.showGame.set(true);
  }

  protected closeGame(): void {
    this.showGame.set(false);
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

  /* ------------------------------------------------------- keyboard nav */

  protected onKey(event: KeyboardEvent): void {
    const target = event.target as HTMLElement;
    const typing = /^(INPUT|SELECT|TEXTAREA)$/.test(target.tagName);
    if (event.key === '/' && !typing) {
      event.preventDefault();
      document.querySelector<HTMLInputElement>('.search input')?.focus();
      return;
    }
    if (typing || event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key === 's') {
      this.store.toggleShiny();
      return;
    }
    const cards = Array.from(document.querySelectorAll<HTMLElement>('.grid .card'));
    if (!cards.length) return;
    const current = (document.activeElement as HTMLElement | null)?.closest('.card') as HTMLElement | null;
    const i = current ? cards.indexOf(current) : -1;
    if (event.key === 'f' && current) {
      const id = Number(current.dataset['id']);
      if (id) this.store.toggleFavorite(id);
      return;
    }
    const cols = this.columns(cards);
    let next = i;
    switch (event.key) {
      case 'ArrowRight': next = i + 1; break;
      case 'ArrowLeft': next = i - 1; break;
      case 'ArrowDown': next = i + cols; break;
      case 'ArrowUp': next = i - cols; break;
      default: return;
    }
    event.preventDefault();
    if (i === -1) next = 0;
    cards[Math.max(0, Math.min(cards.length - 1, next))]?.focus();
  }

  /** How many cards sit in the first row (for up/down arrow steps). */
  private columns(cards: HTMLElement[]): number {
    if (cards.length < 2) return 1;
    const top = cards[0].offsetTop;
    let c = 1;
    while (c < cards.length && cards[c].offsetTop === top) c++;
    return c;
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
