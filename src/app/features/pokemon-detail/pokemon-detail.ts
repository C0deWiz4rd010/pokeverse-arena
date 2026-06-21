import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { Location } from '@angular/common';
import { PokemonDetailService } from './pokemon-detail.service';
import { StatRadarComponent } from './stat-radar';
import { EvolutionTreeComponent } from './evolution-tree';
import { StatBarComponent } from '../../core/ui/stat-bar/stat-bar';
import { TypeBadgeComponent } from '../../core/ui/type-badge/type-badge';
import { SpinnerComponent } from '../../core/ui/spinner/spinner';
import { IconComponent } from '../../core/ui/icon/icon';
import { kgToLbs, metersToFeet, padId, titleCase } from '../../core/ui/format';
import type { LearnableMove } from '../../core/models/pokemon.model';

type MoveTab = 'level-up' | 'machine' | 'egg' | 'tutor';

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
})
export class PokemonDetailComponent {
  /** Bound from the `pokemon/:id` route param. */
  readonly id = input.required<string>();

  protected readonly store = inject(PokemonDetailService);
  private readonly location = inject(Location);

  protected readonly shiny = signal(false);
  protected readonly moveTab = signal<MoveTab>('level-up');
  protected readonly titleCase = titleCase;
  protected readonly padId = padId;
  protected readonly metersToFeet = metersToFeet;
  protected readonly kgToLbs = kgToLbs;

  protected readonly statLabels: { key: keyof typeof STAT_NAMES; name: string }[] = Object.entries(
    STAT_NAMES,
  ).map(([key, name]) => ({ key: key as keyof typeof STAT_NAMES, name }));

  protected readonly moveTabs: { id: MoveTab; label: string; method: string }[] = [
    { id: 'level-up', label: 'Level up', method: 'level-up' },
    { id: 'machine', label: 'TM/HM', method: 'machine' },
    { id: 'egg', label: 'Egg', method: 'egg' },
    { id: 'tutor', label: 'Tutor', method: 'tutor' },
  ];

  protected readonly artwork = computed(() => {
    const p = this.store.state()?.pokemon;
    if (!p) return '';
    return this.shiny() ? p.sprites.shiny : p.sprites.default;
  });

  protected readonly visibleMoves = computed<LearnableMove[]>(() => {
    const moves = this.store.state()?.pokemon.moves ?? [];
    const method = this.moveTabs.find((t) => t.id === this.moveTab())?.method;
    return moves.filter((m) => m.method === method);
  });

  constructor() {
    // Reload whenever the route id changes (e.g. navigating between evolutions).
    effect(() => {
      const id = this.id();
      this.shiny.set(false);
      this.moveTab.set('level-up');
      void this.store.load(id.toLowerCase());
    });
  }

  protected toggleShiny(): void {
    this.shiny.update((v) => !v);
  }

  protected playCry(): void {
    const cry = this.store.state()?.pokemon.cry;
    if (!cry) return;
    const audio = new Audio(cry);
    audio.volume = 0.4;
    void audio.play().catch(() => undefined);
  }

  protected goBack(): void {
    this.location.back();
  }

  protected statName(key: string): string {
    return STAT_NAMES[key as keyof typeof STAT_NAMES] ?? key;
  }
}

const STAT_NAMES = {
  hp: 'HP',
  attack: 'Attack',
  defense: 'Defense',
  'special-attack': 'Sp. Atk',
  'special-defense': 'Sp. Def',
  speed: 'Speed',
} as const;
