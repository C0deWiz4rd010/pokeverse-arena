/**
 * Shared economy helpers for the roguelike modes (Ascension Spire, Odyssey): coin income with
 * relic multipliers, duplicate-relic refunds and held-item assignment. Pure — the services
 * keep the signals and toasts.
 */
import type { Battler, ItemId } from '../engine';
import { coinMultiplier, type RelicId } from '../spire/relics';

/** Coins refunded when a relic the player already owns is offered again. */
export const DUPLICATE_RELIC_REFUND = 40;

/** Coins actually earned for a base amount, scaled by the owned relics (never negative). */
export function coinsEarned(base: number, relics: readonly RelicId[]): number {
  if (base <= 0) return 0;
  return Math.round(base * coinMultiplier(relics));
}

export interface RelicGrant {
  readonly relics: readonly RelicId[];
  /** Base coins to pay out (before multipliers) when the relic was a duplicate, else 0. */
  readonly refund: number;
  readonly duplicate: boolean;
}

/** Add a relic to the owned list, or turn a duplicate into a coin refund. */
export function grantRelic(owned: readonly RelicId[], id: RelicId): RelicGrant {
  if (owned.includes(id)) return { relics: owned, refund: DUPLICATE_RELIC_REFUND, duplicate: true };
  return { relics: [...owned, id], refund: 0, duplicate: false };
}

/** Give `item` to the first member without one (or the lead when everyone holds something). */
export function equipFirstFree(
  party: readonly Battler[],
  item: ItemId,
): { readonly party: Battler[]; readonly index: number } {
  const free = party.findIndex((m) => !m.item);
  const index = free >= 0 ? free : 0;
  return { party: party.map((m, i) => (i === index ? { ...m, item } : m)), index };
}
