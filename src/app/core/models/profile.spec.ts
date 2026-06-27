import { describe, expect, it } from 'vitest';
import { evaluateAchievements, rankFor, rankProgress, unlockedCount, type ProfileState } from './profile';

const base: ProfileState = {
  badges: 0,
  totalBadges: 18,
  arenaChampion: false,
  bestDepth: 0,
  spireClears: 0,
  ascension: 0,
  tournamentWins: 0,
  tournamentRuns: 0,
  coins: 0,
};

describe('profile achievements', () => {
  it('unlocks nothing for a fresh trainer', () => {
    expect(unlockedCount(base)).toBe(0);
  });

  it('unlocks badge milestones progressively', () => {
    expect(evaluateAchievements({ ...base, badges: 1 }).find((a) => a.achievement.id === 'first-badge')!.unlocked).toBe(true);
    expect(evaluateAchievements({ ...base, badges: 18 }).find((a) => a.achievement.id === 'all-badges')!.unlocked).toBe(true);
    expect(evaluateAchievements({ ...base, badges: 9 }).find((a) => a.achievement.id === 'all-badges')!.unlocked).toBe(false);
  });

  it('unlocks spire and champion achievements', () => {
    const s = { ...base, arenaChampion: true, bestDepth: 15, spireClears: 1, ascension: 3, coins: 1200 };
    const ids = evaluateAchievements(s).filter((a) => a.unlocked).map((a) => a.achievement.id);
    expect(ids).toContain('champion');
    expect(ids).toContain('spire-clear');
    expect(ids).toContain('ascendant');
    expect(ids).toContain('wealthy');
  });
});

describe('rankFor', () => {
  it('escalates with progression', () => {
    expect(rankFor(base)).toBe('Rookie');
    expect(rankFor({ ...base, badges: 4 })).toBe('Adept');
    expect(rankFor({ ...base, badges: 18, arenaChampion: true, tournamentWins: 3, spireClears: 2 })).toBe('Legend');
  });
});

describe('rankProgress', () => {
  it('reports progress toward the next tier', () => {
    const p = rankProgress({ ...base, badges: 5 }); // score 5 → Adept (3..8)
    expect(p.rank).toBe('Adept');
    expect(p.next).toBe('Veteran');
    expect(p.toNext).toBe(3); // 8 - 5
    expect(p.pct).toBe(40); // (5-3)/(8-3)
  });

  it('caps at the top tier', () => {
    const p = rankProgress({ ...base, badges: 18, arenaChampion: true, tournamentWins: 3, spireClears: 2 });
    expect(p.rank).toBe('Legend');
    expect(p.next).toBeNull();
    expect(p.toNext).toBe(0);
    expect(p.pct).toBe(100);
  });
});
