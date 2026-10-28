import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { ACHIEVEMENTS, DEFAULT_IDENTITY } from '../../core/models/profile';
import { SaveService } from '../../core/storage/save.service';
import { LEADER_LADDER } from '../../game/arena/gym-leaders';
import { dailyKey } from '../../game/daily/daily';
import { ProfileService } from './profile.service';

describe('ProfileService', () => {
  let save: SaveService;

  const create = (): ProfileService => TestBed.inject(ProfileService);

  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
    save = TestBed.inject(SaveService);
  });

  it('starts from an empty, rookie profile with default identity', () => {
    const svc = create();
    expect(svc.identity()).toEqual(DEFAULT_IDENTITY);
    expect(svc.state()).toMatchObject({
      badges: 0,
      totalBadges: LEADER_LADDER.length,
      arenaChampion: false,
      tournamentRuns: 0,
      worldCaught: 0,
      dailyStreak: 0,
      fusionsRegistered: 0,
      nuzlockeBadges: 0,
    });
    expect(svc.rank()).toBe('Rookie');
    expect(svc.unlocked()).toBe(svc.achievements().filter((a) => a.unlocked).length);
    expect(svc.totalAchievements).toBe(ACHIEVEMENTS.length);
    expect(svc.completion()).toBe(Math.round((svc.unlocked() / svc.totalAchievements) * 100));
    expect(svc.progress().next).toBe('Adept');
  });

  it('aggregates progression from every system on refresh()', () => {
    const svc = create();
    save.write('arena:badges', ['a', 'b', 'c']);
    save.write('arena:champion', true);
    save.write('arena:coins', 120);
    save.write('spire:meta', {
      bestDepth: 9,
      clears: 2,
      bankedCoins: 30,
      ascension: 3,
      chimeraWins: 1,
    });
    save.write('tournaments:history', [
      { playerWon: true, prize: 50, pickBonus: 10 },
      { playerWon: false, prize: 5 },
      { playerWon: true, prize: 25 },
    ]);
    save.write('tournaments:rival', {
      v: 1,
      name: 'Silas',
      title: 'Your Rival',
      seed: 's',
      playerWins: 4,
      rivalWins: 2,
      lastWinner: null,
    });
    save.write('rpg:save', { badges: ['x', 'y'], caught: [1, 2, 3], nuzlocke: { on: true } });
    save.write('rpg:save:2', { badges: ['x', 'y', 'z', 'w'], nuzlocke: {} });
    save.write('rpg:save:3', { badges: ['q'] }); // no nuzlocke: ignored
    save.write('world:caught', [1, 2, 3, 4]);
    save.write('world:shiny', [4]);
    save.write('contest:ribbons', ['cool', 'cute']);
    save.write('fusion:dex', [{}, {}]);
    save.write('odyssey:meta', { bestWave: 25, unlocked: [10, 11, 12] });
    save.write('daily:record', {
      lastKey: dailyKey(),
      lastWonKey: dailyKey(),
      streak: 3,
      best: 6,
      wins: 8,
      plays: 10,
    });

    expect(svc.state().badges).toBe(0); // not refreshed yet
    svc.refresh();
    expect(svc.state()).toMatchObject({
      badges: 3,
      arenaChampion: true,
      bestDepth: 9,
      spireClears: 2,
      ascension: 3,
      chimeraWins: 1,
      tournamentWins: 2,
      tournamentRuns: 3,
      pickemHits: 1,
      coins: 120 + 30 + 80,
      rivalWins: 4,
      rivalLosses: 2,
      adventureBadges: 2,
      adventureCaught: 3,
      nuzlockeBadges: 4,
      worldCaught: 4,
      shinyCaught: 1,
      contestRibbons: 2,
      fusionsRegistered: 2,
      dailyStreak: 3,
      dailyBest: 6,
    });
    expect(svc.unlocked()).toBeGreaterThan(2);
    expect(svc.achievements().find((a) => a.achievement.id === 'first-badge')!.unlocked).toBe(true);
    expect(svc.achievements().find((a) => a.achievement.id === 'champion')!.unlocked).toBe(true);
    expect(svc.rank()).not.toBe('Rookie');
    expect(svc.progress().pct).toBeGreaterThanOrEqual(0);
  });

  it('tolerates malformed stored values', () => {
    save.write('arena:badges', 'nope');
    save.write('arena:coins', null);
    save.write('tournaments:history', { not: 'a list' });
    const svc = create();
    expect(svc.state().badges).toBe(0);
    expect(svc.state().coins).toBe(0);
    expect(svc.state().tournamentRuns).toBe(0);
  });

  it('saves a trimmed identity and falls back to defaults for blanks', () => {
    const svc = create();
    svc.setIdentity('  Ash  ', ' Master of Pallet ');
    expect(svc.identity()).toEqual({ name: 'Ash', title: 'Master of Pallet' });

    svc.setIdentity('   ', '');
    expect(svc.identity()).toEqual(DEFAULT_IDENTITY);

    svc.setIdentity('Misty', 'Gym Leader');
    TestBed.resetTestingModule();
    expect(TestBed.inject(ProfileService).identity()).toEqual({
      name: 'Misty',
      title: 'Gym Leader',
    });
  });
});
