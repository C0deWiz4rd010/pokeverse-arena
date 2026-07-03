import { Injectable, computed, inject, signal } from '@angular/core';
import { SaveService } from '../../core/storage/save.service';
import { ToastService } from '../../core/ui/toast/toast.service';
import {
  EMPTY_DAILY,
  currentStreak,
  dailyKey,
  dailyMatchup,
  playedOn,
  recordDailyResult,
  wonOn,
  type DailyMatchup,
  type DailyRecord,
} from '../../game/daily/daily';

const KEY = 'daily:record';

/**
 * State around the Daily Challenge: today's deterministic matchup, the
 * persisted streak record, and result reporting (first attempt of the day
 * counts; a counted win gets a celebratory toast).
 */
@Injectable({ providedIn: 'root' })
export class DailyService {
  private readonly save = inject(SaveService);
  private readonly toast = inject(ToastService);

  private readonly record = signal<DailyRecord>(this.save.read(KEY, EMPTY_DAILY));

  readonly today = dailyKey();
  readonly matchup: DailyMatchup = dailyMatchup(this.today);

  readonly streak = computed(() => currentStreak(this.record(), this.today));
  readonly best = computed(() => this.record().best);
  readonly wins = computed(() => this.record().wins);
  readonly wonToday = computed(() => wonOn(this.record(), this.today));
  readonly playedToday = computed(() => playedOn(this.record(), this.today));

  /** Fold a finished daily battle into the record (no-op on retries). */
  report(won: boolean): void {
    const before = this.record();
    const after = recordDailyResult(before, this.today, won);
    if (after === before) return;
    this.record.set(after);
    this.save.write(KEY, after);
    if (won) {
      this.toast.show({
        title: `Daily Challenge complete — ${after.streak}-day streak!`,
        text: after.streak > 1 ? `Best run: ${after.best} days. Come back tomorrow!` : 'Come back tomorrow to start a streak.',
        icon: 'flame',
        kind: 'achievement',
      });
    }
  }
}
