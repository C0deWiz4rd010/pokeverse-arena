import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { SpireService } from './spire.service';
import { PageHeaderComponent } from '../../core/ui/page-header/page-header';
import { SpinnerComponent } from '../../core/ui/spinner/spinner';
import { TypeBadgeComponent } from '../../core/ui/type-badge/type-badge';
import { IconComponent } from '../../core/ui/icon/icon';
import { TournamentMatchComponent, type MatchOutcome } from '../tournaments/tournament-match/tournament-match';
import { titleCase } from '../../core/ui/format';
import type { Battler } from '../../game/engine';
import { isBossFloor, type RewardOption, type ShopEntry, type SpireNode } from '../../game/spire';

@Component({
  selector: 'pv-spire',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeaderComponent, SpinnerComponent, TypeBadgeComponent, IconComponent, TournamentMatchComponent],
  templateUrl: './spire.html',
  styleUrl: './spire.scss',
})
export class SpireComponent {
  protected readonly svc = inject(SpireService);
  protected readonly titleCase = titleCase;

  protected readonly picks = signal<Battler[]>([]);
  protected readonly canStart = computed(() => this.picks().length === 3);

  /** Visual climb track: one step per floor, flagging bosses and the current floor. */
  protected readonly climb = computed(() => {
    const cur = this.svc.floor();
    return Array.from({ length: this.svc.totalFloors }, (_, i) => {
      const n = i + 1;
      return { n, boss: isBossFloor(n), done: n < cur, current: n === cur };
    });
  });

  protected newRun(): void {
    this.picks.set([]);
    void this.svc.newRun(false);
  }

  protected newDaily(): void {
    this.picks.set([]);
    void this.svc.newRun(true);
  }

  protected togglePick(mon: Battler): void {
    this.picks.update((p) => {
      if (p.includes(mon)) return p.filter((m) => m !== mon);
      if (p.length >= 3) return p;
      return [...p, mon];
    });
  }

  protected isPicked(mon: Battler): boolean {
    return this.picks().includes(mon);
  }

  protected confirmStarters(): void {
    this.svc.confirmStarters(this.picks());
    this.picks.set([]);
  }

  protected chooseNode(node: SpireNode): void {
    void this.svc.chooseNode(node);
  }

  protected onFinished(outcome: MatchOutcome): void {
    this.svc.onBattleFinished(outcome);
  }

  protected chooseReward(option: RewardOption): void {
    this.svc.chooseReward(option);
  }

  protected buy(entry: ShopEntry): void {
    this.svc.buy(entry);
  }
}
