import { Injectable, inject, signal } from '@angular/core';
import { SaveService } from '../storage/save.service';

export interface RecentPokemon {
  readonly id: number;
  readonly name: string;
}

const KEY = 'recent:pokemon';
const MAX = 8;

/** Prepend `item`, dropping any older entry with the same id, capped at `max`. */
export function pushRecent(
  list: readonly RecentPokemon[],
  item: RecentPokemon,
  max = MAX,
): RecentPokemon[] {
  return [item, ...list.filter((r) => r.id !== item.id)].slice(0, max);
}

/**
 * Rolling list of the last detail pages the trainer visited — most recent
 * first, deduplicated, persisted. Surfaced by the command palette as a
 * "Recent" group so favourites-in-progress are one keystroke away.
 */
@Injectable({ providedIn: 'root' })
export class RecentPokemonService {
  private readonly save = inject(SaveService);

  private readonly _list = signal<readonly RecentPokemon[]>(
    this.save.read<RecentPokemon[]>(KEY, []),
  );
  readonly list = this._list.asReadonly();

  record(id: number, name: string): void {
    const next = pushRecent(this._list(), { id, name });
    this._list.set(next);
    this.save.write(KEY, next);
  }

  clear(): void {
    this._list.set([]);
    this.save.remove(KEY);
  }
}
