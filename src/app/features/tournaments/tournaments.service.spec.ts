import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PokeApiClient } from '../../core/api/pokeapi.client';
import { BattlerFactory } from '../../core/battle/battler-factory';
import type { PokemonDto } from '../../core/dto/pokeapi.dto';
import type { Battler } from '../../game/engine';
import { TournamentService } from './tournaments.service';

function dto(id: number): PokemonDto {
  const names = ['hp', 'attack', 'defense', 'special-attack', 'special-defense', 'speed'];
  return {
    id,
    name: `mon-${id}`,
    types: [{ slot: 1, type: { name: 'normal', url: '' } }],
    stats: names.map((name) => ({ base_stat: 50 + (id % 40), effort: 0, stat: { name, url: '' } })),
    sprites: {},
  } as unknown as PokemonDto;
}

const built = (d: PokemonDto, level: number): Battler => {
  const v = 50 + (d.id % 40);
  return {
    id: d.id,
    name: d.name,
    level,
    types: ['normal'],
    stats: {
      hp: v * 2,
      attack: v,
      defense: v,
      'special-attack': v,
      'special-defense': v,
      speed: v,
    },
    moves: [{ name: 'Tackle', type: 'normal', power: 40, accuracy: 100, damageClass: 'physical' }],
  };
};

describe('TournamentService', () => {
  let failBuild = false;
  let failFetch = false;

  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
    failBuild = false;
    failFetch = false;
    const pokemon = vi.fn((id: number) => {
      if (failFetch) throw new Error('sync failure');
      return Promise.resolve(dto(id));
    });
    TestBed.configureTestingModule({
      providers: [
        {
          provide: PokeApiClient,
          useValue: {
            pokemon,
            type: () => Promise.resolve({ pokemon: [] }),
          },
        },
        {
          provide: BattlerFactory,
          useValue: {
            totalBaseStats: (d: PokemonDto) => d.stats.reduce((s, x) => s + x.base_stat, 0),
            buildBattlerFromDto: (d: PokemonDto, level: number) =>
              failBuild ? Promise.reject(new Error('boom')) : Promise.resolve(built(d, level)),
            battleSprite: () => 'sprite.png',
          },
        },
      ],
    });
  });

  const create = () => TestBed.inject(TournamentService);

  it('starts idle with nothing selected', () => {
    const svc = create();
    expect(svc.status()).toBe('idle');
    expect(svc.bracket()).toBeNull();
    expect(svc.currentMatchSetup()).toBeNull();
    expect(svc.champion()).toBeNull();
    expect(svc.rankedStandings()).toEqual([]);
    expect(svc.playerEliminated()).toBe(false);
  });

  it('builds a 16-trainer knockout bracket with a pending player match', async () => {
    const svc = create();
    await svc.startMode('classic');
    expect(svc.status()).toBe('ready');
    expect(svc.fieldList()).toHaveLength(16);
    expect(svc.fieldList().filter((t) => t.isRival)).toHaveLength(1);
    expect(svc.fieldList().filter((t) => t.isPlayer)).toHaveLength(1);
    const setup = svc.currentMatchSetup()!;
    expect(setup.player.isPlayer).toBe(true);
    expect(setup.playerTeam).toHaveLength(3);
    expect(svc.playerEliminated()).toBe(false);
  });

  it('winning every round crowns the player, logs the run once and pays the prize', async () => {
    const svc = create();
    await svc.startMode('classic');
    for (let i = 0; i < 4; i++) {
      expect(svc.status()).toBe('ready');
      svc.recordPlayerOutcome(true);
    }
    expect(svc.status()).toBe('done');
    expect(svc.champion()!.isPlayer).toBe(true);
    expect(svc.playerEliminated()).toBe(false);
    expect(svc.lastRun()!.placement).toBe(1);
    expect(svc.lastRun()!.playerWon).toBe(true);
    expect(svc.history()).toHaveLength(1);

    svc.recordPlayerOutcome(true); // nothing pending: ignored
    expect(svc.history()).toHaveLength(1);
  });

  it('losing eliminates the player and the CPU bracket plays out to a champion', async () => {
    const svc = create();
    await svc.startMode('classic');
    svc.recordPlayerOutcome(false);
    expect(svc.status()).toBe('done');
    expect(svc.playerEliminated()).toBe(true);
    expect(svc.champion()!.isPlayer).not.toBe(true);
    expect(svc.lastRun()!.playerWon).toBe(false);
    expect(svc.lastRun()!.placement).toBeGreaterThan(1);
  });

  it('records the head-to-head result when the foe is the rival', async () => {
    const svc = create();
    await svc.startMode('classic');
    // Fight on until the rival shows up (or the player is out).
    let met = false;
    for (let i = 0; i < 4 && svc.status() === 'ready'; i++) {
      if (svc.currentMatchSetup()!.foe.isRival) {
        const before = svc.rival().playerWins;
        svc.recordPlayerOutcome(true);
        expect(svc.rival().playerWins).toBe(before + 1);
        met = true;
        break;
      }
      svc.recordPlayerOutcome(true);
    }
    // The rival is the strongest CPU so a winning streak always meets it before the title.
    expect(met).toBe(true);
  });

  it('carries surviving HP between rounds in survival mode', async () => {
    const svc = create();
    await svc.startMode('survival');
    expect(svc.mode()!.hpCarry).toBe(true);
    svc.recordPlayerOutcome(true, [7, 0, 3]);
    if (svc.status() === 'ready') {
      expect(svc.currentMatchSetup()!.playerStartHp).toEqual([7, 0, 3]);
    }
  });

  it('draft mode pauses for picks, then fills the field with CPU teams', async () => {
    const svc = create();
    await svc.startMode('draft');
    expect(svc.status()).toBe('draft');
    expect(svc.draftPool()).toHaveLength(9);

    await svc.confirmDraft(svc.draftPool().slice(0, 3));
    expect(svc.status()).toBe('ready');
    expect(svc.fieldList()).toHaveLength(16);
    expect(svc.fieldList()[0]!.isPlayer).toBe(true);
    expect(svc.currentMatchSetup()!.playerTeam.map((b) => b.id)).toEqual(
      svc
        .draftPool()
        .slice(0, 3)
        .map((b) => b.id),
    );
  });

  it('confirmDraft without a mode does nothing', async () => {
    const svc = create();
    await svc.confirmDraft([]);
    expect(svc.status()).toBe('idle');
  });

  it('mono-type mode draws a type for the whole field', async () => {
    const svc = create();
    await svc.startMode('monotype');
    expect(svc.monoType()).not.toBeNull();
    expect(svc.status()).toBe('ready');
  });

  it('reports a load failure and returns to idle', async () => {
    failBuild = true;
    const svc = create();
    await svc.startMode('classic');
    expect(svc.error()).toBe('Could not load the tournament. Please try again.');
    expect(svc.status()).toBe('idle');
  });

  it('reports a draft-confirmation failure', async () => {
    const svc = create();
    await svc.startMode('draft');
    failFetch = true;
    await svc.confirmDraft(svc.draftPool().slice(0, 3));
    expect(svc.error()).toBe('Could not start the tournament. Please try again.');
    expect(svc.status()).toBe('idle');
  });

  it('runs a round-robin league to completion', async () => {
    const svc = create();
    await svc.startMode('classic', 'round-robin');
    expect(svc.format()).toBe('round-robin');
    expect(svc.fieldList()).toHaveLength(8);
    expect(svc.standings()).not.toBeNull();
    let guard = 0;
    while (svc.status() === 'ready' && guard++ < 20) {
      expect(svc.currentMatchSetup()).not.toBeNull();
      svc.recordPlayerOutcome(true);
    }
    expect(svc.status()).toBe('done');
    expect(svc.champion()).not.toBeNull();
    expect(svc.rankedStandings().length).toBe(8);
    expect(svc.history()).toHaveLength(1);
    expect(svc.lastRun()!.formatName).toBeTruthy();
  });

  it('runs a swiss league and records a loss', async () => {
    const svc = create();
    await svc.startMode('classic', 'swiss');
    expect(svc.format()).toBe('swiss');
    let guard = 0;
    while (svc.status() === 'ready' && guard++ < 20) svc.recordPlayerOutcome(false);
    expect(svc.status()).toBe('done');
    expect(svc.lastRun()!.playerWon).toBe(false);
  });

  it('league outcomes without an active league are ignored', () => {
    const svc = create();
    svc.format.set('swiss');
    svc.recordPlayerOutcome(true);
    expect(svc.status()).toBe('idle');
  });

  describe('crystal-ball pick', () => {
    it('makes, clears and locks a champion call', async () => {
      const svc = create();
      await svc.startMode('classic');
      const target = svc.fieldList().find((t) => !t.isPlayer && !t.isRival)!;

      svc.makePick('nobody'); // unknown trainer
      expect(svc.pick()).toBeNull();

      svc.makePick(target.id);
      expect(svc.pick()!.trainerId).toBe(target.id);
      expect(svc.pick()!.name).toBe(target.name);
      expect(svc.pick()!.mult).toBeGreaterThan(1);

      svc.clearPick();
      expect(svc.pick()).toBeNull();

      svc.makePick('player');
      expect(svc.pick()!.name).toBe('You');

      svc.lockPick();
      svc.clearPick();
      expect(svc.pick()).not.toBeNull();
      svc.makePick(target.id); // locked
      expect(svc.pick()!.trainerId).toBe('player');
    });

    it('cannot pick before the field exists', () => {
      const svc = create();
      svc.makePick('player');
      expect(svc.pick()).toBeNull();
    });

    it('a correct call pays the bonus and shows up in pickResult', async () => {
      const svc = create();
      await svc.startMode('classic');
      svc.makePick('player');
      const payout = svc.pick()!.payout;
      for (let i = 0; i < 4; i++) svc.recordPlayerOutcome(true);
      expect(svc.pickResult()!.hit).toBe(true);
      expect(svc.lastRun()!.pickBonus).toBe(payout);
    });

    it('a wrong call reports a miss', async () => {
      const svc = create();
      await svc.startMode('classic');
      svc.makePick('player');
      svc.recordPlayerOutcome(false);
      expect(svc.pickResult()!.hit).toBe(false);
    });
  });

  it('reset clears the run but keeps the history and rival', async () => {
    const svc = create();
    await svc.startMode('classic');
    svc.makePick('player');
    svc.lockPick();
    svc.recordPlayerOutcome(false);
    const rivalName = svc.rival().name;

    svc.reset();
    expect(svc.status()).toBe('idle');
    expect(svc.mode()).toBeNull();
    expect(svc.bracket()).toBeNull();
    expect(svc.fieldList()).toEqual([]);
    expect(svc.pick()).toBeNull();
    expect(svc.pickLocked()).toBe(false);
    expect(svc.lastRun()).toBeNull();
    expect(svc.history()).toHaveLength(1);
    expect(svc.rival().name).toBe(rivalName);
  });
});
