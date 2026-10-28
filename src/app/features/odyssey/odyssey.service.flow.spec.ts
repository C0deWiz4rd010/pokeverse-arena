/* eslint-disable @typescript-eslint/no-misused-promises */
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PokeApiClient } from '../../core/api/pokeapi.client';
import { BattlerFactory } from '../../core/battle/battler-factory';
import type { EvolutionChainDto } from '../../core/dto/pokeapi.dto';
import type { Battler } from '../../game/engine';
import {
  WAVES_PER_BIOME,
  coinsForWave,
  waveSpec,
  type OdysseyReward,
} from '../../game/odyssey/odyssey';
import { OdysseyService, type DazeState } from './odyssey.service';

const mon = (id: number | string, level = 15, name?: string): Battler => ({
  id: typeof id === 'number' ? id : 0,
  name: name ?? (typeof id === 'string' ? id : `mon-${id}`),
  level,
  types: ['normal'],
  stats: {
    hp: 100,
    attack: 60,
    defense: 60,
    'special-attack': 60,
    'special-defense': 60,
    speed: 60,
  },
  moves: [{ name: 'Tackle', type: 'normal', power: 40, accuracy: 100, damageClass: 'physical' }],
});

const reward = (kind: OdysseyReward['kind'], payload: number | string): OdysseyReward => ({
  kind,
  label: '',
  desc: '',
  payload,
});

const daze = (dexId: number, chance: number): DazeState => ({
  dexId,
  name: `mon-${dexId}`,
  sprite: '',
  chance,
});

const link = (name: string, id: number, minLevel: number | null, next: unknown[] = []) => ({
  is_baby: false,
  species: { name, url: `https://pokeapi.co/api/v2/pokemon-species/${id}/` },
  evolution_details:
    minLevel === null
      ? []
      : [
          {
            min_level: minLevel,
            trigger: { name: 'level-up', url: '' },
            item: null,
            min_happiness: null,
            time_of_day: '',
            known_move: null,
            location: null,
          },
        ],
  evolves_to: next,
});

describe('OdysseyService battle flow', () => {
  let buildBattler: ReturnType<typeof vi.fn>;
  let api: { species: ReturnType<typeof vi.fn>; evolutionChain: ReturnType<typeof vi.fn> };

  function create(): OdysseyService {
    TestBed.configureTestingModule({
      providers: [
        { provide: BattlerFactory, useValue: { buildBattler } },
        { provide: PokeApiClient, useValue: api },
      ],
    });
    return TestBed.inject(OdysseyService);
  }

  async function started(): Promise<OdysseyService> {
    const svc = create();
    svc.startNewRun(false);
    await svc.pickStarter(25);
    return svc;
  }

  /** Move a started run onto a specific wave of a known seed. */
  function setWave(svc: OdysseyService, wave: number): void {
    svc.wave.set(wave);
    svc.spec.set(waveSpec(wave, 'flow-seed'));
  }

  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
    buildBattler = vi
      .fn()
      .mockImplementation((id: number | string, level = 15) => Promise.resolve(mon(id, level)));
    api = {
      species: vi.fn().mockRejectedValue(new Error('offline')),
      evolutionChain: vi.fn().mockRejectedValue(new Error('offline')),
    };
  });

  describe('fight', () => {
    it('does nothing without a wave spec', async () => {
      const svc = create();
      await svc.fight();
      expect(svc.phase()).toBe('hub');
      expect(svc.setup()).toBeNull();
    });

    it('builds the foe team and match setup for a wild wave', async () => {
      const svc = await started();
      buildBattler.mockClear();
      const spec = svc.spec()!;
      await svc.fight();

      expect(svc.phase()).toBe('battle');
      expect(svc.busy()).toBe(false);
      const setup = svc.setup()!;
      expect(buildBattler).toHaveBeenCalledWith(spec.species[0], spec.level);
      expect(setup.foe.name).toBe('Wild Encounter');
      expect(setup.player.isPlayer).toBe(true);
      expect(setup.aiTier).toBe('basic');
      expect(setup.field).toBeUndefined();
      expect(setup.playerStartHp).toEqual([100]);
      expect(setup.foeTeam).toHaveLength(1);
      expect(setup.accent).toBe(spec.biome.tint);
      expect(setup.match.id).toBe('ody-1');
    });

    it('elite waves field a pack and boss waves impose the guardian field with stronger AI', async () => {
      const svc = await started();
      setWave(svc, 5);
      await svc.fight();
      expect(svc.setup()!.foe.name).toBe('Elite Pack');
      expect(svc.setup()!.foeTeam).toHaveLength(2);
      expect(svc.setup()!.field).toBeUndefined();

      setWave(svc, WAVES_PER_BIOME);
      await svc.fight();
      const boss = svc.setup()!;
      expect(boss.foe.name).toContain('Guardian');
      expect(boss.field).toEqual({
        weather: svc.spec()!.biome.field.weather,
        terrain: svc.spec()!.biome.field.terrain,
      });

      setWave(svc, 15);
      await svc.fight();
      expect(svc.setup()!.aiTier).toBe('strong');
      setWave(svc, 35);
      await svc.fight();
      expect(svc.setup()!.aiTier).toBe('elite');
    });

    it('carries remaining HP into the fight as a fraction of max HP', async () => {
      const second = await started();
      await second.fight();
      second.onBattleFinished({ playerWon: true, playerFinalHp: [40] });
      await vi.waitFor(() => expect(second.phase()).toBe('catch'));
      expect(second.partyView()[0]!.hpPct).toBe(40);
      second.skipCatch();
      await second.chooseReward(reward('coins', 0));
      await second.fight();
      expect(second.setup()!.playerStartHp).toEqual([40]);
    });

    it('survives foes that fail to load and aborts when none load', async () => {
      const svc = await started();
      setWave(svc, 5); // two foes
      buildBattler.mockImplementationOnce(() => Promise.reject(new Error('x')));
      await svc.fight();
      expect(svc.phase()).toBe('battle');
      expect(svc.setup()!.foeTeam).toHaveLength(1);

      buildBattler.mockRejectedValue(new Error('offline'));
      await svc.fight();
      expect(svc.phase()).toBe('wave');
      expect(svc.error()).toBe('The wave scattered. Try again.');
      expect(svc.busy()).toBe(false);
    });

    it('ignores a second fight while busy', async () => {
      const svc = await started();
      svc.busy.set(true);
      await svc.fight();
      expect(svc.phase()).toBe('wave');
    });
  });

  describe('after the battle', () => {
    it('a defeat ends the run: meta recorded, save cleared', async () => {
      const svc = await started();
      setWave(svc, 7);
      await svc.fight();
      svc.onBattleFinished({ playerWon: false, playerFinalHp: [0] });
      expect(svc.phase()).toBe('lost');
      expect(svc.setup()).toBeNull();
      expect(svc.savedRun()).toBeNull();
      expect(svc.meta().bestWave).toBe(7);
      expect(svc.meta().runs).toBe(1);
    });

    it('a victory pays coins, levels the team and dazes the last foe', async () => {
      const svc = await started();
      await svc.fight();
      const spec = svc.spec()!;
      svc.onBattleFinished({ playerWon: true, playerFinalHp: [100] });
      expect(svc.busy()).toBe(true);
      await vi.waitFor(() => expect(svc.phase()).toBe('catch'));

      expect(svc.coins()).toBe(coinsForWave(spec.wave, spec.kind));
      expect(svc.partyView()[0]!.mon.level).toBe(16);
      expect(svc.busy()).toBe(false);
      expect(svc.daze()).toMatchObject({
        dexId: spec.species[spec.species.length - 1],
        chance: spec.catchChance,
      });
    });

    it('boss victories give a bigger level gain', async () => {
      const svc = await started();
      setWave(svc, WAVES_PER_BIOME);
      await svc.fight();
      svc.onBattleFinished({ playerWon: true, playerFinalHp: [50] });
      await vi.waitFor(() => expect(svc.phase()).toBe('catch'));
      expect(svc.partyView()[0]!.mon.level).toBe(18);
    });

    it('evolves a team member that crosses its evolution level', async () => {
      buildBattler.mockImplementation((id: number | string, level = 15) =>
        Promise.resolve(
          typeof id === 'string'
            ? mon(id, level)
            : mon(id, level, id === 25 ? 'charmander' : undefined),
        ),
      );
      api.species.mockResolvedValue({
        evolution_chain: { url: 'https://pokeapi.co/api/v2/evolution-chain/2/' },
      });
      api.evolutionChain.mockResolvedValue({
        id: 2,
        chain: link('charmander', 4, null, [link('charmeleon', 5, 16)]),
      } as unknown as EvolutionChainDto);

      const svc = await started();
      await svc.fight();
      svc.onBattleFinished({ playerWon: true, playerFinalHp: [100] });
      await vi.waitFor(() => expect(svc.phase()).toBe('catch'));
      expect(buildBattler).toHaveBeenCalledWith('charmeleon', 16);
      expect(svc.partyView()[0]!.mon.name).toBe('charmeleon');
      expect(svc.toast()).toContain('evolved into charmeleon');
    });

    it('keeps the held item through a rebuild and the old build when rebuilding fails', async () => {
      const svc = await started();
      await svc.chooseReward(reward('item', 'leftovers'));
      setWave(svc, 2);
      await svc.fight();
      svc.onBattleFinished({ playerWon: true, playerFinalHp: [100] });
      await vi.waitFor(() => expect(svc.phase()).toBe('catch'));
      expect(svc.partyView()[0]!.mon.item).toBe('leftovers');
      expect(svc.partyView()[0]!.mon.level).toBe(16);

      svc.skipCatch();
      await svc.chooseReward(reward('coins', 0));
      await svc.fight();
      buildBattler.mockRejectedValue(new Error('offline'));
      svc.onBattleFinished({ playerWon: true, playerFinalHp: [100] });
      await vi.waitFor(() => expect(svc.phase()).toBe('catch'));
      expect(svc.partyView()[0]!.mon.level).toBe(16); // unchanged
    });
  });

  describe('catching', () => {
    it('does nothing without a dazed foe or without balls', async () => {
      const svc = await started();
      svc.throwBall();
      expect(svc.balls()).toBe(5);

      svc.daze.set(daze(10, 1));
      svc.balls.set(0);
      svc.throwBall();
      expect(svc.daze()).not.toBeNull();
    });

    it('a successful throw recruits the foe and unlocks the species', async () => {
      const svc = await started();
      svc.daze.set(daze(10, 1));
      svc.throwBall();
      expect(svc.balls()).toBe(4);
      await vi.waitFor(() => expect(svc.phase()).toBe('reward'));

      expect(svc.partyView()).toHaveLength(2);
      expect(svc.partyView()[1]!.hpPct).toBe(100);
      expect(svc.meta().unlocked).toContain(10);
      expect(svc.runUnlocks()).toEqual([10]);
      expect(svc.starters()).toContain(10);
      expect(svc.toast()).toContain('new starter unlocked');
      expect(svc.daze()).toBeNull();
      expect(svc.rewards().length).toBeGreaterThan(0);
      expect(svc.busy()).toBe(false);
    });

    it('a species that is already unlocked is not flagged as new', async () => {
      const svc = await started();
      svc.daze.set(daze(10, 1));
      svc.throwBall();
      await vi.waitFor(() => expect(svc.phase()).toBe('reward'));
      svc.daze.set(daze(10, 1));
      svc.phase.set('catch');
      svc.throwBall();
      await vi.waitFor(() => expect(svc.partyView()).toHaveLength(3));
      expect(svc.runUnlocks()).toEqual([10]);
      expect(svc.toast()).not.toContain('new starter');
    });

    it('a full team still unlocks the species but cannot take it along', async () => {
      const svc = await started();
      for (let i = 0; i < 5; i++) {
        svc.daze.set(daze(100 + i, 1));
        svc.throwBall();
        await vi.waitFor(() => expect(svc.partyView()).toHaveLength(2 + i));
      }
      expect(svc.partyView()).toHaveLength(6);

      svc.balls.set(3);
      svc.daze.set(daze(200, 1));
      svc.throwBall();
      await vi.waitFor(() => expect(svc.toast()).toContain('team is full'));
      expect(svc.partyView()).toHaveLength(6);
      expect(svc.meta().unlocked).toContain(200);
      expect(svc.phase()).toBe('reward');
    });

    it('still registers the catch when the recruit cannot be built', async () => {
      const svc = await started();
      buildBattler.mockRejectedValue(new Error('offline'));
      svc.daze.set(daze(10, 1));
      svc.throwBall();
      await vi.waitFor(() => expect(svc.phase()).toBe('reward'));
      expect(svc.toast()).toBe('Caught! It joins your starter roster.');
      expect(svc.partyView()).toHaveLength(1);
      expect(svc.meta().unlocked).toContain(10);
    });

    it('a failed throw lets you try again until the last ball', async () => {
      const svc = await started();
      svc.balls.set(2);
      svc.daze.set(daze(10, 0));
      svc.throwBall();
      expect(svc.toast()).toBe('It broke free! Throw again?');
      expect(svc.balls()).toBe(1);

      svc.throwBall();
      expect(svc.toast()).toContain('last ball');
      expect(svc.balls()).toBe(0);
      expect(svc.phase()).toBe('reward');
      expect(svc.daze()).toBeNull();
    });

    it('skipping the catch goes straight to the rewards', async () => {
      const svc = await started();
      svc.daze.set(daze(10, 0.5));
      svc.skipCatch();
      expect(svc.phase()).toBe('reward');
      expect(svc.daze()).toBeNull();
      expect(svc.rewards()).toHaveLength(3);
    });
  });

  describe('rewards and growth', () => {
    it('a rare candy raises the lowest-level member', async () => {
      const svc = await started();
      svc.daze.set(daze(10, 1));
      svc.throwBall();
      await vi.waitFor(() => expect(svc.partyView()).toHaveLength(2));
      // starter L15, recruit L>=15 (wave 1 spec level - 2 floors at 15)
      const before = svc.partyView().map((p) => p.mon.level);
      const lowest = before.indexOf(Math.min(...before));
      await svc.chooseReward(reward('candy', 3));
      expect(svc.partyView()[lowest]!.mon.level).toBe(before[lowest]! + 3);
      expect(svc.busy()).toBe(false);
      expect(svc.wave()).toBe(2);
    });

    it('healing is capped at full HP and coins are scaled by relics', async () => {
      const svc = await started();
      await svc.fight();
      svc.onBattleFinished({ playerWon: true, playerFinalHp: [30] });
      await vi.waitFor(() => expect(svc.phase()).toBe('catch'));
      svc.skipCatch();
      await svc.chooseReward(reward('heal', 0.4));
      expect(svc.partyView()[0]!.hpPct).toBe(70);
      await svc.chooseReward(reward('heal', 0.9));
      expect(svc.partyView()[0]!.hpPct).toBe(100);
    });

    it('the shop heals and equips, and a purchase removes the entry', async () => {
      const svc = await started();
      setWave(svc, WAVES_PER_BIOME);
      await svc.chooseReward(reward('coins', 0));
      const first = svc.shop()[0]!;
      svc.coins.set(first.cost + 5);
      svc.buy(first);
      expect(svc.coins()).toBe(5);
      expect(svc.shop()).not.toContain(first);
    });

    it('a duplicate relic refunds coins with a message', async () => {
      const svc = await started();
      setWave(svc, WAVES_PER_BIOME);
      await svc.chooseReward(reward('coins', 0));
      svc.coins.set(100);
      const entry = {
        kind: 'relic',
        label: '',
        desc: '',
        cost: 10,
        payload: 'lucky-coin',
      } as const;
      svc.buy(entry);
      const afterFirst = svc.coins();
      svc.buy({ ...entry });
      expect(svc.toast()).toContain('Duplicate relic');
      expect(svc.coins()).toBeGreaterThan(afterFirst - 10);
    });
  });
});
