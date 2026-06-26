/**
 * League / group standings: wins, losses, points and KO differential per trainer,
 * with a deterministic ranking. Pure and framework-free so round-robin and Swiss
 * formats can share it and it stays unit-testable.
 */
import type { MatchResult, Trainer } from './types';

export interface Standing {
  readonly trainerId: string;
  readonly name: string;
  readonly avatar: string;
  played: number;
  wins: number;
  losses: number;
  /** Opposing Pokémon knocked out across all matches. */
  koFor: number;
  /** Own Pokémon knocked out across all matches. */
  koAgainst: number;
  readonly isPlayer: boolean;
}

export const POINTS_PER_WIN = 3;

export function matchPoints(s: Standing): number {
  return s.wins * POINTS_PER_WIN;
}

export function koDiff(s: Standing): number {
  return s.koFor - s.koAgainst;
}

/** Fresh standings rows for a set of competitors. */
export function initStandings(trainers: readonly Trainer[]): Standing[] {
  return trainers.map((t) => ({
    trainerId: t.id,
    name: t.name,
    avatar: t.avatar,
    played: 0,
    wins: 0,
    losses: 0,
    koFor: 0,
    koAgainst: 0,
    isPlayer: !!t.isPlayer,
  }));
}

/**
 * Fold a finished match into the standings (returns a fresh array). `teamSize`
 * lets us derive KO counts from the surviving Pokémon each side reported.
 */
export function applyMatch(
  standings: readonly Standing[],
  aId: string,
  bId: string,
  result: Pick<MatchResult, 'winner' | 'survivorsA' | 'survivorsB'>,
  teamSize: number,
): Standing[] {
  const koOnB = teamSize - result.survivorsB;
  const koOnA = teamSize - result.survivorsA;
  return standings.map((s) => {
    if (s.trainerId === aId) {
      return {
        ...s,
        played: s.played + 1,
        wins: s.wins + (result.winner === 0 ? 1 : 0),
        losses: s.losses + (result.winner === 1 ? 1 : 0),
        koFor: s.koFor + koOnB,
        koAgainst: s.koAgainst + koOnA,
      };
    }
    if (s.trainerId === bId) {
      return {
        ...s,
        played: s.played + 1,
        wins: s.wins + (result.winner === 1 ? 1 : 0),
        losses: s.losses + (result.winner === 0 ? 1 : 0),
        koFor: s.koFor + koOnA,
        koAgainst: s.koAgainst + koOnB,
      };
    }
    return s;
  });
}

/** Rank by points, then KO differential, then KOs for, then fewer played. */
export function rankStandings(standings: readonly Standing[]): Standing[] {
  return [...standings].sort(
    (a, b) =>
      matchPoints(b) - matchPoints(a) ||
      koDiff(b) - koDiff(a) ||
      b.koFor - a.koFor ||
      a.name.localeCompare(b.name),
  );
}
