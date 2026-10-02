import { Injectable, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { I18nService } from '../../core/i18n/i18n.service';
import { ProfileService } from './profile.service';
import { SaveService } from '../../core/storage/save.service';
import { ToastService } from '../../core/ui/toast/toast.service';
import { ACHIEVEMENTS } from '../../core/models/profile';
import { diffUnlocked } from './achievement-diff';

const KEY = 'achievements:seen';
const POLL_MS = 30_000;

/**
 * Watches aggregate progression and celebrates newly unlocked achievements
 * with a global toast — no matter which system (arena, spire, tournaments,
 * world, contest…) earned it. Checks on every navigation plus a slow poll,
 * since unlocks can happen mid-page without a route change.
 */
@Injectable({ providedIn: 'root' })
export class AchievementWatcherService {
  private readonly router = inject(Router);
  private readonly profile = inject(ProfileService);
  private readonly save = inject(SaveService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);
  private started = false;

  start(): void {
    if (this.started) return;
    this.started = true;
    this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe(() => this.check());
    // Slow poll only while the tab is visible; catch up as soon as it comes back.
    setInterval(() => {
      if (document.visibilityState === 'visible') this.check();
    }, POLL_MS);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') this.check();
    });
    this.check();
  }

  private check(): void {
    this.profile.refresh();
    const unlocked = this.profile
      .achievements()
      .filter((a) => a.unlocked)
      .map((a) => a.achievement.id);
    const seen = this.save.read<string[] | null>(KEY, null);
    const { newly, nextSeen } = diffUnlocked(unlocked, seen);

    if (seen === null || newly.length || nextSeen.length !== seen.length) {
      this.save.write(KEY, [...nextSeen]);
    }
    for (const id of newly) {
      const a = ACHIEVEMENTS.find((x) => x.id === id);
      if (!a) continue;
      this.toast.show({
        title: `${this.i18n.t('Achievement unlocked')} — ${this.i18n.t(a.name)}`,
        text: this.i18n.t(a.desc),
        icon: a.icon,
        kind: 'achievement',
      });
    }
  }
}
