import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  signal,
} from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { IconComponent } from '../icon/icon';
import type { IconName } from '../icon/icons.data';
import { HapticsService } from '../../haptics/haptics.service';

export interface BottomNavItem {
  path: string;
  label: string;
  icon: IconName;
}

/**
 * Thumb-reachable bottom tab-bar for phones (hidden at `md`+ where the header
 * nav takes over). Four primary destinations plus a raised center action and a
 * "More" button that reveals every remaining route in a bottom sheet.
 */
@Component({
  selector: 'pv-bottom-nav',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, IconComponent],
  template: `
    <nav class="bnav glass" aria-label="Primary">
      <a class="bslot" routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }" (click)="tap()">
        <pv-icon name="home" [size]="22" />
        <span>Home</span>
      </a>
      <a class="bslot" routerLink="/pokedex" routerLinkActive="active" (click)="tap()">
        <pv-icon name="book" [size]="22" />
        <span>Dex</span>
      </a>
      <a class="bslot center" routerLink="/battle" routerLinkActive="active" (click)="tap()" aria-label="Battle">
        <span class="orb"><pv-icon name="swords" [size]="24" /></span>
      </a>
      <a class="bslot" routerLink="/adventure" routerLinkActive="active" (click)="tap()">
        <pv-icon name="scroll-text" [size]="22" />
        <span>Quest</span>
      </a>
      <button class="bslot" type="button" (click)="openSheet()" [attr.aria-expanded]="sheet()" aria-label="More">
        <pv-icon name="grid" [size]="22" />
        <span>More</span>
      </button>
    </nav>

    @if (sheet()) {
      <div class="sheet-scrim" (click)="closeSheet()"></div>
      <div class="sheet glass" role="dialog" aria-label="All sections">
        <div class="sheet-grip" aria-hidden="true"></div>
        <div class="sheet-grid">
          @for (item of items(); track item.path) {
            <a
              class="sheet-item"
              [routerLink]="item.path"
              routerLinkActive="active"
              (click)="pick()"
            >
              <span class="sheet-icon"><pv-icon [name]="item.icon" [size]="22" /></span>
              <span>{{ item.label }}</span>
            </a>
          }
        </div>
      </div>
    }
  `,
  styleUrl: './bottom-nav.scss',
})
export class BottomNavComponent {
  /** Full destination list (the sheet shows every one). */
  readonly items = input.required<BottomNavItem[]>();

  private readonly haptics = inject(HapticsService);
  protected readonly sheet = signal(false);

  protected tap(): void {
    this.haptics.fire('select');
  }

  protected openSheet(): void {
    this.haptics.fire('tap');
    this.sheet.set(true);
  }

  protected closeSheet(): void {
    this.sheet.set(false);
  }

  protected pick(): void {
    this.haptics.fire('select');
    this.sheet.set(false);
  }
}
