import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { TypeBadgeComponent } from '../../core/ui/type-badge/type-badge';
import { PageHeaderComponent } from '../../core/ui/page-header/page-header';
import { IconComponent } from '../../core/ui/icon/icon';
import { titleCase, typeColorVar } from '../../core/ui/format';
import {
  POKEMON_TYPES,
  analyzeTeamTypes,
  defensiveProfile,
  effectiveness,
  effectivenessLabel,
  offensiveCoverage,
  offensiveProfile,
  singleEffectiveness,
  type PokemonType,
  type TeamMemberTyping,
} from '../../core/utils/type-chart';

type Tab = 'matrix' | 'calculator' | 'defender' | 'team';

interface TeamDefenseRow {
  readonly type: PokemonType;
  readonly weak: number;
  readonly resist: number;
  readonly uncovered: boolean;
}

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

  /** Matrix interaction: highlighted (hover) and pinned (click) row / column. */
  protected readonly hoverAttacker = signal<PokemonType | null>(null);
  protected readonly hoverDefender = signal<PokemonType | null>(null);
  protected readonly pinnedAttacker = signal<PokemonType | null>(null);
  protected readonly pinnedDefender = signal<PokemonType | null>(null);

  protected readonly activeAtk = computed(() => this.hoverAttacker() ?? this.pinnedAttacker());
  protected readonly activeDef = computed(() => this.hoverDefender() ?? this.pinnedDefender());

  /** Big live readout when both an attacker and defender are active. */
  protected readonly readout = computed(() => {
    const atk = this.activeAtk();
    const def = this.activeDef();
    if (!atk || !def) return null;
    const mult = singleEffectiveness(atk, def);
    return { atk, def, mult, label: this.offenseLabel(mult) };
  });

  /** Chart explorer (mobile): the single type whose matchups are shown. */
  protected readonly focusType = signal<PokemonType>('fire');

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

  /** Calculator — what the chosen attacking type hits, grouped by multiplier. */
  protected readonly calcOffense = computed<ProfileBucket[]>(() =>
    this.bucketize(offensiveProfile(this.calcAttacker()), (m) => this.offenseLabel(m)),
  );

  /* ----- team coverage analyzer ----- */
  protected readonly teamMembers = signal<TeamMemberTyping[]>([
    { name: '', types: ['fire'] },
    { name: '', types: ['water'] },
    { name: '', types: ['grass'] },
  ]);
  /** The 1–2 types currently being assembled into a new member. */
  protected readonly build = signal<PokemonType[]>([]);

  protected readonly teamAnalysis = computed(() => analyzeTeamTypes(this.teamMembers()));
  protected readonly teamOffense = computed(() => offensiveCoverage(this.teamMembers()));

  /** Per-attacking-type defensive tally for the team heatmap. */
  protected readonly teamDefense = computed<TeamDefenseRow[]>(() => {
    const a = this.teamAnalysis();
    return POKEMON_TYPES.map((type) => ({
      type,
      weak: a.weaknesses[type],
      resist: a.resistances[type],
      uncovered: a.weaknesses[type] > 0 && a.resistances[type] === 0,
    }));
  });

  protected readonly teamScore = computed(() => {
    const uncovered = this.teamAnalysis().uncovered.length;
    const gaps = this.teamOffense().gaps.length;
    const score = Math.max(0, 100 - uncovered * 9 - gaps * 4);
    const grade = score >= 85 ? 'S' : score >= 70 ? 'A' : score >= 55 ? 'B' : score >= 40 ? 'C' : 'D';
    return { score, grade, uncovered, gaps };
  });

  /** Chart explorer — what the focused type does on offense, grouped by multiplier. */
  protected readonly focusOffense = computed<ProfileBucket[]>(() =>
    this.bucketize(offensiveProfile(this.focusType()), (m) => this.offenseLabel(m)),
  );

  /** Chart explorer — how the focused type fares on defense, grouped by multiplier. */
  protected readonly focusDefense = computed<ProfileBucket[]>(() =>
    this.bucketize(defensiveProfile([this.focusType()]), (m) => this.multLabel(m)),
  );

  /** Defensive buckets grouped by multiplier, sorted strongest threat first. */
  protected readonly defenderBuckets = computed<ProfileBucket[]>(() => {
    const defenders = this.defenderTypes();
    if (!defenders.length) return [];
    return this.bucketize(defensiveProfile(defenders), (m) => this.multLabel(m));
  });

  /** Groups a type profile into multiplier buckets (skipping neutral), strongest first. */
  private bucketize(
    profile: Record<PokemonType, number>,
    label: (mult: number) => string,
  ): ProfileBucket[] {
    const groups = new Map<number, PokemonType[]>();
    for (const type of POKEMON_TYPES) {
      const mult = profile[type];
      if (mult === 1) continue;
      const list = groups.get(mult) ?? [];
      list.push(type);
      groups.set(mult, list);
    }
    return [...groups.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([multiplier, list]) => ({ multiplier, label: label(multiplier), types: list }));
  }

  protected setTab(tab: Tab): void {
    this.tab.set(tab);
  }

  protected setFocusType(type: PokemonType): void {
    this.focusType.set(type);
  }

  /* ----- matrix pinning ----- */
  protected pinAttacker(type: PokemonType): void {
    this.pinnedAttacker.set(this.pinnedAttacker() === type ? null : type);
  }
  protected pinDefender(type: PokemonType): void {
    this.pinnedDefender.set(this.pinnedDefender() === type ? null : type);
  }
  protected pinCell(atk: PokemonType, def: PokemonType): void {
    const same = this.pinnedAttacker() === atk && this.pinnedDefender() === def;
    this.pinnedAttacker.set(same ? null : atk);
    this.pinnedDefender.set(same ? null : def);
  }
  protected clearPins(): void {
    this.pinnedAttacker.set(null);
    this.pinnedDefender.set(null);
  }
  protected get hasPins(): boolean {
    return this.pinnedAttacker() !== null || this.pinnedDefender() !== null;
  }

  /* ----- team builder ----- */
  protected toggleBuild(type: PokemonType): void {
    const cur = this.build();
    if (cur.includes(type)) this.build.set(cur.filter((t) => t !== type));
    else if (cur.length < 2) this.build.set([...cur, type]);
    else this.build.set([cur[1], type]);
  }
  protected addMember(): void {
    const types = this.build();
    if (!types.length || this.teamMembers().length >= 6) return;
    this.teamMembers.update((m) => [...m, { name: '', types: [...types] }]);
    this.build.set([]);
  }
  protected removeMember(index: number): void {
    this.teamMembers.update((m) => m.filter((_, i) => i !== index));
  }
  protected clearTeam(): void {
    this.teamMembers.set([]);
    this.build.set([]);
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

  /** Multiplier label phrased from the attacker's point of view. */
  protected offenseLabel(mult: number): string {
    if (mult === 0) return 'No effect (0×)';
    if (mult === 0.5) return 'Not very effective (½×)';
    if (mult === 2) return 'Super effective (2×)';
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
