import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { PokedexService } from './pokedex.service';
import { PokemonCardComponent, type QuickviewRequest } from './pokemon-card';
import { PokemonQuickviewComponent } from './pokemon-quickview';
import { SpinnerComponent } from '../../core/ui/spinner/spinner';
import { PageHeaderComponent } from '../../core/ui/page-header/page-header';
import { IconComponent } from '../../core/ui/icon/icon';
import { CryService } from '../../core/audio/cry.service';
import { POKEMON_TYPES, type PokemonType } from '../../core/utils/type-chart';
import { titleCase } from '../../core/ui/format';

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
  protected readonly types = POKEMON_TYPES;
  protected readonly generations = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  protected readonly titleCase = titleCase;

  protected readonly quickview = signal<QuickviewRequest | null>(null);

  private readonly sentinel = viewChild<ElementRef<HTMLElement>>('sentinel');

  constructor() {
    void this.store.ensureLoaded();
    afterNextRender(() => this.observeSentinel());
  }

  protected onSearch(event: Event): void {
    this.store.setQuery((event.target as HTMLInputElement).value);
  }

  protected onType(type: PokemonType): void {
    void this.store.setTypeFilter(this.store.typeFilter() === type ? null : type);
  }

  protected onGeneration(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    void this.store.setGenerationFilter(value ? Number(value) : null);
  }

  protected clear(): void {
    void this.store.clearFilters();
    const input = document.querySelector<HTMLInputElement>('.search input');
    if (input) input.value = '';
  }

  protected openQuickview(req: QuickviewRequest): void {
    this.quickview.set(req);
  }

  protected closeQuickview(): void {
    this.quickview.set(null);
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
