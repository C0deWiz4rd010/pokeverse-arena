import { Injectable, signal } from '@angular/core';
import { isPokemonType, type PokemonType } from '../../core/utils/type-chart';
import { safeGet, safeRemove, safeSet } from '../../core/storage/safe-storage';

const BADGE_KEY = 'arena:badges';
const CHAMP_KEY = 'arena:champion';
const COINS_KEY = 'arena:coins';
const STARS_KEY = 'arena:stars';

/** Persisted Arena progress: badges, champion flag, coins and best star rating per gym. */
@Injectable({ providedIn: 'root' })
export class ArenaProgressStore {
  readonly badges = signal<ReadonlySet<PokemonType>>(this.restoreBadges());
  readonly isChampion = signal<boolean>(safeGet(CHAMP_KEY) === '1');
  readonly coins = signal<number>(this.restoreCoins());
  readonly stars = signal<Readonly<Record<string, number>>>(this.restoreStars());

  hasBadge(type: PokemonType): boolean {
    return this.badges().has(type);
  }

  starsFor(type: PokemonType): number {
    return this.stars()[type] ?? 0;
  }

  /** Earn the badge of `type` (no-op when already owned). */
  awardBadge(type: PokemonType): void {
    if (this.badges().has(type)) return;
    const next = new Set(this.badges());
    next.add(type);
    this.badges.set(next);
    this.persistBadges(next);
  }

  /** Crown the player Champion. */
  crown(): void {
    this.isChampion.set(true);
    safeSet(CHAMP_KEY, '1');
  }

  addCoins(n: number): void {
    if (n <= 0) return;
    const next = this.coins() + n;
    this.coins.set(next);
    safeSet(COINS_KEY, String(next));
  }

  /** Remember a star rating when it beats the previous best. */
  recordStars(type: PokemonType, stars: number): void {
    if (stars <= (this.stars()[type] ?? 0)) return;
    const next = { ...this.stars(), [type]: stars };
    this.stars.set(next);
    safeSet(STARS_KEY, JSON.stringify(next));
  }

  /** Forget badges, champion flag and stars (coins are kept). */
  reset(): void {
    this.badges.set(new Set());
    this.persistBadges(new Set());
    this.isChampion.set(false);
    this.stars.set({});
    safeRemove(CHAMP_KEY);
    safeRemove(STARS_KEY);
  }

  private persistBadges(badges: ReadonlySet<PokemonType>): void {
    safeSet(BADGE_KEY, JSON.stringify([...badges]));
  }

  private restoreBadges(): ReadonlySet<PokemonType> {
    try {
      const raw = safeGet(BADGE_KEY);
      if (!raw) return new Set();
      const list = JSON.parse(raw) as unknown;
      if (!Array.isArray(list)) return new Set();
      return new Set(list.filter(isPokemonType));
    } catch {
      return new Set();
    }
  }

  private restoreCoins(): number {
    const n = Number(safeGet(COINS_KEY));
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  private restoreStars(): Record<string, number> {
    try {
      const raw = safeGet(STARS_KEY);
      return raw ? (JSON.parse(raw) as Record<string, number>) : {};
    } catch {
      return {};
    }
  }
}
