/**
 * Item catalogue — names, prices, and the effect each item applies. Pure data;
 * the battle/field code reads these to resolve item use.
 */
import type { ItemId } from './rpg-types';
import type { RpgBallId } from './catch';
import type { ItemId as HeldItemId, StatusCondition } from '../engine';

export type ItemCategory = 'ball' | 'heal' | 'status' | 'revive' | 'held' | 'key';

export interface ItemDef {
  readonly id: ItemId;
  readonly name: string;
  readonly category: ItemCategory;
  readonly price: number;
  readonly desc: string;
  /** HP restored (Infinity = full). */
  readonly heal?: number;
  /** Status this item cures ('all' = any). */
  readonly cure?: 'all' | StatusCondition;
  /** Fraction of max HP a revive restores (0.5 = revive, 1 = max revive). */
  readonly revive?: number;
  /** Engine held-item this bag item equips when given to a Pokémon. */
  readonly held?: HeldItemId;
  readonly usableInBattle: boolean;
  readonly usableOnField: boolean;
}

export const ITEMS: Record<ItemId, ItemDef> = {
  'poke-ball': { id: 'poke-ball', name: 'Poké Ball', category: 'ball', price: 200, desc: 'A device for catching wild Pokémon.', usableInBattle: true, usableOnField: false },
  'great-ball': { id: 'great-ball', name: 'Great Ball', category: 'ball', price: 600, desc: 'A good, high-performance Ball.', usableInBattle: true, usableOnField: false },
  'ultra-ball': { id: 'ultra-ball', name: 'Ultra Ball', category: 'ball', price: 1200, desc: 'An ultra-performance Ball.', usableInBattle: true, usableOnField: false },
  potion: { id: 'potion', name: 'Potion', category: 'heal', price: 300, desc: 'Restores 20 HP.', heal: 20, usableInBattle: true, usableOnField: true },
  'super-potion': { id: 'super-potion', name: 'Super Potion', category: 'heal', price: 700, desc: 'Restores 60 HP.', heal: 60, usableInBattle: true, usableOnField: true },
  'hyper-potion': { id: 'hyper-potion', name: 'Hyper Potion', category: 'heal', price: 1500, desc: 'Restores 120 HP.', heal: 120, usableInBattle: true, usableOnField: true },
  antidote: { id: 'antidote', name: 'Antidote', category: 'status', price: 100, desc: 'Cures poison.', cure: 'poison', usableInBattle: true, usableOnField: true },
  'paralyze-heal': { id: 'paralyze-heal', name: 'Paralyze Heal', category: 'status', price: 200, desc: 'Cures paralysis.', cure: 'paralysis', usableInBattle: true, usableOnField: true },
  awakening: { id: 'awakening', name: 'Awakening', category: 'status', price: 250, desc: 'Wakes a sleeping Pokémon.', cure: 'sleep', usableInBattle: true, usableOnField: true },
  'burn-heal': { id: 'burn-heal', name: 'Burn Heal', category: 'status', price: 250, desc: 'Heals a burn.', cure: 'burn', usableInBattle: true, usableOnField: true },
  'ice-heal': { id: 'ice-heal', name: 'Ice Heal', category: 'status', price: 250, desc: 'Defrosts a Pokémon.', cure: 'freeze', usableInBattle: true, usableOnField: true },
  'full-heal': { id: 'full-heal', name: 'Full Heal', category: 'status', price: 600, desc: 'Cures any status problem.', cure: 'all', usableInBattle: true, usableOnField: true },
  revive: { id: 'revive', name: 'Revive', category: 'revive', price: 1500, desc: 'Revives a fainted Pokémon to half HP.', revive: 0.5, usableInBattle: true, usableOnField: true },
  leftovers: { id: 'leftovers', name: 'Leftovers', category: 'held', price: 3000, desc: 'Hold: restores a little HP each battle turn.', held: 'leftovers', usableInBattle: false, usableOnField: true },
  'sitrus-berry': { id: 'sitrus-berry', name: 'Sitrus Berry', category: 'held', price: 750, desc: 'Hold: restores HP once when it runs low.', held: 'sitrus-berry', usableInBattle: false, usableOnField: true },
  'lum-berry': { id: 'lum-berry', name: 'Lum Berry', category: 'held', price: 900, desc: 'Hold: cures any status problem, once.', held: 'lum-berry', usableInBattle: false, usableOnField: true },
  'muscle-band': { id: 'muscle-band', name: 'Muscle Band', category: 'held', price: 2200, desc: 'Hold: slightly boosts physical moves.', held: 'muscle-band', usableInBattle: false, usableOnField: true },
  'wise-glasses': { id: 'wise-glasses', name: 'Wise Glasses', category: 'held', price: 2200, desc: 'Hold: slightly boosts special moves.', held: 'wise-glasses', usableInBattle: false, usableOnField: true },
  'exp-share': { id: 'exp-share', name: 'EXP Share', category: 'key', price: 4000, desc: 'While in your Bag, benched party members earn half XP from wins.', usableInBattle: false, usableOnField: false },
};

export const ITEM_ORDER: readonly ItemId[] = [
  'poke-ball', 'great-ball', 'ultra-ball',
  'potion', 'super-potion', 'hyper-potion',
  'antidote', 'paralyze-heal', 'awakening', 'burn-heal', 'ice-heal', 'full-heal',
  'revive',
  'leftovers', 'sitrus-berry', 'lum-berry', 'muscle-band', 'wise-glasses',
  'exp-share',
];

/** Bag id for an engine held-item id (to return a swapped-out item to the Bag). */
export function bagIdForHeld(held: HeldItemId): ItemId | null {
  for (const def of Object.values(ITEMS)) if (def.held === held) return def.id;
  return null;
}

export function isBall(id: ItemId): id is ItemId & RpgBallId {
  return ITEMS[id].category === 'ball';
}
