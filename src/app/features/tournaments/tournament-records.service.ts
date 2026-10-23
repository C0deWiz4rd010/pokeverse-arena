import { Injectable, signal } from '@angular/core';
import {
  formatById,
  loadHistory,
  loadRival,
  prizeFor,
  pushHistory,
  recordRivalMeeting,
  rivalLevelBoost,
  saveRival,
  scaleStats,
  teamStrength,
  trainerAvatar,
  type BracketFormat,
  type RivalState,
  type TournamentMode,
  type TournamentRecord,
  type Trainer,
} from '../../game/tournament';

/** What the history entry needs to know about the champion call. */
export interface PickSummary {
  readonly trainerId: string;
  readonly payout: number;
}

/**
 * Persistent tournament bookkeeping: the run history, the last logged record and the
 * rival (identity + head-to-head record). Both survive {@link TournamentService.reset}.
 */
@Injectable({ providedIn: 'root' })
export class TournamentRecords {
  /** Persisted tournament history. */
  readonly history = signal<TournamentRecord[]>(loadHistory());
  /** The record just logged for the current finished run (placement + prize). */
  readonly lastRun = signal<TournamentRecord | null>(null);
  /** Your persistent rival (identity + head-to-head record; survives resets). */
  readonly rival = signal<RivalState>(loadRival());

  private logged = false;

  /** Forget the current run's record so the next run can be logged. */
  resetRun(): void {
    this.logged = false;
    this.lastRun.set(null);
  }

  /** Persist a head-to-head result against the rival. */
  recordRival(playerWon: boolean): void {
    const next = recordRivalMeeting(this.rival(), playerWon);
    saveRival(next);
    this.rival.set(next);
  }

  /**
   * The rival takes over the strongest CPU entry every run, keeping that team
   * (so mode rules still hold) but wearing their persistent identity — and a
   * level edge that grows with your shared history.
   */
  injectRival(trainers: Trainer[]): Trainer[] {
    const state = this.rival();
    let strongest = -1;
    let best = -Infinity;
    trainers.forEach((t, i) => {
      if (t.isPlayer) return;
      const s = teamStrength(t);
      if (s > best) {
        best = s;
        strongest = i;
      }
    });
    if (strongest < 0) return trainers;
    const boost = rivalLevelBoost(state);
    const host = trainers[strongest]!;
    const team =
      boost > 0
        ? host.team.map((b) => ({
            ...b,
            level: b.level + boost,
            stats: scaleStats(b.stats, (b.level + boost) / b.level),
          }))
        : host.team;
    const rival: Trainer = {
      ...host,
      id: 'rival',
      name: state.name,
      title: state.title,
      avatar: trainerAvatar(state.seed),
      team,
      isRival: true,
    };
    return trainers.map((t, i) => (i === strongest ? rival : t));
  }

  /** Log a finished run once (placement, prize, champion-call bonus). */
  log(run: {
    placement: number;
    field: number;
    champion: Trainer | null;
    mode: TournamentMode | null;
    format: BracketFormat;
    pick: PickSummary | null;
  }): void {
    if (this.logged) return;
    this.logged = true;
    const { champion: champ, field, pick: p } = run;
    const playerWon = !!champ?.isPlayer;
    const place = playerWon ? 1 : run.placement > 0 ? run.placement : Math.ceil(field / 2) + 1;
    const pickBonus = p && champ && p.trainerId === champ.id ? p.payout : 0;
    const rec: TournamentRecord = {
      date: new Date().toISOString(),
      modeName: run.mode?.name ?? 'Tournament',
      formatName: formatById(run.format).name,
      field,
      placement: place,
      champion: champ?.name ?? '—',
      playerWon,
      prize: prizeFor(place, field) + pickBonus,
      ...(pickBonus > 0 ? { pickBonus } : {}),
    };
    this.lastRun.set(rec);
    this.history.set(pushHistory(rec));
  }
}
