/**
 * Pure helpers describing a player's path through the gym ladder: which leader is
 * cleared, what to tackle next, and whether the Champion Gauntlet has opened.
 */
import type { PokemonType } from '../../core/utils/type-chart';
import type { StatKey } from '../../core/utils/stat-calculator';
import { LEADER_LADDER, type GymLeader } from './gym-leaders';
import { GAUNTLET_UNLOCK_BADGES, gauntletUnlocked } from './elite-four';

/** Which stat each badge empowers — mirrors the games' badge boosts. */
export const BADGE_STAT: Record<PokemonType, StatKey> = {
  normal: 'hp',
  fire: 'special-attack',
  water: 'special-defense',
  electric: 'speed',
  grass: 'defense',
  ice: 'special-defense',
  fighting: 'attack',
  poison: 'defense',
  ground: 'attack',
  flying: 'speed',
  psychic: 'special-attack',
  bug: 'speed',
  rock: 'defense',
  ghost: 'special-attack',
  dragon: 'attack',
  dark: 'attack',
  steel: 'defense',
  fairy: 'special-defense',
};

/** Each earned badge grants this fractional boost to its mapped stat. */
export const BADGE_BOOST_PER = 0.04;

/** Aggregate stat multipliers from the player's earned badges (1 = none). */
export function badgeStatMultipliers(badges: ReadonlySet<PokemonType>): Record<StatKey, number> {
  const mult: Record<StatKey, number> = {
    hp: 1,
    attack: 1,
    defense: 1,
    'special-attack': 1,
    'special-defense': 1,
    speed: 1,
  };
  for (const type of badges) mult[BADGE_STAT[type]] += BADGE_BOOST_PER;
  return mult;
}

/** A short "+X% Atk, +Y% Spe" summary of the active badge boosts. */
export function badgeBoostSummary(badges: ReadonlySet<PokemonType>): string {
  const mult = badgeStatMultipliers(badges);
  const short: Record<StatKey, string> = {
    hp: 'HP', attack: 'Atk', defense: 'Def', 'special-attack': 'SpA', 'special-defense': 'SpD', speed: 'Spe',
  };
  const parts = (Object.keys(mult) as StatKey[])
    .filter((k) => mult[k] > 1)
    .map((k) => `+${Math.round((mult[k] - 1) * 100)}% ${short[k]}`);
  return parts.length ? parts.join(' · ') : 'No badge boosts yet';
}

/** Stars for a clear: 3 = flawless (no faints), 2 = lost one, 1 = scraped through. */
export function starsFor(survivors: number, teamSize: number): 0 | 1 | 2 | 3 {
  if (survivors <= 0) return 0;
  const lost = teamSize - survivors;
  if (lost <= 0) return 3;
  if (lost === 1) return 2;
  return 1;
}

export interface LadderEntry {
  readonly leader: GymLeader;
  readonly cleared: boolean;
  /** The single recommended next challenge. */
  readonly next: boolean;
}

/** Build the ordered ladder annotated with cleared / next-up flags. */
export function buildLadder(badges: ReadonlySet<PokemonType>): LadderEntry[] {
  const nextLeader = recommendedNext(badges);
  return LEADER_LADDER.map((leader) => ({
    leader,
    cleared: badges.has(leader.type),
    next: leader.type === nextLeader?.type,
  }));
}

/** The lowest-order leader the player has not yet beaten. */
export function recommendedNext(badges: ReadonlySet<PokemonType>): GymLeader | null {
  return LEADER_LADDER.find((l) => !badges.has(l.type)) ?? null;
}

export interface ArenaProgress {
  readonly earned: number;
  readonly total: number;
  readonly toGauntlet: number;
  readonly gauntletOpen: boolean;
}

export function arenaProgress(badges: ReadonlySet<PokemonType>): ArenaProgress {
  return {
    earned: badges.size,
    total: LEADER_LADDER.length,
    toGauntlet: Math.max(0, GAUNTLET_UNLOCK_BADGES - badges.size),
    gauntletOpen: gauntletUnlocked(badges),
  };
}
