import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ContestService } from './contest.service';
import { PageHeaderComponent } from '../../core/ui/page-header/page-header';
import { IconComponent } from '../../core/ui/icon/icon';
import { SpinnerComponent } from '../../core/ui/spinner/spinner';
import {
  CONTEST_CATEGORIES,
  flavorForCategory,
  type Berry,
  type ContestCategory,
} from '../../game/contest/contest';

@Component({
  selector: 'pv-contest',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeaderComponent, SpinnerComponent, IconComponent],
  templateUrl: './contest.html',
  styleUrl: './contest.scss',
})
export class ContestComponent {
  protected readonly svc = inject(ContestService);
  protected readonly categories = CONTEST_CATEGORIES;
  protected readonly flavorForCategory = flavorForCategory;

  protected readonly query = signal('');

  /** Player vs top-rival hearts as a 0–100 lead bar for the judge meter. */
  protected readonly leadPct = computed(() => {
    const me = this.svc.playerHearts();
    const foe = this.svc.topRivalHearts();
    const total = me + foe;
    return total > 0 ? (me / total) * 100 : 50;
  });

  protected info(key: ContestCategory) {
    return this.categories.find((c) => c.key === key)!;
  }

  protected moveName(key: ContestCategory): string {
    return this.svc.appealMoves[key].name;
  }

  protected search(): void {
    void this.svc.choosePerformer(this.query());
    this.query.set('');
  }

  protected berryHighlight(berry: Berry): number {
    const flavor = flavorForCategory(this.svc.category());
    return berry.flavors[flavor];
  }

  protected begin(): void {
    this.svc.beginPerformance();
  }

  protected appeal(key: ContestCategory): void {
    this.svc.appeal(key);
  }
}
