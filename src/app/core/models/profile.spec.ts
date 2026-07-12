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
  adventureBadges: 0,
  adventureCaught: 0,
  worldCaught: 0,
  shinyCaught: 0,
  contestRibbons: 0,
  rivalWins: 0,
  rivalLosses: 0,
  pickemHits: 0,
  dailyStreak: 0,
  dailyBest: 0,
  odysseyBestWave: 0,
  odysseyUnlocked: 0,
  fusionsRegistered: 0,
};

describe('profile achievements', () => {
  it('unlocks nothing for a fresh trainer', () => {
    expect(unlockedCount(base)).toBe(0);
  });

  it('unlocks odyssey milestones from wave depth and roster size', () => {
    const ids = (s: Partial<typeof base>) =>
      evaluateAchievements({ ...base, ...s }).filter((a) => a.unlocked).map((a) => a.achievement.id);
    expect(ids({ odysseyBestWave: 10 })).toContain('odyssey-10');
    expect(ids({ odysseyBestWave: 10 })).not.toContain('odyssey-30');
    expect(ids({ odysseyBestWave: 30 })).toContain('odyssey-30');
    expect(ids({ odysseyUnlocked: 12 })).toContain('odyssey-roster');
  });

  it('unlocks daily-streak milestones from the best streak', () => {
    const ids = evaluateAchievements({ ...base, dailyBest: 3 }).filter((a) => a.unlocked).map((a) => a.achievement.id);
    expect(ids).toContain('daily-3');
    expect(ids).not.toContain('daily-7');
    expect(evaluateAchievements({ ...base, dailyBest: 7 }).find((a) => a.achievement.id === 'daily-7')!.unlocked).toBe(true);
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

  it('unlocks adventure, world, contest, rival and oracle achievements', () => {
    const s = {
      ...base,
      adventureBadges: 1,
      adventureCaught: 12,
      worldCaught: 60,
      shinyCaught: 1,
      contestRibbons: 5,
      rivalWins: 4,
      rivalLosses: 1,
      pickemHits: 1,
    };
    const ids = evaluateAchievements(s).filter((a) => a.unlocked).map((a) => a.achievement.id);
    expect(ids).toEqual(expect.arrayContaining([
      'adv-badge', 'adv-catcher', 'world-50', 'shiny-one', 'ribbon-one', 'ribbon-all', 'rival-lead', 'oracle',
    ]));
    // A 4–2 record is not yet a 3-win lead.
    const close = evaluateAchievements({ ...base, rivalWins: 4, rivalLosses: 2 });
    expect(close.find((a) => a.achievement.id === 'rival-lead')!.unlocked).toBe(false);
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
