import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { TypeBadgeComponent } from '../../core/ui/type-badge/type-badge';
import { PageHeaderComponent } from '../../core/ui/page-header/page-header';
import { IconComponent } from '../../core/ui/icon/icon';
import { titleCase, typeColorVar } from '../../core/ui/format';
import {
  POKEMON_TYPES,
  defensiveProfile,
  effectiveness,
  effectivenessLabel,
  singleEffectiveness,
  type PokemonType,
} from '../../core/utils/type-chart';

type Tab = 'matrix' | 'calculator' | 'defender';

interface ProfileBucket {
  readonly multiplier: number;
  readonly label: string;
  readonly types: PokemonType[];
}

@Component({
  selector: 'pv-type-lab',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TypeBadgeComponent, PageHeaderComponent, IconComponent],
  templateUrl: './type-lab.html',
  styleUrl: './type-lab.scss',
})
export class TypeLabComponent {
  protected readonly types = POKEMON_TYPES;
  protected readonly titleCase = titleCase;
  protected readonly typeColorVar = typeColorVar;

  protected readonly tab = signal<Tab>('matrix');

  /** Matrix interaction: highlighted attacking row / defending column. */
  protected readonly hoverAttacker = signal<PokemonType | null>(null);
  protected readonly hoverDefender = signal<PokemonType | null>(null);

  /** Calculator state. */
  protected readonly calcAttacker = signal<PokemonType>('fire');
  protected readonly calcDefenders = signal<PokemonType[]>(['grass']);

  /** Defender profile state. */
  protected readonly defenderTypes = signal<PokemonType[]>(['fire', 'flying']);

  protected readonly calcResult = computed(() => {
    const attacker = this.calcAttacker();
    const defenders = this.calcDefenders();
    const mult = defenders.length ? effectiveness(attacker, defenders) : 1;
    return { mult, label: effectivenessLabel(mult) };
  });

  /** Per-defender breakdown for the calculator (shows how each type contributes). */
  protected readonly calcBreakdown = computed(() =>
    this.calcDefenders().map((def) => ({
      type: def,
      mult: singleEffectiveness(this.calcAttacker(), def),
    })),
  );

  /** Defensive buckets grouped by multiplier, sorted strongest threat first. */
  protected readonly defenderBuckets = computed<ProfileBucket[]>(() => {
    const defenders = this.defenderTypes();
    if (!defenders.length) return [];
    const profile = defensiveProfile(defenders);
    const groups = new Map<number, PokemonType[]>();
    for (const attacker of POKEMON_TYPES) {
      const mult = profile[attacker];
      if (mult === 1) continue;
      const list = groups.get(mult) ?? [];
      list.push(attacker);
      groups.set(mult, list);
    }
    return [...groups.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([multiplier, list]) => ({
        multiplier,
        label: this.multLabel(multiplier),
        types: list,
      }));
  });

  protected setTab(tab: Tab): void {
    this.tab.set(tab);
  }

  protected cellMult(attacker: PokemonType, defender: PokemonType): number {
    return singleEffectiveness(attacker, defender);
  }

  protected cellClass(mult: number): string {
    if (mult === 0) return 'm0';
    if (mult === 0.5) return 'm05';
    if (mult === 2) return 'm2';
    return 'm1';
  }

  protected multLabel(mult: number): string {
    if (mult === 0) return 'Immune (0×)';
    if (mult === 0.25) return 'Doubly resists (¼×)';
    if (mult === 0.5) return 'Resists (½×)';
    if (mult === 2) return 'Weak (2×)';
    if (mult === 4) return 'Doubly weak (4×)';
    return `${mult}×`;
  }

  protected formatMult(mult: number): string {
    if (mult === 0.25) return '¼×';
    if (mult === 0.5) return '½×';
    return `${mult}×`;
  }

  protected setCalcAttacker(type: PokemonType): void {
    this.calcAttacker.set(type);
  }

  protected toggleCalcDefender(type: PokemonType): void {
    this.toggleIn(this.calcDefenders, type);
  }

  protected toggleDefenderType(type: PokemonType): void {
    this.toggleIn(this.defenderTypes, type);
  }

  private toggleIn(target: ReturnType<typeof signal<PokemonType[]>>, type: PokemonType): void {
    const current = target();
    if (current.includes(type)) {
      target.set(current.filter((t) => t !== type));
    } else if (current.length < 2) {
      target.set([...current, type]);
    } else {
      // Replace the oldest selection so a tap always does something useful.
      target.set([current[1], type]);
    }
  }
}
