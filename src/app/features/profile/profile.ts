import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ProfileService } from './profile.service';
import { PageHeaderComponent } from '../../core/ui/page-header/page-header';
import { IconComponent } from '../../core/ui/icon/icon';
import { I18nService, LOCALES } from '../../core/i18n/i18n.service';
import { ThemeService } from '../../core/theme/theme.service';
import { ToastService } from '../../core/ui/toast/toast.service';
import { HapticsService } from '../../core/haptics/haptics.service';
import { SfxService } from '../../core/audio/sfx.service';
import { PokedexService } from '../pokedex/pokedex.service';
import { APP_VERSION } from '../../core/version';
import { dailyFusionPair } from '../../game/fusion/fusion';
import { dailySeed } from '../../core/utils/rng';
import { renderTrainerCard } from './trainer-card';
import { buildBackup, parseBackup } from '../../core/storage/backup';
import { safeSet } from '../../core/storage/safe-storage';
import { TranslatePipe } from '../../core/i18n/translate.pipe';

@Component({
  selector: 'pv-profile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, PageHeaderComponent, IconComponent],
  templateUrl: './profile.html',
  styleUrl: './profile.scss',
})
export class ProfileComponent {
  protected readonly svc = inject(ProfileService);
  protected readonly theme = inject(ThemeService);
  protected readonly i18n = inject(I18nService);
  protected readonly locales = LOCALES;
  protected readonly haptics = inject(HapticsService);
  protected readonly sfx = inject(SfxService);

  protected readonly editing = signal(false);
  protected readonly nameDraft = signal('');
  protected readonly titleDraft = signal('');

  constructor() {
    this.svc.refresh();
  }

  protected readonly records = computed(() => {
    const s = this.svc.state();
    return [
      { icon: 'shield' as const, label: 'Gym badges', value: `${s.badges} / ${s.totalBadges}` },
      { icon: 'crown' as const, label: 'Arena Champion', value: s.arenaChampion ? 'Yes' : '—' },
      { icon: 'trophy' as const, label: 'Tournament wins', value: `${s.tournamentWins}` },
      { icon: 'mountain' as const, label: 'Best spire depth', value: `${s.bestDepth}` },
      { icon: 'mountain-snow' as const, label: 'Spire clears', value: `${s.spireClears}` },
      { icon: 'star' as const, label: 'Ascension tier', value: `${s.ascension}` },
      { icon: 'gem' as const, label: 'Coins banked', value: `${s.coins} ₽` },
      { icon: 'clipboard-list' as const, label: 'Tournament runs', value: `${s.tournamentRuns}` },
      { icon: 'map' as const, label: 'Adventure badges', value: `${s.adventureBadges}` },
      { icon: 'map-pin' as const, label: 'Adventure catches', value: `${s.adventureCaught}` },
      { icon: 'book' as const, label: 'World dex', value: `${s.worldCaught}` },
      { icon: 'sparkles' as const, label: 'Shiny catches', value: `${s.shinyCaught}` },
      { icon: 'wand-sparkles' as const, label: 'Contest ribbons', value: `${s.contestRibbons} / 5` },
      { icon: 'flame' as const, label: 'Daily streak', value: `${s.dailyStreak} (best ${s.dailyBest})` },
      { icon: 'map-pin' as const, label: 'Odyssey wave', value: `${s.odysseyBestWave}` },
      { icon: 'egg' as const, label: 'Odyssey starters', value: `${s.odysseyUnlocked}` },
      { icon: 'zap' as const, label: 'Rivalry (W–L)', value: `${s.rivalWins}–${s.rivalLosses}` },
      { icon: 'dices' as const, label: 'Crystal-ball hits', value: `${s.pickemHits}` },
      { icon: 'flask-conical' as const, label: 'Fusions registered', value: `${s.fusionsRegistered}` },
      { icon: 'skull' as const, label: 'Nuzlocke badges', value: `${s.nuzlockeBadges}` },
      { icon: 'flask-conical' as const, label: 'Chimeras slain', value: `${s.chimeraWins}` },
    ];
  });

  /** Per-system mastery bars (value / max → percentage). */
  protected readonly mastery = computed(() => {
    const s = this.svc.state();
    const winRate = s.tournamentRuns ? Math.round((s.tournamentWins / s.tournamentRuns) * 100) : 0;
    return [
      { icon: 'shield' as const, label: 'Gym badges', text: `${s.badges}/${s.totalBadges}`, pct: s.totalBadges ? Math.round((s.badges / s.totalBadges) * 100) : 0 },
      { icon: 'mountain' as const, label: 'Spire depth', text: `floor ${s.bestDepth}`, pct: Math.min(100, Math.round((s.bestDepth / 12) * 100)) },
      { icon: 'star' as const, label: 'Ascension', text: `tier ${s.ascension}`, pct: Math.min(100, Math.round((s.ascension / 5) * 100)) },
      { icon: 'trophy' as const, label: 'Cup win rate', text: s.tournamentRuns ? `${winRate}%` : '—', pct: winRate },
      { icon: 'book' as const, label: 'World dex', text: `${s.worldCaught}/1025`, pct: Math.min(100, Math.round((s.worldCaught / 1025) * 100)) },
      { icon: 'wand-sparkles' as const, label: 'Contest ribbons', text: `${s.contestRibbons}/5`, pct: Math.round((s.contestRibbons / 5) * 100) },
    ];
  });

  /** Achievements with unlocked ones first. */
  protected readonly sortedAchievements = computed(() =>
    [...this.svc.achievements()].sort((a, b) => Number(b.unlocked) - Number(a.unlocked)),
  );

  protected startEdit(): void {
    this.nameDraft.set(this.svc.identity().name);
    this.titleDraft.set(this.svc.identity().title);
    this.editing.set(true);
  }

  protected setName(e: Event): void {
    this.nameDraft.set((e.target as HTMLInputElement).value);
  }

  protected setTitle(e: Event): void {
    this.titleDraft.set((e.target as HTMLInputElement).value);
  }

  protected saveEdit(): void {
    this.svc.setIdentity(this.nameDraft(), this.titleDraft());
    this.editing.set(false);
  }

  /* ------------------------------------------------------- trainer card */

  private readonly toasts = inject(ToastService);
  private readonly dex = inject(PokedexService);
  protected readonly rendering = signal(false);

  /** Render the shareable Trainer Card PNG, then share it (or download it). */
  protected async shareCard(): Promise<void> {
    if (this.rendering()) return;
    this.rendering.set(true);
    try {
      const s = this.svc.state();
      const t = this.theme.current();
      const special = dailyFusionPair(dailySeed('fusion'));
      const blob = await renderTrainerCard({
        name: this.svc.identity().name,
        title: this.i18n.t(this.svc.identity().title),
        rank: this.i18n.t(this.svc.rank()),
        t: (text, params) => this.i18n.t(text, params),
        completion: this.svc.completion(),
        stats: [
          { label: this.i18n.t('Badges'), value: `${s.badges}/${s.totalBadges}` },
          { label: this.i18n.t('Cups won'), value: `${s.tournamentWins}` },
          { label: this.i18n.t('Best streak'), value: `${s.dailyBest}` },
          { label: this.i18n.t('World dex'), value: `${s.worldCaught}` },
          { label: this.i18n.t('Spire clears'), value: `${s.spireClears}` },
          { label: this.i18n.t('Fusions'), value: `${s.fusionsRegistered}` },
        ],
        favoriteIds: [...this.dex.favorites()].slice(0, 3),
        specialIds: [special.head, special.body],
        accent: t.accent,
        accent2: t.accent2,
        accent3: t.accent3,
        version: APP_VERSION,
      });
      if (!blob) throw new Error('canvas unavailable');

      const file = new File([blob], 'trainer-card.png', { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'My PokéVerse Trainer Card' });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'trainer-card.png';
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
        this.toasts.show({ title: 'Trainer Card saved', text: 'trainer-card.png is in your downloads.', icon: 'download', kind: 'info' });
      }
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') {
        this.toasts.show({ title: 'Could not create the card', text: 'Please try again.', icon: 'triangle-alert', kind: 'info' });
      }
    } finally {
      this.rendering.set(false);
    }
  }

  /* ------------------------------------------------------ backup / restore */

  /** Download every save of this app as one JSON file. */
  protected exportSave(): void {
    try {
      const backup = buildBackup(localStorage, APP_VERSION);
      const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pokeverse-save-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      this.toasts.show({ title: 'Save exported', text: `${Object.keys(backup.entries).length} entries in your downloads.`, icon: 'download', kind: 'info' });
    } catch {
      this.toasts.show({ title: 'Export failed', text: 'Browser storage is not readable.', icon: 'triangle-alert', kind: 'info' });
    }
  }

  /** Restore a previously exported file (replaces the matching local saves, then reloads). */
  protected async importSave(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const parsed = parseBackup(await file.text());
    if (!parsed.ok) {
      this.toasts.show({ title: 'Import failed', text: parsed.error, icon: 'triangle-alert', kind: 'info' });
      return;
    }
    const count = Object.keys(parsed.entries).length;
    if (!confirm(`Restore ${count} saved entries? Matching progress on this device will be overwritten.`)) return;
    let failed = 0;
    for (const [key, value] of Object.entries(parsed.entries)) if (!safeSet(key, value)) failed++;
    if (failed) {
      this.toasts.show({ title: 'Import incomplete', text: `${failed} entries could not be written (storage full?).`, icon: 'triangle-alert', kind: 'info' });
      return;
    }
    location.reload();
  }
}
