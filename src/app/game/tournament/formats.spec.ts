import { describe, expect, it } from 'vitest';
import { applyMatch, initStandings, rankStandings, matchPoints } from './standings';
import { pairKey, roundRobinFixtureCount, roundRobinSchedule, swissPairings, swissRounds } from './round-robin';
import { seedSlots, seedTrainers } from './format';
import { prizeFor } from './history';
import type { Trainer } from './types';

function trainer(id: string, name = id, isPlayer = false): Trainer {
  return { id, name, title: 'T', avatar: '', team: [], isPlayer };
}

describe('standings', () => {
  const trainers = [trainer('a'), trainer('b'), trainer('c')];

  it('records wins, losses and KO differential', () => {
    let s = initStandings(trainers);
    s = applyMatch(s, 'a', 'b', { winner: 0, survivorsA: 2, survivorsB: 0 }, 3);
    const a = s.find((x) => x.trainerId === 'a')!;
    const b = s.find((x) => x.trainerId === 'b')!;
    expect(a.wins).toBe(1);
    expect(a.koFor).toBe(3); // wiped b's team of 3
    expect(a.koAgainst).toBe(1); // lost one of its own
    expect(b.losses).toBe(1);
    expect(matchPoints(a)).toBe(3);
  });

  it('ranks by points then KO differential', () => {
    let s = initStandings(trainers);
    s = applyMatch(s, 'a', 'b', { winner: 0, survivorsA: 3, survivorsB: 0 }, 3);
    s = applyMatch(s, 'c', 'b', { winner: 0, survivorsA: 1, survivorsB: 0 }, 3);
    const ranked = rankStandings(s);
    expect(ranked[0].trainerId).toBe('a'); // same points as c, better KO diff
    expect(ranked[2].trainerId).toBe('b');
  });
});

describe('round robin', () => {
  it('schedules every pair exactly once', () => {
    const ids = ['a', 'b', 'c', 'd'];
    const rounds = roundRobinSchedule(ids);
    const fixtures = rounds.flat();
    expect(fixtures.length).toBe(roundRobinFixtureCount(4)); // 6
    const keys = new Set(fixtures.map((f) => pairKey(f.aId, f.bId)));
    expect(keys.size).toBe(6);
    // No trainer appears twice in a single round.
    for (const round of rounds) {
      const seen = new Set(round.flatMap((f) => [f.aId, f.bId]));
      expect(seen.size).toBe(round.length * 2);
    }
  });

  it('handles an odd field with byes', () => {
    const fixtures = roundRobinSchedule(['a', 'b', 'c']).flat();
    expect(fixtures.length).toBe(roundRobinFixtureCount(3)); // 3
  });
});

describe('swiss', () => {
  it('pairs by record and avoids rematches', () => {
    const standings = initStandings([trainer('a'), trainer('b'), trainer('c'), trainer('d')]);
    const first = swissPairings(standings, new Set());
    expect(first.length).toBe(2);
    const played = new Set(first.map((f) => pairKey(f.aId, f.bId)));
    const second = swissPairings(standings, played);
    // None of the second-round pairings repeats a first-round pairing.
    for (const f of second) expect(played.has(pairKey(f.aId, f.bId))).toBe(false);
  });

  it('recommends ceil(log2 n) rounds', () => {
    expect(swissRounds(16)).toBe(4);
    expect(swissRounds(8)).toBe(3);
  });
});

describe('seeding', () => {
  it('spreads top seeds so 1 and 2 are in opposite halves', () => {
    const slots = seedSlots(16);
    expect(slots).toHaveLength(16);
    expect(slots[0]).toBe(1);
    expect(new Set(slots).size).toBe(16);
    const firstHalf = slots.slice(0, 8);
    const secondHalf = slots.slice(8);
    expect(firstHalf).toContain(1);
    expect(secondHalf).toContain(2); // seed 1 and seed 2 cannot meet before the final
  });

  it('places the strongest trainer in the first slot', () => {
    const sorted = Array.from({ length: 8 }, (_, i) => trainer(`t${i}`, `T${i}`));
    const seeded = seedTrainers(sorted);
    expect(seeded[0].id).toBe('t0');
  });
});

describe('prizes', () => {
  it('rewards the winner most and scales with field', () => {
    expect(prizeFor(1, 16)).toBeGreaterThan(prizeFor(2, 16));
    expect(prizeFor(1, 32)).toBeGreaterThan(prizeFor(1, 16));
    expect(prizeFor(16, 16)).toBeLessThan(prizeFor(2, 16));
  });
});
