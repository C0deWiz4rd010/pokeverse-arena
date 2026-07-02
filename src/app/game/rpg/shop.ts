/**
 * Poké Mart stock. Prices come from the item catalogue; selling is half price.
 */
import type { ItemId } from './rpg-types';
import { ITEMS } from './items-catalog';

/** Items a standard early-game Mart sells. */
export const MART_STOCK: readonly ItemId[] = [
  'poke-ball',
  'great-ball',
  'potion',
  'super-potion',
  'antidote',
  'paralyze-heal',
  'awakening',
  'revive',
  'sitrus-berry',
  'lum-berry',
  'muscle-band',
  'wise-glasses',
  'leftovers',
];

export function buyPrice(id: ItemId): number {
  return ITEMS[id].price;
}

export function sellPrice(id: ItemId): number {
  return Math.floor(ITEMS[id].price / 2);
}
