import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { Location } from '@angular/common';
import { Router } from '@angular/router';
import { PokemonDetailService } from './pokemon-detail.service';
import { StatRadarComponent } from './stat-radar';
import { EvolutionTreeComponent } from './evolution-tree';
import { StatBarComponent } from '../../core/ui/stat-bar/stat-bar';
import { TypeBadgeComponent } from '../../core/ui/type-badge/type-badge';
import { SpinnerComponent } from '../../core/ui/spinner/spinner';
import { IconComponent } from '../../core/ui/icon/icon';
import { CryService } from '../../core/audio/cry.service';
import { PokedexService } from '../pokedex/pokedex.service';
import { TeamBuilderService } from '../team-builder/team-builder.service';
import { kgToLbs, metersToFeet, padId, titleCase } from '../../core/ui/format';
import { animatedSprite, officialArtwork } from '../../core/api/pokeapi-endpoints';
import { groupDefenses } from '../../core/utils/type-chart';
import { onSwipe } from '../../core/ui/gestures';
import { HapticsService } from '../../core/haptics/haptics.service';
import type { AbilityInfo, LearnableMove, MoveInfo, PokemonStats } from '../../core/models/pokemon.model';

type MoveTab = 'level-up' | 'machine' | 'egg' | 'tutor';

const ZERO_STATS: PokemonStats = {
  hp: 0, attack: 0, defense: 0, 'special-attack': 0, 'special-defense': 0, speed: 0,
};
const DEX_MAX = 1025;

@Component({
  selector: 'pv-pokemon-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    StatRadarComponent,
    EvolutionTreeComponent,
    StatBarComponent,
    TypeBadgeComponent,
    SpinnerComponent,
    IconComponent,
  ],
  templateUrl: './pokemon-detail.html',
  styleUrl: './pokemon-detail.scss',
  host: { '(document:keydown)': 'onKey($event)' },
})
export class PokemonDetailComponent {
  readonly id = input.required<string>();

  protected readonly store = inject(PokemonDetailService);
  protected readonly cry = inject(CryService);
  private readonly dex = inject(PokedexService);
  private readonly team = inject(TeamBuilderService);
  private readonly location = inject(Location);
  private readonly router = inject(Router);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly haptics = inject(HapticsService);

  protected readonly shiny = signal(false);
  protected readonly back = signal(false);
  protected readonly animated = signal(true);
  protected readonly sparkle = signal(0);
  protected readonly revealed = signal(false);
  protected readonly moveTab = signal<MoveTab>('level-up');
  protected readonly bstShown = signal(0);
  protected readonly addedToTeam = signal(false);

  /** Lazily-loaded ability/move detail, keyed by name. */
  protected readonly expandedAbility = signal<string | null>(null);
  protected readonly abilityInfo = signal<Record<string, AbilityInfo>>({});
  protected readonly expandedMove = signal<string | null>(null);
  protected readonly moveInfo = signal<Record<string, MoveInfo>>({});

  protected readonly titleCase = titleCase;
  protected readonly padId = padId;
  protected readonly metersToFeet = metersToFeet;
  protected readonly kgToLbs = kgToLbs;

  protected readonly statLabels: { key: keyof PokemonStats; name: string }[] = [
    { key: 'hp', name: 'HP' },
    { key: 'attack', name: 'Attack' },
    { key: 'defense', name: 'Defense' },
    { key: 'special-attack', name: 'Sp. Atk' },
    { key: 'special-defense', name: 'Sp. Def' },
    { key: 'speed', name: 'Speed' },
  ];

  protected readonly moveTabs: { id: MoveTab; label: string; method: string }[] = [
    { id: 'level-up', label: 'Level up', method: 'level-up' },
    { id: 'machine', label: 'TM/HM', method: 'machine' },
    { id: 'egg', label: 'Egg', method: 'egg' },
    { id: 'tutor', label: 'Tutor', method: 'tutor' },
  ];

  private readonly pokemon = computed(() => this.store.state()?.pokemon ?? null);
  protected readonly accent = computed(() => `var(--type-${this.pokemon()?.types[0] ?? 'normal'})`);
  protected readonly accent2 = computed(
    () => `var(--type-${this.pokemon()?.types[1] ?? this.pokemon()?.types[0] ?? 'normal'})`,
  );

  /** The current sprite to show, honouring animated / back / shiny toggles. */
  protected readonly spriteSrc = computed(() => {
    const p = this.pokemon();
    if (!p) return '';
    if (this.animated()) {
      if (this.back()) return p.sprites.animatedBack ?? animatedSprite(p.id) ;
      return this.shiny() ? animatedSprite(p.id, true) : (p.sprites.animatedFront ?? animatedSprite(p.id));
    }
    return this.shiny() ? p.sprites.shiny : p.sprites.default;
  });

  protected readonly hasAnimated = computed(() => !!this.pokemon()?.sprites.animatedFront);

  /** Stats fed to the bars/radar — zero until revealed so they animate up. */
  protected readonly shownStats = computed<PokemonStats>(() =>
    this.revealed() ? (this.pokemon()?.stats ?? ZERO_STATS) : ZERO_STATS,
  );
  protected readonly bestStat = computed(() => {
    const s = this.pokemon()?.stats;
    return s ? Math.max(...this.statLabels.map((l) => s[l.key])) : 0;
  });

  protected readonly matchups = computed(() => {
    const p = this.pokemon();
    return p ? groupDefenses(p.types) : null;
  });

  /** Gender split from the species gender-rate (eighths female; -1 genderless). */
  protected readonly gender = computed(() => {
    const rate = this.store.state()?.species.genderRate ?? -1;
    if (rate < 0) return null;
    const female = Math.round((rate / 8) * 100);
    return { female, male: 100 - female };
  });

  protected readonly prevId = computed(() => {
    const id = this.pokemon()?.id ?? 1;
    return id > 1 ? id - 1 : DEX_MAX;
  });
  protected readonly nextId = computed(() => {
    const id = this.pokemon()?.id ?? 1;
    return id < DEX_MAX ? id + 1 : 1;
  });

  protected readonly isFavorite = computed(() => {
    const p = this.pokemon();
    return p ? this.dex.isFavorite(p.id) : false;
  });
  protected readonly teamFull = computed(() => this.team.full());

  protected readonly visibleMoves = computed<LearnableMove[]>(() => {
    const moves = this.pokemon()?.moves ?? [];
    const method = this.moveTabs.find((t) => t.id === this.moveTab())?.method;
    return moves.filter((m) => m.method === method);
  });

  constructor() {
    effect(() => {
      const id = this.id();
      this.shiny.set(false);
      this.back.set(false);
      this.moveTab.set('level-up');
      this.revealed.set(false);
      this.addedToTeam.set(false);
      this.expandedAbility.set(null);
      this.expandedMove.set(null);
      void this.store.load(id.toLowerCase()).then(() => this.onLoaded());
    });

    // Swipe left → next entry, swipe right → previous (mirrors ←/→ keys).
    afterNextRender(() => {
      onSwipe(
        this.host.nativeElement,
        ({ dir }) => {
          if (dir === 'left') { this.haptics.fire('select'); this.go(this.nextId()); }
          else if (dir === 'right') { this.haptics.fire('select'); this.go(this.prevId()); }
        },
        { threshold: 60 },
      );
    });
  }

  private onLoaded(): void {
    // Trigger the stat-bar / radar grow-in on the next frame.
    setTimeout(() => this.revealed.set(true), 40);
    this.countUpBst();
    this.dex.ensureLoaded();
  }

  private countUpBst(): void {
    const target = this.pokemon()?.baseStatTotal ?? 0;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / 700);
      this.bstShown.set(Math.round(target * (1 - Math.pow(1 - t, 3))));
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  protected toggleShiny(): void {
    this.shiny.update((v) => !v);
    if (this.shiny()) {
      this.sparkle.update((n) => n + 1);
      const p = this.pokemon();
      if (p) this.cry.play(p.id);
    }
  }

  protected toggleBack(): void {
    this.back.update((v) => !v);
  }

  protected toggleAnimated(): void {
    this.animated.update((v) => !v);
  }

  protected playCry(): void {
    const p = this.pokemon();
    if (p) this.cry.play(p.id);
  }

  protected toggleFavorite(): void {
    const p = this.pokemon();
    if (p) this.dex.toggleFavorite(p.id);
  }

  protected async addToTeam(): Promise<void> {
    const p = this.pokemon();
    if (!p || this.team.full()) return;
    await this.team.add(p.name);
    this.addedToTeam.set(true);
  }

  protected toggleAbility(name: string): void {
    if (this.expandedAbility() === name) {
      this.expandedAbility.set(null);
      return;
    }
    this.expandedAbility.set(name);
    if (!this.abilityInfo()[name]) {
      void this.store.ability(name).then((info) =>
        this.abilityInfo.update((m) => ({ ...m, [name]: info })),
      );
    }
  }

  protected toggleMove(name: string): void {
    if (this.expandedMove() === name) {
      this.expandedMove.set(null);
      return;
    }
    this.expandedMove.set(name);
    if (!this.moveInfo()[name]) {
      void this.store.move(name).then((info) =>
        this.moveInfo.update((m) => ({ ...m, [name]: info })),
      );
    }
  }

  protected go(id: number): void {
    void this.router.navigate(['/pokemon', id]);
  }

  protected goBack(): void {
    this.location.back();
  }

  protected onKey(event: KeyboardEvent): void {
    const tag = (event.target as HTMLElement).tagName;
    if (/^(INPUT|SELECT|TEXTAREA)$/.test(tag)) return;
    if (event.key === 'ArrowLeft') this.go(this.prevId());
    else if (event.key === 'ArrowRight') this.go(this.nextId());
    else if (event.key === 's') this.toggleShiny();
  }

  protected onSpriteError(event: Event): void {
    const img = event.target as HTMLImageElement;
    const p = this.pokemon();
    if (!p) return;
    const fb = this.shiny() ? officialArtwork(p.id, true) : officialArtwork(p.id);
    if (img.src !== fb) {
      img.src = fb;
      this.animated.set(false);
    }
  }
}
