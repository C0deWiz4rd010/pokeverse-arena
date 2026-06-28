import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RpgService } from '../rpg.service';
import { StatusBadgeComponent } from '../../../core/ui/status-badge/status-badge';
import { titleCase } from '../../../core/ui/format';
import { ITEMS } from '../../../game/rpg/items-catalog';
import { xpProgress } from '../../../game/rpg/xp';
import type { ItemId } from '../../../game/rpg/rpg-types';

type Tab = 'party' | 'bag';

/** Overworld pause menu: party overview, field bag, save / quit. */
@Component({
  selector: 'pv-field-menu',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StatusBadgeComponent],
  templateUrl: './field-menu.html',
  styleUrl: './field-menu.scss',
})
export class FieldMenuComponent {
  protected readonly svc = inject(RpgService);
  protected readonly titleCase = titleCase;
  protected readonly tab = signal<Tab>('party');
  /** When using a bag item, the item awaiting a party target. */
  protected readonly pendingItem = signal<ItemId | null>(null);

  protected readonly partyView = computed(() =>
    this.svc.party().map((m, i) => ({
      i,
      name: titleCase(m.nickname ?? m.species),
      level: m.level,
      hp: m.currentHp,
      maxHp: m.maxHp,
      hpPct: Math.round((m.currentHp / m.maxHp) * 100),
      status: m.status,
      xpPct: xpProgress(m.xp, m.level).pct,
      fainted: m.currentHp <= 0,
    })),
  );

  protected readonly bagView = computed(() => {
    const bag = this.svc.bag();
    return (Object.keys(bag) as ItemId[])
      .filter((id) => (bag[id] ?? 0) > 0)
      .map((id) => ({ id, name: ITEMS[id].name, desc: ITEMS[id].desc, count: bag[id] ?? 0, field: ITEMS[id].usableOnField }));
  });

  protected pickItem(id: ItemId): void {
    if (!ITEMS[id].usableOnField) {
      this.svc.showToast('You can only use that in battle.');
      return;
    }
    this.pendingItem.set(id);
    this.tab.set('party');
  }

  protected onPartyClick(index: number): void {
    const item = this.pendingItem();
    if (!item) return;
    const msg = this.svc.useFieldItem(item, index);
    this.svc.showToast(msg);
    this.pendingItem.set(null);
  }

  protected cancelItem(): void {
    this.pendingItem.set(null);
  }

  protected save(): void {
    this.svc.persist();
    this.svc.showToast('Adventure saved.');
  }
}
