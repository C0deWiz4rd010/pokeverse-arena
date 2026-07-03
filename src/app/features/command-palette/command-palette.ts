import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { IconComponent } from '../../core/ui/icon/icon';
import type { IconName } from '../../core/ui/icon/icons.data';
import { SPRITE_BASE } from '../../core/api/pokeapi-endpoints';
import { titleCase } from '../../core/ui/format';
import { PokedexService } from '../pokedex/pokedex.service';

/** One executable row in the palette (page link, action or Pokémon hit). */
interface PaletteItem {
  readonly key: string;
  readonly label: string;
  readonly hint?: string;
  readonly icon?: IconName;
  readonly sprite?: string;
  readonly run: () => void;
}

interface PaletteGroup {
  readonly title: string;
  readonly items: PaletteItem[];
}

interface PageCmd {
  readonly path: string;
  readonly label: string;
  readonly icon: IconName;
  readonly hint: string;
  /** Extra search words so e.g. "fight" finds Battle. */
  readonly keywords: string;
}

const PAGES: PageCmd[] = [
  { path: '/', label: 'Home', icon: 'zap', hint: 'Landing & progress', keywords: 'start home landing' },
  { path: '/pokedex', label: 'Pokédex', icon: 'book', hint: 'Browse & filter all Pokémon', keywords: 'dex search browse list' },
  { path: '/type-lab', label: 'Type Lab', icon: 'flask-conical', hint: 'Type chart & matchup calculator', keywords: 'effectiveness weakness chart' },
  { path: '/team-builder', label: 'Team Builder', icon: 'wrench', hint: 'Build & export teams', keywords: 'team moves nature build' },
  { path: '/battle', label: 'Battle', icon: 'swords', hint: 'Seeded 1v1 battles', keywords: 'fight duel versus' },
  { path: '/arena', label: 'Arena', icon: 'castle', hint: 'Gym leaders & badges', keywords: 'gym badge leader champion' },
  { path: '/tournaments', label: 'Tournaments', icon: 'trophy', hint: 'Brackets & standings', keywords: 'bracket cup elimination' },
  { path: '/spire', label: 'Ascension Spire', icon: 'mountain', hint: 'Roguelike climb', keywords: 'roguelike relic climb tower' },
  { path: '/world', label: 'World Explorer', icon: 'map', hint: 'Regions & expeditions', keywords: 'region kanto expedition catch' },
  { path: '/contest', label: 'Contest Hall', icon: 'sparkles', hint: 'Poffins & appeal rounds', keywords: 'berry poffin beauty' },
  { path: '/adventure', label: 'Adventure', icon: 'scroll-text', hint: 'Top-down RPG story', keywords: 'rpg story overworld quest' },
  { path: '/profile', label: 'Trainer Profile', icon: 'crown', hint: 'Stats, saves & identity', keywords: 'trainer save stats' },
];

const MAX_POKEMON_HITS = 8;

/**
 * Global ⌘K / Ctrl+K command palette: jump to any page, run quick actions or
 * fuzzy-find a Pokémon by name/number. Opened by the shell (`open` input);
 * fully keyboard-driven (arrows + Enter, Escape closes).
 */
@Component({
  selector: 'pv-command-palette',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  templateUrl: './command-palette.html',
  styleUrl: './command-palette.scss',
})
export class CommandPaletteComponent {
  private readonly router = inject(Router);
  private readonly dex = inject(PokedexService);

  readonly open = input.required<boolean>();
  readonly closed = output<void>();

  protected readonly query = signal('');
  protected readonly selected = signal(0);
  private readonly inputEl = viewChild<ElementRef<HTMLInputElement>>('queryInput');

  constructor() {
    effect(() => {
      if (!this.open()) return;
      // Fresh state each time it opens; warm the dex index for Pokémon search.
      this.query.set('');
      this.selected.set(0);
      void this.dex.ensureLoaded();
      setTimeout(() => this.inputEl()?.nativeElement.focus());
    });
  }

  protected readonly groups = computed<PaletteGroup[]>(() => {
    const q = this.query().trim().toLowerCase();
    const groups: PaletteGroup[] = [];

    const pages = PAGES.filter(
      (p) => !q || p.label.toLowerCase().includes(q) || p.keywords.includes(q),
    ).map<PaletteItem>((p) => ({
      key: 'page:' + p.path,
      label: p.label,
      hint: p.hint,
      icon: p.icon,
      run: () => void this.router.navigateByUrl(p.path),
    }));
    if (pages.length) groups.push({ title: 'Go to', items: pages });

    const actions = this.actionItems().filter((a) => !q || a.label.toLowerCase().includes(q));
    if (actions.length) groups.push({ title: 'Actions', items: actions });

    if (q.length >= 2) {
      const hits = this.searchPokemon(q);
      if (hits.length) groups.push({ title: 'Pokémon', items: hits });
    }
    return groups;
  });

  /** Groups flattened in render order — what the arrow keys walk over. */
  protected readonly flat = computed<PaletteItem[]>(() => this.groups().flatMap((g) => g.items));

  protected indexOf(item: PaletteItem): number {
    return this.flat().indexOf(item);
  }

  private actionItems(): PaletteItem[] {
    return [
      {
        key: 'act:random',
        label: 'Surprise me — random Pokémon',
        hint: 'Opens a random detail page',
        icon: 'dices',
        run: () => void this.router.navigate(['/pokemon', 1 + Math.floor(Math.random() * 1025)]),
      },
      {
        key: 'act:shiny',
        label: this.dex.shiny() ? 'Disable shiny sprites' : 'Enable shiny sprites',
        hint: 'Pokédex artwork mode',
        icon: 'sparkles',
        run: () => this.dex.toggleShiny(),
      },
      {
        key: 'act:favs',
        label: 'Show my favorites',
        hint: 'Pokédex filtered to ♥',
        icon: 'heart',
        run: () => void this.router.navigate(['/pokedex'], { queryParams: { fav: '1' } }),
      },
    ];
  }

  private searchPokemon(q: string): PaletteItem[] {
    const num = Number(q.replace(/^#/, ''));
    const entries = this.dex.entries();
    const starts: PaletteItem[] = [];
    const contains: PaletteItem[] = [];
    for (const e of entries) {
      const isNum = Number.isInteger(num) && num > 0 && e.id === num;
      const at = isNum ? 0 : e.name.indexOf(q);
      if (at < 0) continue;
      const item: PaletteItem = {
        key: 'mon:' + e.id,
        label: titleCase(e.name),
        hint: '#' + e.id + (e.types.length ? ' · ' + e.types.map(titleCase).join(' / ') : ''),
        sprite: `${SPRITE_BASE}/pokemon/${e.id}.png`,
        run: () => void this.router.navigate(['/pokemon', e.id]),
      };
      (at === 0 ? starts : contains).push(item);
      if (starts.length >= MAX_POKEMON_HITS) break;
    }
    return [...starts, ...contains].slice(0, MAX_POKEMON_HITS);
  }

  /* ------------------------------------------------------------ events */

  protected onInput(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
    this.selected.set(0);
  }

  protected onKeydown(event: KeyboardEvent): void {
    const items = this.flat();
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.move(1, items.length);
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.move(-1, items.length);
        break;
      case 'Enter':
        event.preventDefault();
        this.execute(items[this.selected()]);
        break;
      case 'Escape':
        event.preventDefault();
        this.close();
        break;
    }
  }

  private move(step: number, len: number): void {
    if (!len) return;
    const next = (this.selected() + step + len) % len;
    this.selected.set(next);
    document.getElementById('cmd-opt-' + next)?.scrollIntoView({ block: 'nearest' });
  }

  protected execute(item: PaletteItem | undefined): void {
    if (!item) return;
    this.close();
    item.run();
  }

  protected hover(item: PaletteItem): void {
    const i = this.indexOf(item);
    if (i >= 0) this.selected.set(i);
  }

  protected close(): void {
    this.closed.emit();
  }
}
