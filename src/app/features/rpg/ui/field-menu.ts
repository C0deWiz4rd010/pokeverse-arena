import { ChangeDetectionStrategy, Component, ElementRef, HostListener, computed, inject, signal, viewChild, afterNextRender } from '@angular/core';
import { RpgService } from '../rpg.service';
import { StatusBadgeComponent } from '../../../core/ui/status-badge/status-badge';
import { titleCase } from '../../../core/ui/format';
import { ITEMS } from '../../../game/rpg/items-catalog';
import { xpProgress } from '../../../game/rpg/xp';
import { questLog, questProgress } from '../../../game/rpg/quests';
import { activeBoons } from '../../../game/rpg/boons';
import { SPRITE_BASE } from '../../../core/api/pokeapi-endpoints';
import { itemName } from '../../../game/engine';
import type { ItemId } from '../../../game/rpg/rpg-types';

type Tab = 'party' | 'bag' | 'quests' | 'dex' | 'box';

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
  private readonly firstTab = viewChild<ElementRef<HTMLButtonElement>>('firstTab');

  /** Selectable player looks (reuse the CC0 character facesets as avatars). */
  protected readonly looks: readonly { readonly key: string; readonly name: string }[] = [
    { key: 'boy', name: 'Red' },
    { key: 'girl', name: 'Leaf' },
    { key: 'clerk', name: 'Ace' },
    { key: 'leader', name: 'Blaze' },
  ];
  protected lookFace(key: string): string {
    return `rpg/facesets/nj-face-${key}.png`;
  }
  protected chooseLook(key: string): void {
    this.svc.setAppearance(key);
  }

  constructor() {
    // Move focus into the menu when it opens so keyboard/AT users land inside.
    afterNextRender(() => this.firstTab()?.nativeElement.focus());
  }

  /** Escape / X closes the menu again — mirrors the key that opened it. */
  @HostListener('document:keydown', ['$event'])
  protected onKey(e: KeyboardEvent): void {
    if (e.key !== 'Escape' && e.key !== 'x' && e.key !== 'X') return;
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
    e.preventDefault();
    this.svc.closeMenu();
  }
  /** When using a bag item, the item awaiting a party target. */
  protected readonly pendingItem = signal<ItemId | null>(null);
  /** Inline rename: the uid being edited + its draft text. */
  protected readonly renameUid = signal<string | null>(null);
  protected readonly renameDraft = signal('');

  protected readonly partyView = computed(() =>
    this.svc.party().map((m, i) => ({
      i,
      uid: m.uid,
      name: (m.shiny ? '✨' : '') + titleCase(m.nickname ?? m.species),
      level: m.level,
      hp: m.currentHp,
      maxHp: m.maxHp,
      hpPct: Math.round((m.currentHp / m.maxHp) * 100),
      status: m.status,
      xpPct: xpProgress(m.xp, m.level).pct,
      fainted: m.currentHp <= 0,
      held: m.heldItem ? itemName(m.heldItem) : null,
    })),
  );

  /** Passive perks unlocked by the held badges (Dex tab). */
  protected readonly boons = computed(() => activeBoons(this.svc.badges()));

  /** Nuzlocke memorial — the fallen, grayed out in the Dex tab. */
  protected readonly fallenView = computed(() =>
    this.svc.fallen().map((f) => ({
      name: titleCase(f.nickname ?? f.species),
      level: f.level,
      sprite: `${SPRITE_BASE}/pokemon/${f.dexId}.png`,
    })),
  );

  protected readonly boxView = computed(() =>
    this.svc.box().map((m, i) => ({
      i,
      name: (m.shiny ? '✨' : '') + titleCase(m.nickname ?? m.species),
      level: m.level,
      sprite: m.shiny ? `${SPRITE_BASE}/pokemon/shiny/${m.dexId}.png` : `${SPRITE_BASE}/pokemon/${m.dexId}.png`,
    })),
  );

  protected readonly bagView = computed(() => {
    const bag = this.svc.bag();
    return (Object.keys(bag) as ItemId[])
      .filter((id) => (bag[id] ?? 0) > 0)
      .map((id) => ({ id, name: ITEMS[id].name, desc: ITEMS[id].desc, count: bag[id] ?? 0, field: ITEMS[id].usableOnField }));
  });

  /** Quest checklist + progress derived live from the save. */
  protected readonly questView = computed(() => {
    const g = this.svc.game();
    if (!g) return { entries: [], done: 0, total: 0 };
    return { entries: questLog(g), ...questProgress(g) };
  });

  protected readonly dexView = computed(() => {
    const g = this.svc.game();
    const caught = [...(g?.caught ?? [])].sort((a, b) => a - b);
    return {
      seen: g?.seen.length ?? 0,
      caught: caught.length,
      badges: g?.badges ?? [],
      mons: caught.map((id) => ({ id, sprite: `${SPRITE_BASE}/pokemon/${id}.png` })),
    };
  });

  protected pickItem(id: ItemId): void {
    if (!ITEMS[id].usableOnField) {
      this.svc.showToast('You can only use that in battle.');
      return;
    }
    // Field-wide items (Repel) apply immediately — no party target needed.
    if (ITEMS[id].repel) {
      this.svc.showToast(this.svc.useFieldItem(id, -1));
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

  protected startRename(uid: string, current: string): void {
    this.renameUid.set(uid);
    this.renameDraft.set(current);
  }
  protected onRenameInput(e: Event): void {
    this.renameDraft.set((e.target as HTMLInputElement).value);
  }
  protected saveRename(): void {
    const uid = this.renameUid();
    if (uid) this.svc.rename(uid, this.renameDraft());
    this.renameUid.set(null);
  }
  protected cancelRename(): void {
    this.renameUid.set(null);
  }

  protected save(): void {
    this.svc.persist();
    this.svc.showToast('Adventure saved.');
  }
}
