import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ContestService } from './contest.service';
import { PageHeaderComponent } from '../../core/ui/page-header/page-header';
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
  imports: [PageHeaderComponent, SpinnerComponent],
  templateUrl: './contest.html',
  styleUrl: './contest.scss',
})
export class ContestComponent {
  protected readonly svc = inject(ContestService);
  protected readonly categories = CONTEST_CATEGORIES;
  protected readonly flavorForCategory = flavorForCategory;

  protected readonly query = signal('');

  protected info(key: ContestCategory) {
    return this.categories.find((c) => c.key === key)!;
  }

  protected search(): void {
    void this.svc.choosePerformer(this.query());
    this.query.set('');
  }

  protected berryHighlight(berry: Berry): number {
    const flavor = flavorForCategory(this.svc.category());
    return berry.flavors[flavor];
  }
}
