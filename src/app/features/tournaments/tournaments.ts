import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { TournamentService } from './tournaments.service';
import { TournamentMatchComponent, type MatchOutcome } from './tournament-match/tournament-match';
import { PageHeaderComponent } from '../../core/ui/page-header/page-header';
import { SpinnerComponent } from '../../core/ui/spinner/spinner';
import { TypeBadgeComponent } from '../../core/ui/type-badge/type-badge';
import { titleCase } from '../../core/ui/format';
import type { Battler } from '../../game/engine';
import {
  ROUND_LABEL,
  ROUND_ORDER,
  TOURNAMENT_MODES,
  type BracketMatch,
  type ModeId,
} from '../../game/tournament';

@Component({
  selector: 'pv-tournaments',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgTemplateOutlet,
    TournamentMatchComponent,
    PageHeaderComponent,
    SpinnerComponent,
    TypeBadgeComponent,
  ],
  templateUrl: './tournaments.html',
  styleUrl: './tournaments.scss',
})
export class TournamentsComponent {
  protected readonly svc = inject(TournamentService);
  protected readonly titleCase = titleCase;
  protected readonly modes = TOURNAMENT_MODES;
  protected readonly roundLabel = ROUND_LABEL;

  protected readonly inMatch = signal(false);
  protected readonly draftPicks = signal<Battler[]>([]);
  protected readonly draftSize = computed(() => this.svc.mode()?.teamSize ?? 3);
  protected readonly canConfirmDraft = computed(() => this.draftPicks().length === this.draftSize());

  /* ----------------------------------------------------- bracket groupings */

  private readonly r16 = computed(() => this.svc.bracket()?.rounds.r16 ?? []);
  private readonly qf = computed(() => this.svc.bracket()?.rounds.qf ?? []);
  private readonly sf = computed(() => this.svc.bracket()?.rounds.sf ?? []);

  protected readonly leftR16 = computed(() => this.r16().slice(0, 4));
  protected readonly rightR16 = computed(() => this.r16().slice(4, 8));
  protected readonly leftQf = computed(() => this.qf().slice(0, 2));
  protected readonly rightQf = computed(() => this.qf().slice(2, 4));
  protected readonly leftSf = computed(() => this.sf().slice(0, 1));
  protected readonly rightSf = computed(() => this.sf().slice(1, 2));
  protected readonly final = computed(() => this.svc.bracket()?.rounds.final[0] ?? null);

  /** Round-by-round columns for the mobile/scroll layout. */
  protected readonly columns = computed(() => {
    const b = this.svc.bracket();
    if (!b) return [];
    return ROUND_ORDER.map((id) => ({ id, label: ROUND_LABEL[id], matches: b.rounds[id] }));
  });

  protected readonly championIsPlayer = computed(() => this.svc.champion()?.isPlayer ?? false);

  /* --------------------------------------------------------------- actions */

  protected start(mode: ModeId): void {
    void this.svc.startMode(mode);
  }

  protected toggleDraft(mon: Battler): void {
    const size = this.draftSize();
    this.draftPicks.update((picks) => {
      if (picks.includes(mon)) return picks.filter((m) => m !== mon);
      if (picks.length >= size) return picks;
      return [...picks, mon];
    });
  }

  protected isPicked(mon: Battler): boolean {
    return this.draftPicks().includes(mon);
  }

  protected confirmDraft(): void {
    void this.svc.confirmDraft(this.draftPicks());
    this.draftPicks.set([]);
  }

  protected battle(): void {
    this.inMatch.set(true);
  }

  protected onFinished(outcome: MatchOutcome): void {
    this.inMatch.set(false);
    this.svc.recordPlayerOutcome(outcome.playerWon, outcome.playerFinalHp);
  }

  protected restart(): void {
    this.inMatch.set(false);
    this.draftPicks.set([]);
    this.svc.reset();
  }

  /* -------------------------------------------------------------- helpers */

  protected hasPlayer(m: BracketMatch): boolean {
    return !!(m.a?.isPlayer || m.b?.isPlayer);
  }

  protected isLive(m: BracketMatch): boolean {
    return this.hasPlayer(m) && !m.played && m.a !== null && m.b !== null;
  }
}
