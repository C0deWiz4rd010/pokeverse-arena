import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { WorldService } from './world.service';
import { PageHeaderComponent } from '../../core/ui/page-header/page-header';
import { IconComponent } from '../../core/ui/icon/icon';
import { SpinnerComponent } from '../../core/ui/spinner/spinner';
import { regionDexCount, type Region } from '../../game/world/regions';

@Component({
  selector: 'pv-world',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, PageHeaderComponent, SpinnerComponent, IconComponent],
  templateUrl: './world.html',
  styleUrl: './world.scss',
})
export class WorldComponent {
  protected readonly svc = inject(WorldService);
  protected readonly dexCount = regionDexCount;

  /** Bound to the search box. */
  protected readonly query = signal('');

  protected select(region: Region): void {
    void this.svc.select(region);
  }

  protected search(): void {
    void this.svc.locate(this.query());
  }

  protected reset(): void {
    this.query.set('');
    this.svc.clearSearch();
  }
}
