import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { TournamentService } from './tournaments.service';
import { TournamentMatchComponent, type MatchOutcome } from './tournament-match/tournament-match';
import { PageHeaderComponent } from '../../core/ui/page-header/page-header';
import { SpinnerComponent } from '../../core/ui/spinner/spinner';
import { TypeBadgeComponent } from '../../core/ui/type-badge/type-badge';
import { IconComponent } from '../../core/ui/icon/icon';
import { titleCase } from '../../core/ui/format';
import type { Battler } from '../../game/engine';
import {
  ROUND_LABEL,
  ROUND_ORDER,
  TOURNAMENT_MODES,
  TOURNAMENT_FORMATS,
  winOdds,
  teamPower,
  scoutMatchup,
  bestLead,
  rivalTaunt,
  rivalMeetings,
  pickemMultiplier,
  pickemPayout,
  type BracketFormat,
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
    IconComponent,
  ],
  templateUrl: './tournaments.html',
  styleUrl: './tournaments.scss',
})
export class TournamentsComponent {
  protected readonly svc = inject(TournamentService);
  protected readonly titleCase = titleCase;
  protected readonly modes = TOURNAMENT_MODES;
  protected readonly formats = TOURNAMENT_FORMATS;
  protected readonly roundLabel = ROUND_LABEL;

  protected readonly selectedFormat = signal<BracketFormat>('single-elim');
  protected readonly isLeague = computed(() => this.svc.format() !== 'single-elim');

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

  /** Estimated win chance (%) for the player's upcoming match. */
  protected readonly matchOdds = computed(() => {
    const setup = this.svc.currentMatchSetup();
    return setup ? winOdds(setup.playerTeam, setup.foeTeam) : 50;
  });

  /** A short verdict label derived from the odds. */
  protected readonly oddsVerdict = computed(() => {
    const o = this.matchOdds();
    if (o >= 66) return 'Favoured';
    if (o >= 55) return 'Slight edge';
    if (o > 45) return 'Even match';
    if (o > 34) return 'Underdog';
    return 'Long shot';
  });

  /** Type-matchup scouting for the upcoming match. */
  protected readonly scouting = computed(() => {
    const setup = this.svc.currentMatchSetup();
    return setup ? scoutMatchup(setup.playerTeam, setup.foeTeam) : null;
  });

  /** Suggested lead against the upcoming foe team. */
  protected readonly lead = computed(() => {
    const setup = this.svc.currentMatchSetup();
    return setup ? bestLead(setup.playerTeam, setup.foeTeam) : null;
  });

  /** Career totals derived from the persisted run history. */
  protected readonly career = computed(() => {
    const runs = this.svc.history();
    if (!runs.length) return null;
    const earnings = runs.reduce((s, r) => s + r.prize, 0);
    const wins = runs.filter((r) => r.playerWon).length;
    const best = Math.min(...runs.map((r) => r.placement));
    return { runs: runs.length, earnings, wins, best };
  });

  /** True when the upcoming foe is your persistent rival. */
  protected readonly foeIsRival = computed(() => !!this.svc.currentMatchSetup()?.foe.isRival);

  /** The rival's pre-match taunt (null unless the rival is up next). */
  protected readonly rivalLine = computed(() =>
    this.foeIsRival() ? rivalTaunt(this.svc.rival()) : null,
  );

  /** Head-to-head record vs the rival (null until you have actually met). */
  protected readonly rivalry = computed(() => {
    const r = this.svc.rival();
    return rivalMeetings(r) > 0 ? r : null;
  });

  /** Trainers already knocked out (their crystal-ball option disappears). */
  private readonly eliminatedIds = computed(() => {
    const out = new Set<string>();
    const b = this.svc.bracket();
    if (!b) return out;
    for (const round of Object.values(b.rounds)) {
      for (const m of round) {
        if (!m.played || m.winner === null) continue;
        const loser = m.winner === 0 ? m.b : m.a;
        if (loser) out.add(loser.id);
      }
    }
    return out;
  });

  /** Crystal-ball choices (empty once a pick is made, locked, or the run ended). */
  protected readonly pickOptions = computed(() => {
    if (this.svc.pick() || this.svc.pickLocked() || this.svc.status() !== 'ready') return [];
    const field = this.svc.fieldList();
    if (field.length < 2) return [];
    const gone = this.eliminatedIds();
    const powers = field.map((t) => teamPower(t.team));
    return field
      .filter((t) => !gone.has(t.id))
      .map((t) => ({
        id: t.id,
        name: t.isPlayer ? 'You' : t.name,
        avatar: t.avatar,
        isRival: !!t.isRival,
        mult: pickemMultiplier(teamPower(t.team), powers),
        payout: pickemPayout(teamPower(t.team), powers),
      }))
      .sort((a, b) => a.mult - b.mult);
  });

  /* --------------------------------------------------------------- actions */

  protected setFormat(format: BracketFormat): void {
    this.selectedFormat.set(format);
  }

  protected start(mode: ModeId): void {
    void this.svc.startMode(mode, this.selectedFormat());
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
    this.svc.lockPick();
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

  /** Whether a card should show a pre-match odds bar (both sides set, unplayed). */
  protected showCardOdds(m: BracketMatch): boolean {
    return !m.played && m.a !== null && m.b !== null;
  }

  /** Side A's share (%) of the head-to-head power for a card's odds bar. */
  protected cardOddsA(m: BracketMatch): number {
    if (!m.a || !m.b) return 50;
    return winOdds(m.a.team, m.b.team);
  }
}
