/**
 * Badge boons — every gym badge grants a passive field perk, so victories
 * keep paying off between battles. Pure modifiers over the badge list; the
 * service and battle apply them, the field menu lists the active ones.
 */

export interface BadgeBoon {
  readonly badge: string;
  readonly name: string;
  readonly desc: string;
}

export const BADGE_BOONS: readonly BadgeBoon[] = [
  { badge: 'Hive Badge', name: 'Keen Throw', desc: 'Poké Balls are 15 % more likely to catch.' },
  { badge: 'Boulder Badge', name: 'Haggler', desc: 'Poké Mart prices drop by 10 %.' },
  { badge: 'Knuckle Badge', name: 'Hard Training', desc: 'Battles grant 10 % more XP.' },
  { badge: 'Tide Badge', name: "Angler's Luck", desc: 'Fish bite 15 % more often.' },
];

/** Catch-rate multiplier (Hive Badge). */
export function catchBonus(badges: readonly string[]): number {
  return badges.includes('Hive Badge') ? 1.15 : 1;
}

/** Shop price multiplier (Boulder Badge). */
export function shopDiscount(badges: readonly string[]): number {
  return badges.includes('Boulder Badge') ? 0.9 : 1;
}

/** XP multiplier (Knuckle Badge). */
export function xpBonus(badges: readonly string[]): number {
  return badges.includes('Knuckle Badge') ? 1.1 : 1;
}

/** Additive fishing bite-rate bonus (Tide Badge), capped by the caller. */
export function fishBiteBonus(badges: readonly string[]): number {
  return badges.includes('Tide Badge') ? 0.15 : 0;
}

/** The boons currently in effect for a badge list, in story order. */
export function activeBoons(badges: readonly string[]): BadgeBoon[] {
  return BADGE_BOONS.filter((b) => badges.includes(b.badge));
}
