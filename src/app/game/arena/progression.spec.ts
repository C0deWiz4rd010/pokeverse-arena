import { describe, expect, it } from 'vitest';
import { GYM_LEADERS, LEADER_LADDER, leaderLevel, leaderTier } from './gym-leaders';
import {
  BADGE_STAT,
  arenaProgress,
  badgeBoostSummary,
  badgeStatMultipliers,
  buildLadder,
  recommendedNext,
  starsFor,
} from './gym-progression';
import { CHAMPION, GAUNTLET, GAUNTLET_UNLOCK_BADGES, gauntletUnlocked } from './elite-four';
import type { PokemonType } from '../../core/utils/type-chart';

describe('gym ladder', () => {
  it('orders 18 leaders by ascending order with sane level/tier curves', () => {
    expect(LEADER_LADDER).toHaveLength(18);
    for (let i = 1; i < LEADER_LADDER.length; i++) {
      expect(LEADER_LADDER[i].order).toBeGreaterThan(LEADER_LADDER[i - 1].order);
    }
    expect(leaderLevel(1)).toBeLessThan(leaderLevel(18));
    expect(leaderTier(1)).toBe('basic');
    expect(leaderTier(18)).toBe('elite');
  });

  it('gives every leader a designed three-Pokémon team', () => {
    for (const l of LEADER_LADDER) {
      expect(l.team.length).toBe(3);
      expect(l.team.every((m) => typeof m.species === 'string' && m.species.length > 0)).toBe(true);
    }
  });

  it('recommends the lowest-order unbeaten leader', () => {
    const none = new Set<PokemonType>();
    expect(recommendedNext(none)?.type).toBe(LEADER_LADDER[0].type);
    const first = new Set<PokemonType>([LEADER_LADDER[0].type]);
    expect(recommendedNext(first)?.type).toBe(LEADER_LADDER[1].type);
  });

  it('flags cleared and next entries on the ladder', () => {
    const badges = new Set<PokemonType>([LEADER_LADDER[0].type]);
    const ladder = buildLadder(badges);
    expect(ladder[0].cleared).toBe(true);
    expect(ladder[1].next).toBe(true);
  });
});

describe('champion gauntlet', () => {
  it('opens only after enough badges', () => {
    expect(gauntletUnlocked(new Set())).toBe(false);
    const eight = new Set<PokemonType>(['fire', 'water', 'grass', 'electric', 'ice', 'rock', 'ground', 'bug']);
    expect(eight.size).toBe(GAUNTLET_UNLOCK_BADGES);
    expect(gauntletUnlocked(eight)).toBe(true);
  });

  it('has four Elites and one Champion at the end', () => {
    expect(GAUNTLET).toHaveLength(5);
    expect(GAUNTLET.filter((t) => t.champion)).toHaveLength(1);
    expect(CHAMPION.champion).toBe(true);
    expect(CHAMPION.team.length).toBeGreaterThanOrEqual(5);
  });

  it('reports progress toward the gauntlet', () => {
    const p = arenaProgress(new Set<PokemonType>(['fire', 'water']));
    expect(p.earned).toBe(2);
    expect(p.total).toBe(18);
    expect(p.toGauntlet).toBe(GAUNTLET_UNLOCK_BADGES - 2);
    expect(p.gauntletOpen).toBe(false);
  });
});

describe('badge boosts', () => {
  it('boosts the mapped stat per earned badge', () => {
    const mult = badgeStatMultipliers(new Set<PokemonType>(['fighting'])); // → attack
    expect(mult.attack).toBeCloseTo(1.04);
    expect(mult.speed).toBe(1);
  });

  it('stacks badges that share a stat', () => {
    // fighting/ground/dragon/dark all map to attack.
    const mult = badgeStatMultipliers(new Set<PokemonType>(['fighting', 'ground', 'dragon']));
    expect(mult.attack).toBeCloseTo(1.12);
  });

  it('summarises active boosts and maps a stat for every type', () => {
    expect(badgeBoostSummary(new Set())).toMatch(/no badge/i);
    expect(badgeBoostSummary(new Set<PokemonType>(['fire']))).toMatch(/SpA/);
    for (const l of GYM_LEADERS) expect(BADGE_STAT[l.type]).toBeTruthy();
  });
});

describe('star ratings', () => {
  it('awards 3 for a flawless clear, fewer for losses', () => {
    expect(starsFor(3, 3)).toBe(3);
    expect(starsFor(2, 3)).toBe(2);
    expect(starsFor(1, 3)).toBe(1);
    expect(starsFor(0, 3)).toBe(0);
  });
});

describe('gym fields & dialogue', () => {
  it('themes elemental gyms with a battlefield and every leader has an ace taunt', () => {
    const fire = GYM_LEADERS.find((l) => l.type === 'fire')!;
    expect(fire.gymField?.weather).toBe('sun');
    const electric = GYM_LEADERS.find((l) => l.type === 'electric')!;
    expect(electric.gymField?.terrain).toBe('electric');
    for (const l of GYM_LEADERS) expect(l.dialogue.ace.length).toBeGreaterThan(0);
  });
});
