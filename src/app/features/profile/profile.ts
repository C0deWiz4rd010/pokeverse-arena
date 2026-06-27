import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ProfileService } from './profile.service';
import { PageHeaderComponent } from '../../core/ui/page-header/page-header';
import { IconComponent } from '../../core/ui/icon/icon';

@Component({
  selector: 'pv-profile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeaderComponent, IconComponent],
  templateUrl: './profile.html',
  styleUrl: './profile.scss',
})
export class ProfileComponent {
  protected readonly svc = inject(ProfileService);

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
    ];
  });

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
}
