import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RpgService } from '../rpg.service';
import { ITEMS } from '../../../game/rpg/items-catalog';
import { MART_STOCK, buyPrice } from '../../../game/rpg/shop';
import type { ItemId } from '../../../game/rpg/rpg-types';

/** Poké Mart — buy items with the player's money. */
@Component({
  selector: 'pv-rpg-shop',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="shop">
      <header class="shop-head">
        <strong>Poké Mart</strong>
        <span class="money">{{ svc.money() }} ₽</span>
      </header>
      <ul class="stock">
        @for (id of stock; track id) {
          <li class="item">
            <span class="name">{{ name(id) }}</span>
            <span class="desc">{{ desc(id) }}</span>
            <span class="own">×{{ svc.itemCount(id) }}</span>
            <button type="button" class="buy" [disabled]="svc.money() < price(id)" (click)="buy(id)">
              {{ price(id) }} ₽
            </button>
          </li>
        }
      </ul>
      <button class="leave" type="button" (click)="svc.closeMenu()">Leave ›</button>
    </div>
  `,
  styleUrl: './shop.scss',
})
export class ShopComponent {
  protected readonly svc = inject(RpgService);
  protected readonly stock = MART_STOCK;

  protected name(id: ItemId): string { return ITEMS[id].name; }
  protected desc(id: ItemId): string { return ITEMS[id].desc; }
  protected price(id: ItemId): number { return buyPrice(id); }

  protected buy(id: ItemId): void {
    if (this.svc.spend(this.price(id))) {
      this.svc.addItem(id, 1);
      this.svc.showToast(`Bought ${this.name(id)}!`);
    }
  }
}
