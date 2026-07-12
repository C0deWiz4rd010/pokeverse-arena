import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { PageHeaderComponent } from '../../core/ui/page-header/page-header';
import { TypeBadgeComponent } from '../../core/ui/type-badge/type-badge';
import { StatBarComponent } from '../../core/ui/stat-bar/stat-bar';
import { IconComponent } from '../../core/ui/icon/icon';
import { ToastService } from '../../core/ui/toast/toast.service';
import { CryService } from '../../core/audio/cry.service';
import { SPRITE_BASE, cryUrl, officialArtwork } from '../../core/api/pokeapi-endpoints';
import { titleCase } from '../../core/ui/format';
import { PokedexService } from '../pokedex/pokedex.service';
import { FusionService, type SavedFusion } from './fusion.service';
import type { PokedexEntry } from '../../core/models/pokemon.model';

const REDUCED_MOTION =
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** How long the DNA-merge staging runs before the fused form is revealed. */
const MERGE_MS = 950;

type Slot = 'head' | 'body';

/**
 * ⚗️ Fusion Lab — pick a head and a body donor, splice them into a brand-new
 * Pokémon with a blended name, typing, stats and palette, then keep the best
 * ones in a persistent Fusion Dex. Fusions are deterministic and shareable
 * via `?head=&body=` links.
 */
@Component({
  selector: 'pv-fusion',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeaderComponent, TypeBadgeComponent, StatBarComponent, IconComponent],
  templateUrl: './fusion.html',
  styleUrl: './fusion.scss',
})
export class FusionComponent {
  protected readonly lab = inject(FusionService);
  protected readonly dex = inject(PokedexService);
  private readonly toasts = inject(ToastService);
  private readonly cries = inject(CryService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly titleCase = titleCase;

  /** Which picker dropdown is open, and its live query text. */
  protected readonly activeSlot = signal<Slot | null>(null);
  protected readonly headQuery = signal('');
  protected readonly bodyQuery = signal('');

  /** 'idle' → 'merging' (DNA staging) → 'done' (fused form revealed). */
  protected readonly phase = signal<'idle' | 'merging' | 'done'>('idle');
  private mergeTimer: ReturnType<typeof setTimeout> | null = null;
  private lastCode: string | null = null;

  protected readonly fusion = this.lab.fusion;

  protected readonly headArt = computed(() => {
    const id = this.lab.headId();
    return id ? officialArtwork(id) : null;
  });
  protected readonly bodyArt = computed(() => {
    const id = this.lab.bodyId();
    return id ? officialArtwork(id) : null;
  });

  /** The fused visual: body silhouette re-tinted toward the head's palette. */
  protected readonly fusedFilter = computed(() => {
    const f = this.fusion();
    if (!f) return 'none';
    return `hue-rotate(${f.hueShift}deg) saturate(1.08)`;
  });

  protected readonly statRows = computed(() => {
    const f = this.fusion();
    if (!f) return [];
    return [
      { label: 'HP', value: f.stats.hp },
      { label: 'Attack', value: f.stats.attack },
      { label: 'Defense', value: f.stats.defense },
      { label: 'Sp. Atk', value: f.stats['special-attack'] },
      { label: 'Sp. Def', value: f.stats['special-defense'] },
      { label: 'Speed', value: f.stats.speed },
    ];
  });

  constructor() {
    void this.dex.ensureLoaded();

    // Deep link: /fusion?head=6&body=150 restores a shared fusion; a lone
    // `head` (e.g. the detail page's "Fuse" button) pre-fills just that slot.
    const params = this.route.snapshot.queryParamMap;
    const head = Number(params.get('head'));
    const body = Number(params.get('body'));
    if (head > 0) void this.lab.setSlot('head', head);
    if (body > 0) void this.lab.setSlot('body', body);

    // Keep the picker inputs mirroring whatever is actually loaded (deep
    // links, swaps, gallery loads) — unless the user is typing in that box.
    effect(() => {
      const h = this.lab.head();
      if (h && this.activeSlot() !== 'head') this.headQuery.set(titleCase(h.name));
    });
    effect(() => {
      const b = this.lab.body();
      if (b && this.activeSlot() !== 'body') this.bodyQuery.set(titleCase(b.name));
    });

    // Stage the merge animation whenever a *new* pair finishes loading,
    // and mirror the pair into the URL so every fusion is shareable.
    effect(() => {
      const f = this.fusion();
      if (!f || f.code === this.lastCode) return;
      this.lastCode = f.code;
      this.syncUrl();
      this.playMerge();
    });

    this.destroyRef.onDestroy(() => {
      if (this.mergeTimer) clearTimeout(this.mergeTimer);
    });
  }

  /* ------------------------------------------------------------- pickers */

  protected suggestions(slot: Slot): PokedexEntry[] {
    const q = (slot === 'head' ? this.headQuery() : this.bodyQuery()).trim().toLowerCase();
    if (q.length < 1) return [];
    const num = Number(q.replace(/^#/, ''));
    const starts: PokedexEntry[] = [];
    const contains: PokedexEntry[] = [];
    for (const e of this.dex.entries()) {
      const isNum = Number.isInteger(num) && num > 0 && e.id === num;
      const at = isNum ? 0 : e.name.indexOf(q);
      if (at < 0) continue;
      (at === 0 ? starts : contains).push(e);
      if (starts.length >= 8) break;
    }
    return [...starts, ...contains].slice(0, 8);
  }

  protected sprite(id: number): string {
    return `${SPRITE_BASE}/pokemon/${id}.png`;
  }

  protected onQuery(slot: Slot, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    (slot === 'head' ? this.headQuery : this.bodyQuery).set(value);
    this.activeSlot.set(slot);
  }

  protected pick(slot: Slot, entry: PokedexEntry): void {
    (slot === 'head' ? this.headQuery : this.bodyQuery).set(titleCase(entry.name));
    this.activeSlot.set(null);
    void this.lab.setSlot(slot, entry.id);
  }

  protected closeSuggestions(): void {
    // Delayed so a click on a suggestion lands before the list unmounts.
    setTimeout(() => this.activeSlot.set(null), 120);
  }

  protected randomize(slot: Slot): void {
    const other = slot === 'head' ? this.lab.bodyId() : this.lab.headId();
    const id = this.lab.randomId(other);
    const entry = this.dex.entryById(id);
    (slot === 'head' ? this.headQuery : this.bodyQuery).set(entry ? titleCase(entry.name) : `#${id}`);
    void this.lab.setSlot(slot, id);
  }

  protected surprise(): void {
    this.randomize('head');
    this.randomize('body');
  }

  protected swap(): void {
    const hq = this.headQuery();
    this.headQuery.set(this.bodyQuery());
    this.bodyQuery.set(hq);
    this.lab.swap();
  }

  /* ------------------------------------------------------------- actions */

  /** Chimera cry: the head's voice, answered by the body's, pitched up. */
  protected playCry(): void {
    if (this.cries.muted()) return;
    const head = this.lab.headId();
    const body = this.lab.bodyId();
    if (!head || !body) return;
    const first = new Audio(cryUrl(head));
    first.volume = 0.45;
    void first.play().catch(() => undefined);
    setTimeout(() => {
      const second = new Audio(cryUrl(body));
      second.volume = 0.4;
      second.playbackRate = 1.18;
      void second.play().catch(() => undefined);
    }, 420);
  }

  protected async share(): Promise<void> {
    const f = this.fusion();
    if (!f) return;
    const tree = this.router.createUrlTree(['/fusion'], {
      queryParams: { head: this.lab.headId(), body: this.lab.bodyId() },
    });
    // Hash routing (GitHub Pages): the app path lives after the '#'.
    const url = `${location.href.split('#')[0]}#${this.router.serializeUrl(tree)}`;
    const text = `⚗️ ${f.name} (#${f.code}) — ${f.types.map(titleCase).join(' / ')} · BST ${f.bst}\n${url}`;
    try {
      await navigator.clipboard.writeText(text);
      this.toasts.show({ title: 'Fusion copied', text: 'Share link is on your clipboard.', icon: 'copy', kind: 'info' });
    } catch {
      this.toasts.show({ title: 'Could not copy', text, icon: 'triangle-alert', kind: 'info' });
    }
  }

  protected toggleSave(): void {
    const wasSaved = this.lab.isSaved();
    this.lab.toggleSaved();
    const f = this.fusion();
    if (!wasSaved && f) {
      this.toasts.show({ title: `${f.name} registered!`, text: 'Added to your Fusion Dex.', icon: 'flask-conical', kind: 'achievement' });
    }
  }

  protected loadSaved(entry: SavedFusion): void {
    const head = this.dex.entryById(entry.headId);
    const body = this.dex.entryById(entry.bodyId);
    this.headQuery.set(head ? titleCase(head.name) : `#${entry.headId}`);
    this.bodyQuery.set(body ? titleCase(body.name) : `#${entry.bodyId}`);
    void this.lab.setPair(entry.headId, entry.bodyId);
    if (typeof scrollTo === 'function') scrollTo({ top: 0, behavior: REDUCED_MOTION ? 'auto' : 'smooth' });
  }

  protected removeSaved(event: Event, code: string): void {
    event.stopPropagation();
    this.lab.remove(code);
  }

  protected savedFilter(entry: SavedFusion): string {
    return `hue-rotate(${entry.hueShift}deg) saturate(1.08)`;
  }

  /* ------------------------------------------------------------- private */

  private playMerge(): void {
    if (this.mergeTimer) clearTimeout(this.mergeTimer);
    if (REDUCED_MOTION) {
      this.phase.set('done');
      return;
    }
    this.phase.set('merging');
    this.mergeTimer = setTimeout(() => this.phase.set('done'), MERGE_MS);
  }

  private syncUrl(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { head: this.lab.headId(), body: this.lab.bodyId() },
      replaceUrl: true,
    });
  }
}
