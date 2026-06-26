/**
 * Curated, data-driven held-item registry. Like {@link abilities}, items are
 * declarative descriptors the turn engine reads — keeping them pure and
 * unit-testable. Consumable items (berries, Focus Sash) flip `BattleSide.itemUsed`
 * when they trigger.
 */
import type { PokemonType } from '../../core/utils/type-chart';
import type { StatusCondition } from './status';

export type ItemId =
  | 'leftovers'
  | 'black-sludge'
  | 'life-orb'
  | 'choice-band'
  | 'choice-specs'
  | 'choice-scarf'
  | 'assault-vest'
  | 'eviolite'
  | 'focus-sash'
  | 'rocky-helmet'
  | 'sitrus-berry'
  | 'lum-berry'
  | 'flame-orb'
  | 'toxic-orb'
  | 'expert-belt'
  | 'muscle-band'
  | 'wise-glasses'
  | 'heat-rock'
  | 'damp-rock'
  | 'smooth-rock'
  | 'icy-rock';

export type ItemStat = 'attack' | 'special-attack' | 'special-defense' | 'speed' | 'defense';

export interface HeldItem {
  readonly id: ItemId;
  readonly name: string;
  readonly blurb: string;
  /** Flat multiplier on the holder's attack damage (Life Orb 1.3). */
  readonly damageMultiplier?: number;
  /** Holder recoil per attack, as a fraction of max HP (Life Orb 0.1). */
  readonly recoil?: number;
  /** Locks the holder into the first move chosen (Choice items). */
  readonly choiceLock?: boolean;
  /** Multiply one of the holder's stats. */
  readonly statMultiplier?: { stat: ItemStat; factor: number };
  /** Boost moves of one type (×factor, e.g. type plates 1.2). */
  readonly typeBoost?: { type: PokemonType; factor: number };
  /** Boost super-effective hits (Expert Belt 1.2). */
  readonly expertBelt?: number;
  /** Boost physical/special moves of either class (Muscle Band / Wise Glasses). */
  readonly classBoost?: { special: boolean; factor: number };
  /** Survive a KO from full HP at 1 HP, once (Focus Sash). */
  readonly focusSash?: boolean;
  /** End-of-turn heal fraction (Leftovers 1/16). */
  readonly leftovers?: number;
  /** Heal fraction when HP first drops to ≤1/2, consumed (Sitrus 0.25). */
  readonly pinchHeal?: number;
  /** Cures (and is consumed by) a status, or 'all' (Lum). */
  readonly curesStatus?: StatusCondition | 'all';
  /** Inflicts this status on the holder at end of the first turn (orbs). */
  readonly selfStatus?: StatusCondition;
  /** Both defences ×1.5 (Eviolite). */
  readonly eviolite?: boolean;
  /** Damage the attacker for this fraction of their max HP on contact. */
  readonly rockyHelmet?: number;
  /** Extends matching weather to 8 turns when this Pokémon sets it (rocks). */
  readonly weatherRock?: 'sun' | 'rain' | 'sand' | 'hail' | 'snow';
}

const LIST: readonly HeldItem[] = [
  { id: 'leftovers', name: 'Leftovers', blurb: 'Restores a little HP each turn.', leftovers: 1 / 16 },
  { id: 'black-sludge', name: 'Black Sludge', blurb: 'Heals Poison-types each turn.', leftovers: 1 / 16 },
  { id: 'life-orb', name: 'Life Orb', blurb: 'Boosts moves but costs HP.', damageMultiplier: 1.3, recoil: 0.1 },
  { id: 'choice-band', name: 'Choice Band', blurb: '×1.5 Attack, but locks the move.', statMultiplier: { stat: 'attack', factor: 1.5 }, choiceLock: true },
  { id: 'choice-specs', name: 'Choice Specs', blurb: '×1.5 Sp. Atk, but locks the move.', statMultiplier: { stat: 'special-attack', factor: 1.5 }, choiceLock: true },
  { id: 'choice-scarf', name: 'Choice Scarf', blurb: '×1.5 Speed, but locks the move.', statMultiplier: { stat: 'speed', factor: 1.5 }, choiceLock: true },
  { id: 'assault-vest', name: 'Assault Vest', blurb: '×1.5 Sp. Def (attacks only).', statMultiplier: { stat: 'special-defense', factor: 1.5 } },
  { id: 'eviolite', name: 'Eviolite', blurb: 'Boosts both defences of the not-fully-evolved.', eviolite: true },
  { id: 'focus-sash', name: 'Focus Sash', blurb: 'Survives a KO once from full HP.', focusSash: true },
  { id: 'rocky-helmet', name: 'Rocky Helmet', blurb: 'Hurts attackers on contact.', rockyHelmet: 1 / 6 },
  { id: 'sitrus-berry', name: 'Sitrus Berry', blurb: 'Restores HP when low.', pinchHeal: 0.25 },
  { id: 'lum-berry', name: 'Lum Berry', blurb: 'Cures any status, once.', curesStatus: 'all' },
  { id: 'flame-orb', name: 'Flame Orb', blurb: 'Burns the holder (combos with Guts).', selfStatus: 'burn' },
  { id: 'toxic-orb', name: 'Toxic Orb', blurb: 'Badly poisons the holder (combos with Guts).', selfStatus: 'toxic' },
  { id: 'expert-belt', name: 'Expert Belt', blurb: 'Boosts super-effective hits.', expertBelt: 1.2 },
  { id: 'muscle-band', name: 'Muscle Band', blurb: 'Boosts physical moves.', classBoost: { special: false, factor: 1.1 } },
  { id: 'wise-glasses', name: 'Wise Glasses', blurb: 'Boosts special moves.', classBoost: { special: true, factor: 1.1 } },
  { id: 'heat-rock', name: 'Heat Rock', blurb: 'Extends sun.', weatherRock: 'sun' },
  { id: 'damp-rock', name: 'Damp Rock', blurb: 'Extends rain.', weatherRock: 'rain' },
  { id: 'smooth-rock', name: 'Smooth Rock', blurb: 'Extends sandstorm.', weatherRock: 'sand' },
  { id: 'icy-rock', name: 'Icy Rock', blurb: 'Extends hail/snow.', weatherRock: 'snow' },
];

const BY_ID = new Map<ItemId, HeldItem>(LIST.map((i) => [i.id, i]));

export const HELD_ITEMS: readonly HeldItem[] = LIST;

export function itemById(id: ItemId | undefined): HeldItem | undefined {
  return id ? BY_ID.get(id) : undefined;
}

export function itemName(id: ItemId | undefined): string {
  return itemById(id)?.name ?? '';
}
