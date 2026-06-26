/**
 * Pure helpers describing a player's path through the gym ladder: which leader is
 * cleared, what to tackle next, and whether the Champion Gauntlet has opened.
 */
import type { PokemonType } from '../../core/utils/type-chart';
import { LEADER_LADDER, type GymLeader } from './gym-leaders';
import { GAUNTLET_UNLOCK_BADGES, gauntletUnlocked } from './elite-four';

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
