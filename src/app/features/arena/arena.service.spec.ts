import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { BattlerFactory } from '../../core/battle/battler-factory';
import { POKEMON_TYPES } from '../../core/utils/type-chart';
import { GAUNTLET } from '../../game/arena/elite-four';
import { LEADER_LADDER } from '../../game/arena/gym-leaders';
import type { Battler } from '../../game/engine';
import { TeamBuilderService } from '../team-builder/team-builder.service';
import { ArenaProgressStore } from './arena-progress.store';
import { ArenaService } from './arena.service';

const mon = (id: number | string, level = 50): Battler => ({
  id: typeof id === 'number' ? id : 1,
  name: String(id),
  level,
  types: ['normal'],
  stats: {
    hp: 100,
    attack: 50,
    defense: 50,
    'special-attack': 50,
    'special-defense': 50,
    speed: 50,
  },
  moves: [{ name: 'Tackle', type: 'normal', power: 40, accuracy: 100, damageClass: 'physical' }],
});

describe('ArenaService', () => {
  let fail: boolean;

  beforeEach(() => {
    fail = false;
    localStorage.clear();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: BattlerFactory,
          useValue: {
            buildBattler: (id: number | string, level: number) =>
              fail ? Promise.reject(new Error('offline')) : Promise.resolve(mon(id, level)),
          },
        },
        { provide: TeamBuilderService, useValue: { team: () => [] } },
      ],
    });
  });

  const create = () => TestBed.inject(ArenaService);
  const store = () => TestBed.inject(ArenaProgressStore);
  const first = LEADER_LADDER[0]!;

  it('starts at the hub with no progress', () => {
    const svc = create();
    expect(svc.status()).toBe('hub');
    expect(svc.earnedCount()).toBe(0);
    expect(svc.total()).toBe(LEADER_LADDER.length);
    expect(svc.gauntletOpen()).toBe(false);
    expect(svc.totalStars()).toBe(0);
    expect(svc.ladder().length).toBe(LEADER_LADDER.length);
    expect(svc.boostSummary()).toBe('No badge boosts yet');
  });

  it('challenge prepares the VS splash and match setup', async () => {
    const svc = create();
    await svc.challenge(first);
    expect(svc.status()).toBe('intro');
    const intro = svc.intro()!;
    expect(intro.leader).toBe(first);
    expect(intro.rematch).toBe(false);
    expect(intro.foeTeam).toHaveLength(first.team.length);
    expect(intro.playerTeam).toHaveLength(3);
    const setup = svc.setup()!;
    expect(setup.foe.name).toBe(first.name);
    expect(setup.match.id).toBe(`gym-${first.type}`);
    expect(setup.field).toEqual(first.gymField);
    expect(setup.foeAce).toBe(first.dialogue.ace);
    expect(svc.activeLeader()).toBe(first);

    svc.beginBattle();
    expect(svc.status()).toBe('battle');
  });

  it('a rematch uses a higher level, a tougher AI and an extra ace', async () => {
    const svc = create();
    await svc.challenge(first);
    const base = svc.intro()!.level;
    svc.rematch(first);
    await Promise.resolve();
    await new Promise((r) => setTimeout(r));
    expect(svc.intro()!.rematch).toBe(true);
    expect(svc.intro()!.level).toBe(base + 12);
    expect(svc.setup()!.aiTier).toBe('elite');
    expect(svc.setup()!.match.id).toBe(`gym-${first.type}-r`);
    expect(svc.intro()!.foeTeam).toHaveLength(first.team.length + 1);
  });

  it('beginBattle does nothing without a prepared setup', () => {
    const svc = create();
    svc.beginBattle();
    expect(svc.status()).toBe('hub');
  });

  it('shows an error when a team cannot be assembled', async () => {
    fail = true;
    const svc = create();
    await svc.challenge(first);
    expect(svc.status()).toBe('error');
    expect(svc.error()).toBeTruthy();
    expect(svc.activeLeader()).toBeNull();
  });

  it('a first clear awards the badge, stars and coins', async () => {
    const svc = create();
    await svc.challenge(first);
    svc.beginBattle();
    svc.finish({ playerWon: true, playerFinalHp: [10, 10, 10] });
    expect(svc.status()).toBe('reward');
    const r = svc.reward()!;
    expect(r.won).toBe(true);
    expect(r.stars).toBe(3);
    expect(r.firstClear).toBe(true);
    expect(r.coins).toBe(first.order * 10 + 40 + 3 * 8);
    expect(svc.hasBadge(first.type)).toBe(true);
    expect(svc.starsFor(first.type)).toBe(3);
    expect(svc.coins()).toBe(r.coins);
    expect(svc.setup()).toBeNull();
    expect(svc.intro()).toBeNull();
    expect(svc.earnedCount()).toBe(1);
    expect(svc.totalStars()).toBe(3);
  });

  it('stars follow the number of survivors', async () => {
    const svc = create();
    await svc.challenge(first);
    svc.finish({ playerWon: true, playerFinalHp: [10, 0, 0] });
    expect(svc.reward()!.stars).toBe(1);
  });

  it('a rematch win pays a bonus but no first-clear bonus', async () => {
    store().awardBadge(first.type);
    const svc = create();
    await svc.challenge(first, true);
    svc.finish({ playerWon: true, playerFinalHp: [5, 5, 0] });
    const r = svc.reward()!;
    expect(r.firstClear).toBe(false);
    expect(r.coins).toBe(first.order * 10 + 2 * 8 + 30);
  });

  it('a loss pays nothing and keeps progress untouched', async () => {
    const svc = create();
    await svc.challenge(first);
    svc.finish({ playerWon: false, playerFinalHp: [0, 0, 0] });
    const r = svc.reward()!;
    expect(r.won).toBe(false);
    expect(r.stars).toBe(0);
    expect(r.coins).toBe(0);
    expect(svc.hasBadge(first.type)).toBe(false);
  });

  it('flags when the eighth badge opens the gauntlet', async () => {
    const owned = LEADER_LADDER.slice(1, 8).map((l) => l.type);
    owned.forEach((t) => store().awardBadge(t));
    const svc = create();
    expect(svc.gauntletOpen()).toBe(false);
    await svc.challenge(first);
    svc.finish({ playerWon: true, playerFinalHp: [1, 1, 1] });
    expect(svc.reward()!.gauntletJustUnlocked).toBe(true);
    expect(svc.gauntletOpen()).toBe(true);
  });

  it('finishing with no active leader just returns to the hub', () => {
    const svc = create();
    svc.status.set('battle');
    svc.finish({ playerWon: true, playerFinalHp: [1] });
    expect(svc.status()).toBe('hub');
    expect(svc.reward()).toBeNull();
  });

  it('closeReward and abandon return to the hub', async () => {
    const svc = create();
    await svc.challenge(first);
    svc.finish({ playerWon: false, playerFinalHp: [0] });
    svc.closeReward();
    expect(svc.status()).toBe('hub');
    expect(svc.reward()).toBeNull();
    expect(svc.activeLeader()).toBeNull();

    await svc.challenge(first);
    svc.abandon();
    expect(svc.status()).toBe('hub');
    expect(svc.setup()).toBeNull();
    expect(svc.intro()).toBeNull();
  });

  it('resetProgress wipes badges and the reward', async () => {
    const svc = create();
    await svc.challenge(first);
    svc.finish({ playerWon: true, playerFinalHp: [1, 1, 1] });
    svc.resetProgress();
    expect(svc.earnedCount()).toBe(0);
    expect(svc.reward()).toBeNull();
    expect(svc.coins()).toBeGreaterThan(0); // coins survive
  });

  describe('gauntlet', () => {
    const unlock = () => POKEMON_TYPES.slice(0, 8).forEach((t) => store().awardBadge(t));

    it('stays closed until enough badges are held', async () => {
      const svc = create();
      await svc.startGauntlet();
      expect(svc.status()).toBe('hub');
      expect(svc.gauntletSetup()).toBeNull();
    });

    it('runs through every trainer to the champion', async () => {
      unlock();
      const svc = create();
      await svc.startGauntlet();
      expect(svc.status()).toBe('gauntlet');
      expect(svc.gauntletView()!.index).toBe(1);

      for (let i = 1; i < GAUNTLET.length; i++) {
        await svc.finishGauntletMatch({ playerWon: true, playerFinalHp: [5, 5, 5] });
        expect(svc.status()).toBe('gauntlet');
        expect(svc.gauntletView()!.index).toBe(i + 1);
      }
      await svc.finishGauntletMatch({ playerWon: true, playerFinalHp: [5, 5, 5] });
      expect(svc.status()).toBe('hub');
      expect(svc.gauntletResult()).toBe('won');
      expect(svc.isChampion()).toBe(true);
    });

    it('a defeat sends you back to the hub with a lost result', async () => {
      unlock();
      const svc = create();
      await svc.startGauntlet();
      await svc.finishGauntletMatch({ playerWon: false, playerFinalHp: [0, 0, 0] });
      expect(svc.status()).toBe('hub');
      expect(svc.gauntletResult()).toBe('lost');
    });

    it('abandonGauntlet ends the run', async () => {
      unlock();
      const svc = create();
      await svc.startGauntlet();
      svc.abandonGauntlet();
      expect(svc.status()).toBe('hub');
      expect(svc.gauntletSetup()).toBeNull();
    });

    it('reports a start failure', async () => {
      unlock();
      fail = true;
      const svc = create();
      await svc.startGauntlet();
      expect(svc.status()).toBe('error');
      expect(svc.error()).toBeTruthy();
    });
  });
});
