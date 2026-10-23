import { Injectable, inject, signal } from '@angular/core';
import { SaveService } from '../../core/storage/save.service';
import { isPokemonType, type PokemonType } from '../../core/utils/type-chart';

const BADGE_KEY = 'arena:badges';
const CHAMP_KEY = 'arena:champion';
const COINS_KEY = 'arena:coins';
const STARS_KEY = 'arena:stars';

/**
 * Persisted Arena progress: badges, champion flag, coins and best star rating per gym.
 * Stored through {@link SaveService} (the old raw `arena:*` keys are imported once).
 */
@Injectable({ providedIn: 'root' })
export class ArenaProgressStore {
  private readonly save = inject(SaveService);

  readonly badges = signal<ReadonlySet<PokemonType>>(this.restoreBadges());
  readonly isChampion = signal<boolean>(this.save.read<boolean>(CHAMP_KEY, false) === true);
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
    this.save.write(BADGE_KEY, [...next]);
  }

  /** Crown the player Champion. */
  crown(): void {
    this.isChampion.set(true);
    this.save.write(CHAMP_KEY, true);
  }

  addCoins(n: number): void {
    if (n <= 0) return;
    const next = this.coins() + n;
    this.coins.set(next);
    this.save.write(COINS_KEY, next);
  }

  /** Remember a star rating when it beats the previous best. */
  recordStars(type: PokemonType, stars: number): void {
    if (stars <= (this.stars()[type] ?? 0)) return;
    const next = { ...this.stars(), [type]: stars };
    this.stars.set(next);
    this.save.write(STARS_KEY, next);
  }

  /** Forget badges, champion flag and stars (coins are kept). */
  reset(): void {
    this.badges.set(new Set());
    this.save.write(BADGE_KEY, []);
    this.isChampion.set(false);
    this.stars.set({});
    this.save.remove(CHAMP_KEY);
    this.save.remove(STARS_KEY);
  }

  private restoreBadges(): ReadonlySet<PokemonType> {
    const list = this.save.read<unknown>(BADGE_KEY, []);
    return new Set(Array.isArray(list) ? list.filter(isPokemonType) : []);
  }

  private restoreCoins(): number {
    const n = this.save.read<unknown>(COINS_KEY, 0);
    return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : 0;
  }

  private restoreStars(): Record<string, number> {
    const raw = this.save.read<unknown>(STARS_KEY, {});
    return raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, number>)
      : {};
  }
}
