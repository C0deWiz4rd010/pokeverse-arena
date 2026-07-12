import { Injectable, computed, inject, signal } from '@angular/core';
import { PokeApiClient } from '../../core/api/pokeapi.client';
import { SaveService } from '../../core/storage/save.service';
import { mapPokemon, type Pokemon } from '../../core/models/pokemon.model';
import { fusePokemon, type FusionResult } from '../../game/fusion/fusion';
import type { PokemonType } from '../../core/utils/type-chart';

/** Highest species id offered by the random pickers (national dex, no forms). */
export const FUSION_MAX_ID = 1025;

/** A saved fusion — enough to rebuild the visual without refetching for the gallery. */
export interface SavedFusion {
  readonly name: string;
  readonly code: string;
  readonly headId: number;
  readonly bodyId: number;
  readonly types: PokemonType[];
  readonly bst: number;
  readonly hueShift: number;
  readonly savedAt: number;
}

/**
 * Fusion Lab state: the two donor slots, their loaded Pokémon, the derived
 * fusion, and a persisted "Fusion Dex" of keeper splices.
 */
@Injectable({ providedIn: 'root' })
export class FusionService {
  private readonly api = inject(PokeApiClient);
  private readonly save = inject(SaveService);

  readonly headId = signal<number | null>(null);
  readonly bodyId = signal<number | null>(null);
  readonly head = signal<Pokemon | null>(null);
  readonly body = signal<Pokemon | null>(null);
  private readonly pending = signal(0);
  readonly loading = computed(() => this.pending() > 0);
  readonly error = signal<string | null>(null);

  readonly fusion = computed<FusionResult | null>(() => {
    const h = this.head();
    const b = this.body();
    return h && b ? fusePokemon(h, b) : null;
  });

  readonly dex = signal<readonly SavedFusion[]>(this.save.read<SavedFusion[]>('fusion:dex', []));
  readonly isSaved = computed(() => {
    const code = this.fusion()?.code;
    return !!code && this.dex().some((f) => f.code === code);
  });

  /** Load one donor slot; stale responses (user re-picked fast) are dropped. */
  async setSlot(slot: 'head' | 'body', id: number): Promise<void> {
    const idSig = slot === 'head' ? this.headId : this.bodyId;
    const monSig = slot === 'head' ? this.head : this.body;
    if (idSig() === id) return;
    idSig.set(id);
    this.pending.update((n) => n + 1);
    this.error.set(null);
    try {
      const mon = mapPokemon(await this.api.pokemon(id));
      if (idSig() === id) monSig.set(mon);
    } catch {
      if (idSig() === id) {
        idSig.set(null);
        this.error.set('Could not load that Pokémon — check your connection and retry.');
      }
    } finally {
      this.pending.update((n) => n - 1);
    }
  }

  async setPair(headId: number, bodyId: number): Promise<void> {
    await Promise.all([this.setSlot('head', headId), this.setSlot('body', bodyId)]);
  }

  /** Swap head and body donors (a different fusion — order matters). */
  swap(): void {
    const h = this.head();
    const b = this.body();
    const hid = this.headId();
    const bid = this.bodyId();
    this.head.set(b);
    this.body.set(h);
    this.headId.set(bid);
    this.bodyId.set(hid);
  }

  randomId(exclude?: number | null): number {
    let id = 1 + Math.floor(Math.random() * FUSION_MAX_ID);
    if (exclude && id === exclude) id = (id % FUSION_MAX_ID) + 1;
    return id;
  }

  toggleSaved(): void {
    const f = this.fusion();
    const h = this.headId();
    const b = this.bodyId();
    if (!f || !h || !b) return;
    const next = this.dex().some((s) => s.code === f.code)
      ? this.dex().filter((s) => s.code !== f.code)
      : [
          {
            name: f.name,
            code: f.code,
            headId: h,
            bodyId: b,
            types: f.types,
            bst: f.bst,
            hueShift: f.hueShift,
            savedAt: Date.now(),
          },
          ...this.dex(),
        ];
    this.dex.set(next);
    this.save.write('fusion:dex', next);
  }

  remove(code: string): void {
    const next = this.dex().filter((s) => s.code !== code);
    this.dex.set(next);
    this.save.write('fusion:dex', next);
  }
}
