/**
 * Wild-encounter generation and a catch mini-loop for the World Explorer's
 * Expedition mode. Pure and seeded so a roam is reproducible and unit-testable.
 * Encounters are drawn from a region's native dex range; rarity sets the level
 * band and the base catch rate; better balls raise the odds.
 */
import { SeededRng } from '../../core/utils/rng';
import { regionDexCount, type Region } from './regions';

export type Rarity = 'common' | 'uncommon' | 'rare';

export interface WildEncounter {
  readonly dex: number;
  readonly name: string;
  readonly level: number;
  readonly rarity: Rarity;
  /** Base catch chance before ball modifiers (0..1). */
  readonly catchRate: number;
}

export type BallId = 'poke' | 'great' | 'ultra';

export const BALLS: Record<BallId, { label: string; mult: number }> = {
  poke: { label: 'Poké Ball', mult: 1 },
  great: { label: 'Great Ball', mult: 1.5 },
  ultra: { label: 'Ultra Ball', mult: 2 },
};

const RARITY: Record<Rarity, { weight: number; level: [number, number]; base: number }> = {
  common: { weight: 60, level: [4, 16], base: 0.7 },
  uncommon: { weight: 30, level: [12, 28], base: 0.45 },
  rare: { weight: 10, level: [22, 40], base: 0.25 },
};

function pickRarity(rng: SeededRng): Rarity {
  const roll = rng.int(1, 100);
  if (roll <= RARITY.common.weight) return 'common';
  if (roll <= RARITY.common.weight + RARITY.uncommon.weight) return 'uncommon';
  return 'rare';
}

/** Generate a deterministic wild encounter within a region. */
export function rollEncounter(region: Region, seed: number | string): WildEncounter {
  const rng = new SeededRng(`enc-${region.id}-${seed}`);
  const dex = rng.int(region.dexStart, region.dexEnd);
  const rarity = pickRarity(rng);
  const [lo, hi] = RARITY[rarity].level;
  return {
    dex,
    name: `#${dex}`,
    level: rng.int(lo, hi),
    rarity,
    catchRate: RARITY[rarity].base,
  };
}

/** Effective catch chance for an encounter with a given ball, capped at 95%. */
export function catchChance(encounter: WildEncounter, ball: BallId): number {
  return Math.min(0.95, encounter.catchRate * BALLS[ball].mult);
}

/** Resolve a catch attempt against an explicit roll in [0, 1). */
export function attemptCatch(encounter: WildEncounter, ball: BallId, roll: number): boolean {
  return roll < catchChance(encounter, ball);
}

/** Percentage of a region's native dex the player has registered. */
export function regionCompletion(caught: ReadonlySet<number>, region: Region): number {
  let owned = 0;
  for (let dex = region.dexStart; dex <= region.dexEnd; dex++) if (caught.has(dex)) owned++;
  return Math.round((owned / regionDexCount(region)) * 100);
}

/** How many of a region's natives the player has registered. */
export function regionCaught(caught: ReadonlySet<number>, region: Region): number {
  let owned = 0;
  for (let dex = region.dexStart; dex <= region.dexEnd; dex++) if (caught.has(dex)) owned++;
  return owned;
}
