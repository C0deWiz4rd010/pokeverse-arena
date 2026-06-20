/**
 * Pure bracket construction and progression for a fixed Round-of-16,
 * single-elimination tournament. Winners flow inward: 8 R16 matches → 4
 * quarterfinals → 2 semifinals → 1 final → champion.
 *
 * Mutations return a fresh {@link Bracket} object (structurally cloned, sharing
 * the immutable {@link Trainer} references) so they compose cleanly with signals
 * and OnPush change detection.
 */
import {
  ROUND_ORDER,
  ROUND_SIZE,
  type Bracket,
  type BracketMatch,
  type RoundId,
  type Trainer,
} from './types';

function nextRoundOf(round: RoundId): RoundId | null {
  const idx = ROUND_ORDER.indexOf(round);
  return idx >= 0 && idx < ROUND_ORDER.length - 1 ? ROUND_ORDER[idx + 1] : null;
}

function makeMatch(round: RoundId, slot: number, a: Trainer | null, b: Trainer | null): BracketMatch {
  return { id: `${round}-${slot}`, round, slot, a, b, winner: null, played: false };
}

function emptyRound(round: RoundId): BracketMatch[] {
  return Array.from({ length: ROUND_SIZE[round] }, (_, slot) => makeMatch(round, slot, null, null));
}

/** Build a fresh bracket from exactly 16 seeded trainers (seed order = pairing). */
export function buildBracket(trainers: readonly Trainer[]): Bracket {
  if (trainers.length !== 16) {
    throw new Error(`A bracket needs exactly 16 trainers, got ${trainers.length}`);
  }
  const r16 = Array.from({ length: ROUND_SIZE.r16 }, (_, slot) =>
    makeMatch('r16', slot, trainers[slot * 2], trainers[slot * 2 + 1]),
  );
  return {
    rounds: { r16, qf: emptyRound('qf'), sf: emptyRound('sf'), final: emptyRound('final') },
    champion: null,
  };
}

function cloneBracket(b: Bracket): Bracket {
  const rounds = {} as Record<RoundId, BracketMatch[]>;
  for (const r of ROUND_ORDER) rounds[r] = b.rounds[r].map((m) => ({ ...m }));
  return { rounds, champion: b.champion };
}

export function findMatch(bracket: Bracket, matchId: string): BracketMatch | undefined {
  for (const r of ROUND_ORDER) {
    const m = bracket.rounds[r].find((x) => x.id === matchId);
    if (m) return m;
  }
  return undefined;
}

/** True when both competitors are known and the match has not been played. */
export function isReady(match: BracketMatch): boolean {
  return !match.played && match.a !== null && match.b !== null;
}

/** The earliest ready match (used to drive the next thing to play/simulate). */
export function nextReadyMatch(bracket: Bracket): BracketMatch | null {
  for (const r of ROUND_ORDER) {
    const m = bracket.rounds[r].find(isReady);
    if (m) return m;
  }
  return null;
}

/**
 * Record a match result and advance the winner into the next round (or crown the
 * champion for the final). Returns a new bracket.
 */
export function reportResult(bracket: Bracket, matchId: string, winner: 0 | 1): Bracket {
  const next = cloneBracket(bracket);
  const match = findMatch(next, matchId);
  if (!match) throw new Error(`Unknown match: ${matchId}`);
  if (match.a === null || match.b === null) throw new Error(`Match ${matchId} is not ready`);

  match.winner = winner;
  match.played = true;
  const advancer = winner === 0 ? match.a : match.b;

  const upcoming = nextRoundOf(match.round);
  if (upcoming === null) {
    next.champion = advancer;
    return next;
  }
  const target = next.rounds[upcoming][Math.floor(match.slot / 2)];
  if (match.slot % 2 === 0) target.a = advancer;
  else target.b = advancer;
  return next;
}

/** Locate the player's pending match (if they are still in the running). */
export function playerMatch(bracket: Bracket): BracketMatch | null {
  for (const r of ROUND_ORDER) {
    const m = bracket.rounds[r].find(
      (x) => isReady(x) && (x.a?.isPlayer || x.b?.isPlayer),
    );
    if (m) return m;
  }
  return null;
}
