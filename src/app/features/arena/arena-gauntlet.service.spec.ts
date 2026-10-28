import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { GAUNTLET } from '../../game/arena/elite-four';
import type { Battler } from '../../game/engine';
import type { MatchOutcome } from '../../game/tournament';
import { ArenaGauntlet } from './arena-gauntlet.service';
import { ArenaProgressStore } from './arena-progress.store';
import { ArenaTeams } from './arena-teams.service';

const mon = (id: number): Battler => ({
  id,
  name: `mon-${id}`,
  level: 75,
  types: ['normal'],
  stats: {
    hp: 150 + id,
    attack: 50,
    defense: 50,
    'special-attack': 50,
    'special-defense': 50,
    speed: 50,
  },
  moves: [{ name: 'Tackle', type: 'normal', power: 40, accuracy: 100, damageClass: 'physical' }],
});

const won = (hp: number[]): MatchOutcome => ({ playerWon: true, playerFinalHp: hp });
const lost: MatchOutcome = { playerWon: false, playerFinalHp: [0, 0, 0] };

describe('ArenaGauntlet', () => {
  let playerTeam: Battler[];

  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
    playerTeam = [mon(1), mon(2), mon(3)];
    TestBed.configureTestingModule({
      providers: [
        {
          provide: ArenaTeams,
          useValue: {
            buildPlayerTeam: () => Promise.resolve(playerTeam),
            applyBadgeBoosts: (team: Battler[]) => team,
            buildEliteTeam: () => Promise.resolve([mon(90)]),
          },
        },
      ],
    });
  });

  const gauntlet = () => TestBed.inject(ArenaGauntlet);

  it('refuses to start without a team', async () => {
    playerTeam = [];
    await expect(gauntlet().start()).rejects.toThrow('Team Builder');
  });

  it('starts at Elite 1 with full HP and an elite-tier AI', async () => {
    const g = gauntlet();
    await g.start();
    expect(g.result()).toBeNull();
    expect(g.view()).toEqual({
      stageLabel: 'Elite 1',
      index: 1,
      total: GAUNTLET.length,
      foeName: `${GAUNTLET[0]!.name}, ${GAUNTLET[0]!.title}`,
    });
    const setup = g.setup()!;
    expect(setup.aiTier).toBe('elite');
    expect(setup.playerStartHp).toEqual([151, 152, 153]);
    expect(setup.match.id).toBe(`gauntlet-${GAUNTLET[0]!.id}`);
    expect(setup.foe.id).toBe(GAUNTLET[0]!.id);
  });

  it('carries HP forward and pays stage coins after a win', async () => {
    const g = gauntlet();
    const progress = TestBed.inject(ArenaProgressStore);
    await g.start();
    expect(g.advance(won([20, 0, 5]))).toBe('next');
    expect(progress.coins()).toBe(60);
    await g.loadMatch();
    expect(g.setup()!.playerStartHp).toEqual([20, 0, 5]);
    expect(g.view()!.index).toBe(2);
  });

  it('a loss ends the run with a "lost" result and clears the screens', async () => {
    const g = gauntlet();
    await g.start();
    expect(g.advance(lost)).toBe('over');
    expect(g.result()).toBe('lost');
    expect(g.setup()).toBeNull();
    expect(g.view()).toBeNull();
    expect(TestBed.inject(ArenaProgressStore).isChampion()).toBe(false);
  });

  it('beating every trainer crowns the champion and pays the title bonus', async () => {
    const g = gauntlet();
    const progress = TestBed.inject(ArenaProgressStore);
    await g.start();
    for (let i = 0; i < GAUNTLET.length - 1; i++) {
      expect(g.advance(won([10, 10, 10]))).toBe('next');
      await g.loadMatch();
    }
    expect(g.view()!.stageLabel).toBe('Champion');
    expect(g.advance(won([10, 10, 10]))).toBe('over');
    expect(g.result()).toBe('won');
    expect(progress.isChampion()).toBe(true);
    expect(progress.coins()).toBe(60 * GAUNTLET.length + 300);
  });

  it('advancing without a run is a no-op "over"', () => {
    expect(gauntlet().advance(won([1]))).toBe('over');
  });

  it('end abandons the run', async () => {
    const g = gauntlet();
    await g.start();
    g.end();
    expect(g.setup()).toBeNull();
    expect(g.advance(won([1]))).toBe('over');
  });
});
