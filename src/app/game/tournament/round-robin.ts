/**
 * Round-robin scheduling (circle method) and Swiss pairing — the non-elimination
 * tournament formats. Both produce {@link Standing} tables; the service plays the
 * fixtures (CPU matches headless, the player's interactively) and folds results
 * back in. Pure and deterministic.
 */
import type { Standing } from './standings';
import { matchPoints } from './standings';

export interface Fixture {
  readonly aId: string;
  readonly bId: string;
}

/**
 * Full single round-robin as a list of rounds (each round is a set of fixtures
 * with no repeated trainer). Uses the circle method; a bye is inserted for odd
 * fields and filtered out.
 */
export function roundRobinSchedule(ids: readonly string[]): Fixture[][] {
  const players = [...ids];
  if (players.length % 2 === 1) players.push('__bye__');
  const n = players.length;
  const rounds: Fixture[][] = [];
  const fixed = players[0];
  let rotating = players.slice(1);

  for (let r = 0; r < n - 1; r++) {
    const lineup = [fixed, ...rotating];
    const fixtures: Fixture[] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = lineup[i];
      const b = lineup[n - 1 - i];
      if (a !== '__bye__' && b !== '__bye__') fixtures.push({ aId: a, bId: b });
    }
    rounds.push(fixtures);
    // Rotate all but the fixed player clockwise.
    rotating = [lineup[n - 1], ...rotating.slice(0, rotating.length - 1)];
  }
  return rounds;
}

/** Total number of fixtures in a round-robin of `n` players. */
export function roundRobinFixtureCount(n: number): number {
  return (n * (n - 1)) / 2;
}

/** A stable key for an unordered pair, used to avoid Swiss rematches. */
export function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/**
 * Swiss pairing for one round: sort by current points (ties broken by name for
 * determinism), then greedily pair adjacent players, skipping a partner that has
 * already been played when an alternative exists.
 */
export function swissPairings(
  standings: readonly Standing[],
  played: ReadonlySet<string>,
): Fixture[] {
  const pool = [...standings].sort(
    (a, b) => matchPoints(b) - matchPoints(a) || a.name.localeCompare(b.name),
  );
  const ids = pool.map((s) => s.trainerId);
  const used = new Set<string>();
  const fixtures: Fixture[] = [];

  for (let i = 0; i < ids.length; i++) {
    const a = ids[i];
    if (used.has(a)) continue;
    let partner: string | null = null;
    let fallback: string | null = null;
    for (let j = i + 1; j < ids.length; j++) {
      const b = ids[j];
      if (used.has(b)) continue;
      if (fallback === null) fallback = b;
      if (!played.has(pairKey(a, b))) {
        partner = b;
        break;
      }
    }
    const chosen = partner ?? fallback;
    if (chosen) {
      used.add(a);
      used.add(chosen);
      fixtures.push({ aId: a, bId: chosen });
    }
  }
  return fixtures;
}

/** Recommended number of Swiss rounds for a field of `n` (ceil(log2 n)). */
export function swissRounds(n: number): number {
  return Math.max(1, Math.ceil(Math.log2(Math.max(2, n))));
}
