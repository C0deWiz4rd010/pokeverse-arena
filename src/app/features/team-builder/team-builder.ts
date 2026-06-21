import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TeamBuilderService, MAX_TEAM, MAX_MOVES, type TeamMember } from './team-builder.service';
import { PokedexService } from '../pokedex/pokedex.service';
import { TypeBadgeComponent } from '../../core/ui/type-badge/type-badge';
import { SpinnerComponent } from '../../core/ui/spinner/spinner';
import { PageHeaderComponent } from '../../core/ui/page-header/page-header';
import { IconComponent } from '../../core/ui/icon/icon';
import { titleCase, typeColorVar } from '../../core/ui/format';
import { POKEMON_TYPES, type PokemonType } from '../../core/utils/type-chart';
import { NATURES, natureByName, natureSummary } from '../../core/utils/natures';
import type { StatKey } from '../../core/utils/stat-calculator';

const STAT_ROWS: { key: StatKey; label: string }[] = [
  { key: 'hp', label: 'HP' },
  { key: 'attack', label: 'Atk' },
  { key: 'defense', label: 'Def' },
  { key: 'special-attack', label: 'SpA' },
  { key: 'special-defense', label: 'SpD' },
  { key: 'speed', label: 'Spe' },
];

const GENERATIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

@Component({
  selector: 'pv-team-builder',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TypeBadgeComponent, SpinnerComponent, PageHeaderComponent, IconComponent],
  templateUrl: './team-builder.html',
  styleUrl: './team-builder.scss',
})
export class TeamBuilderComponent {
  protected readonly store = inject(TeamBuilderService);
  private readonly pokedex = inject(PokedexService);

  protected readonly MAX_TEAM = MAX_TEAM;
  protected readonly MAX_MOVES = MAX_MOVES;
  protected readonly types = POKEMON_TYPES;
  protected readonly generations = GENERATIONS;
  protected readonly natures = NATURES;
  protected readonly statRows = STAT_ROWS;
  protected readonly titleCase = titleCase;
  protected readonly typeColorVar = typeColorVar;
  protected readonly natureSummary = natureSummary;

  protected readonly query = signal('');
  protected readonly importText = signal('');
  protected readonly showImport = signal(false);
  protected readonly copied = signal(false);

  protected readonly names = this.pokedex.names;

  /** Attacking types at least one member is weak to and nobody resists. */
  protected readonly blindSpots = computed(() => this.store.analysis().uncovered);

  /** Sorted shared-weakness rows (most exposed first), only where count > 0. */
  protected readonly weaknessRows = computed(() => {
    const w = this.store.analysis().weaknesses;
    return POKEMON_TYPES.map((t) => ({ type: t, count: w[t] }))
      .filter((r) => r.count > 0)
      .sort((a, b) => b.count - a.count);
  });

  constructor() {
    void this.pokedex.ensureLoaded();
  }

  protected onSubmit(event: Event): void {
    event.preventDefault();
    const value = this.query();
    if (!value.trim()) return;
    void this.store.add(value).then(() => {
      if (!this.store.error()) this.query.set('');
    });
  }

  protected statsFor(member: TeamMember): { key: StatKey; label: string; value: number }[] {
    const stats = this.store.memberStats().get(member.uid);
    return STAT_ROWS.map((r) => ({ ...r, value: stats?.[r.key] ?? 0 }));
  }

  protected natureMod(member: TeamMember, key: StatKey): 'up' | 'down' | '' {
    const nat = natureByName(member.natureName);
    if (nat.increased === key) return 'up';
    if (nat.decreased === key) return 'down';
    return '';
  }

  protected onNickname(member: TeamMember, event: Event): void {
    this.store.patch(member.uid, { nickname: (event.target as HTMLInputElement).value });
  }

  protected onLevel(member: TeamMember, event: Event): void {
    this.store.patch(member.uid, { level: Number((event.target as HTMLInputElement).value) });
  }

  protected onNature(member: TeamMember, event: Event): void {
    this.store.patch(member.uid, { natureName: (event.target as HTMLSelectElement).value });
  }

  protected onAbility(member: TeamMember, event: Event): void {
    this.store.patch(member.uid, { ability: (event.target as HTMLSelectElement).value });
  }

  protected exportTeam(): void {
    const json = this.store.exportJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pokeverse-team.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  protected async copyTeam(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.store.exportJson());
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 1500);
    } catch {
      /* clipboard blocked — the download button still works */
    }
  }

  protected onImportFile(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => void this.store.importJson(String(reader.result));
    reader.readAsText(file);
  }

  protected runImport(): void {
    void this.store.importJson(this.importText()).then(() => {
      if (!this.store.error()) {
        this.importText.set('');
        this.showImport.set(false);
      }
    });
  }

  protected setQuery(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  protected onFilterType(event: Event): void {
    const v = (event.target as HTMLSelectElement).value;
    this.store.setFilterType(v ? (v as PokemonType) : null);
  }

  protected onFilterGen(event: Event): void {
    const v = (event.target as HTMLSelectElement).value;
    this.store.setFilterGen(v ? Number(v) : null);
  }

  protected addRandom(): void {
    void this.store.addRandom();
  }

  protected fillRandom(): void {
    void this.store.fillRandom();
  }

  protected setImportText(event: Event): void {
    this.importText.set((event.target as HTMLTextAreaElement).value);
  }
}
