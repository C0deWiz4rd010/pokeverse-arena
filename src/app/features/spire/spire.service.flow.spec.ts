/* eslint-disable @typescript-eslint/no-misused-promises */
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BattlerFactory } from '../../core/battle/battler-factory';
import type { Battler } from '../../game/engine';
import type { FoeSpec, RewardOption, SpireNode } from '../../game/spire';
import { SpireService } from './spire.service';

const mon = (id: number, name = `mon-${id}`, level = 50): Battler => ({
  id,
  name,
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

const foe = (over: Partial<FoeSpec> = {}): FoeSpec => ({
  name: 'Rival Rex',
  species: [10, 11],
  level: 40,
  aiTier: 'strong',
  boss: false,
  ...over,
});

const battleNode = (type: 'battle' | 'elite' | 'boss', over: Partial<FoeSpec> = {}): SpireNode => ({
  id: `n-${type}`,
  type,
  label: type,
  icon: 'swords',
  blurb: '',
  foe: foe({ boss: type === 'boss', ...over }),
});

const reward = (kind: RewardOption['kind'], payload: string | number): RewardOption => ({
  kind,
  label: kind,
  icon: 'gem',
  blurb: '',
  payload,
});

describe('SpireService battle flow', () => {
  let buildBattler: ReturnType<typeof vi.fn>;

  async function started(party = [mon(1), mon(4)]): Promise<SpireService> {
    TestBed.configureTestingModule({
      providers: [{ provide: BattlerFactory, useValue: { buildBattler } }],
    });
    const svc = TestBed.inject(SpireService);
    await svc.newRun();
    svc.confirmStarters(party);
    return svc;
  }

  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
    buildBattler = vi
      .fn()
      .mockImplementation((id: number, level = 50) => Promise.resolve(mon(id, `mon-${id}`, level)));
  });

  describe('starting a battle', () => {
    it('builds the foe team and the match setup for a trainer battle', async () => {
      const svc = await started();
      buildBattler.mockClear();
      await svc.chooseNode(battleNode('battle'));

      expect(svc.phase()).toBe('battle');
      expect(svc.busy()).toBe(false);
      expect(buildBattler).toHaveBeenCalledWith(10, 40);
      expect(buildBattler).toHaveBeenCalledWith(11, 40);
      const setup = svc.setup()!;
      expect(setup.foe.name).toBe('Rival Rex');
      expect(setup.foe.title).toBe('Challenger');
      expect(setup.aiTier).toBe('strong');
      expect(setup.playerStartHp).toEqual([100, 100]);
      expect(setup.player.isPlayer).toBe(true);
      expect(setup.foeTeam).toHaveLength(2);
      expect(setup.foeAce).toBeUndefined();
      expect(setup.match.id).toBe('spire-1');
    });

    it('titles guardians and chimera keepers and announces the chimera ace', async () => {
      const svc = await started();
      await svc.chooseNode(battleNode('boss'));
      expect(svc.setup()!.foe.title).toBe('Floor Guardian');

      await svc.chooseNode(battleNode('boss', { fusion: { head: 6, body: 150 } }));
      const setup = svc.setup()!;
      expect(setup.foe.title).toBe('Chimera Keeper');
      expect(setup.foeTeam).toHaveLength(3); // two species + the fused ace
      expect(setup.foeAce).toContain('forbidden splice');
    });

    it('survives some foes failing and aborts back to the map when none load', async () => {
      const svc = await started();
      buildBattler.mockImplementationOnce(() => Promise.reject(new Error('x')));
      await svc.chooseNode(battleNode('battle'));
      expect(svc.setup()!.foeTeam).toHaveLength(1);

      buildBattler.mockRejectedValue(new Error('offline'));
      await svc.chooseNode(battleNode('battle'));
      expect(svc.phase()).toBe('map');
      expect(svc.error()).toBe('The challenger never showed. Try the floor again.');
      expect(svc.busy()).toBe(false);
    });

    it('carries remaining HP into the next fight', async () => {
      const svc = await started();
      await svc.chooseNode(battleNode('battle'));
      svc.onBattleFinished({ playerWon: true, playerFinalHp: [30, 60] });
      expect(svc.partyView().map((p) => p.hpPct)).toEqual([30, 60]);
      svc.skipReward();
      await svc.chooseNode(battleNode('battle'));
      expect(svc.setup()!.playerStartHp).toEqual([30, 60]);
    });
  });

  describe('after a battle', () => {
    it('a defeat ends the run and records the meta', async () => {
      const svc = await started();
      await svc.chooseNode(battleNode('battle'));
      svc.onBattleFinished({ playerWon: false, playerFinalHp: [0, 0] });
      expect(svc.phase()).toBe('lost');
      expect(svc.setup()).toBeNull();
      expect(svc.savedRun()).toBeNull();
      expect(svc.meta().bestDepth).toBe(1);
    });

    it('victories pay more for elites and bosses and offer a reward draft', async () => {
      const normal = await started();
      await normal.chooseNode(battleNode('battle'));
      normal.onBattleFinished({ playerWon: true, playerFinalHp: [100, 100] });
      expect(normal.phase()).toBe('reward');
      expect(normal.coins()).toBe(25 + 6);
      expect(normal.rewards().length).toBeGreaterThan(0);

      TestBed.resetTestingModule();
      localStorage.clear();
      const elite = await started();
      await elite.chooseNode(battleNode('elite'));
      elite.onBattleFinished({ playerWon: true, playerFinalHp: [100, 100] });
      expect(elite.coins()).toBe(25 + 6 + 30);

      TestBed.resetTestingModule();
      localStorage.clear();
      const boss = await started();
      await boss.chooseNode(battleNode('boss'));
      boss.onBattleFinished({ playerWon: true, playerFinalHp: [100, 100] });
      expect(boss.coins()).toBe(25 + 6 + 80);
    });

    it('beating a chimera adds a chimera reward that can be tamed', async () => {
      const svc = await started();
      await svc.chooseNode(battleNode('boss', { fusion: { head: 6, body: 150 } }));
      svc.onBattleFinished({ playerWon: true, playerFinalHp: [100, 100] });
      expect(svc.meta().chimeraWins).toBe(1);
      expect(svc.rewards()[0]!.kind).toBe('chimera');
      expect(svc.coins()).toBeGreaterThan(25 + 6 + 80); // bonus 60 included

      svc.chooseReward(svc.rewards()[0]!);
      expect(svc.partyView()).toHaveLength(3);
      expect(svc.partyView()[2]!.hpPct).toBe(100);
      expect(svc.toast()).toContain('was tamed');
    });

    it('a full party turns the chimera into coins', async () => {
      const svc = await started([mon(1), mon(2), mon(3)]);
      for (const id of [20, 21, 22]) {
        svc.chooseReward(reward('mon', id));
        await vi.waitFor(() => expect(svc.partyView().length).toBe(3 + (id - 19)));
      }
      expect(svc.partyView()).toHaveLength(6);

      await svc.chooseNode(battleNode('boss', { fusion: { head: 6, body: 150 } }));
      svc.onBattleFinished({ playerWon: true, playerFinalHp: [100, 100, 100, 100, 100, 100] });
      const coins = svc.coins();
      svc.chooseReward(svc.rewards()[0]!);
      expect(svc.partyView()).toHaveLength(6);
      expect(svc.coins()).toBe(coins + 90);
      expect(svc.toast()).toContain('dissolves into coins');
    });
  });

  describe('recruiting', () => {
    it('a recruit at a full party becomes coins', async () => {
      const svc = await started([mon(1), mon(2), mon(3)]);
      for (const id of [20, 21, 22]) {
        svc.chooseReward(reward('mon', id));
        await vi.waitFor(() => expect(svc.partyView().length).toBe(3 + (id - 19)));
      }
      const coins = svc.coins();
      svc.chooseReward(reward('mon', 30));
      await Promise.resolve();
      expect(svc.partyView()).toHaveLength(6);
      expect(svc.coins()).toBe(coins + 60);
      expect(svc.toast()).toContain('converted to coins');
    });

    it('a recruit that cannot be built is dropped silently', async () => {
      const svc = await started();
      buildBattler.mockRejectedValue(new Error('offline'));
      svc.chooseReward(reward('mon', 30));
      await Promise.resolve();
      await Promise.resolve();
      expect(svc.partyView()).toHaveLength(2);
    });

    it('a shop recruit joins the party and is removed from stock', async () => {
      const svc = await started();
      await svc.chooseNode({ id: 's', type: 'shop', label: '', icon: 'gem', blurb: '' });
      svc.coins.set(10_000);
      const entry = { kind: 'mon', label: '', icon: 'gem', cost: 50, payload: 25 } as const;
      svc.shop.set([entry]);
      svc.buy(entry);
      await vi.waitFor(() => expect(svc.partyView()).toHaveLength(3));
      expect(svc.coins()).toBe(10_000 - 50);
      expect(svc.shop()).toEqual([]);
    });
  });

  describe('non-battle nodes', () => {
    it('a rest heals half the party HP', async () => {
      const svc = await started();
      await svc.chooseNode(battleNode('battle'));
      svc.onBattleFinished({ playerWon: true, playerFinalHp: [10, 20] });
      svc.skipReward();
      await svc.chooseNode({ id: 'r', type: 'rest', label: '', icon: 'heart', blurb: '' });
      expect(svc.partyView().map((p) => p.hpPct)).toEqual([60, 70]);
    });

    it('events resolve to a heal, coins or an item across floors', async () => {
      const toasts = new Set<string>();
      for (let i = 0; i < 12 && toasts.size < 3; i++) {
        TestBed.resetTestingModule();
        localStorage.clear();
        const svc = await started();
        for (let f = 0; f < i; f++) svc.skipReward();
        await svc.chooseNode({ id: 'e', type: 'event', label: '', icon: 'gem', blurb: '' });
        toasts.add(svc.toast()!);
      }
      expect(toasts.size).toBeGreaterThanOrEqual(1);
      for (const t of toasts) {
        expect(t.includes('spring') || t.includes('cache of coins') || t.includes('merchant')).toBe(
          true,
        );
      }
    });

    it('treasure grants coins and a relic', async () => {
      const svc = await started();
      await svc.chooseNode({ id: 't', type: 'treasure', label: '', icon: 'gem', blurb: '' });
      expect(svc.coins()).toBeGreaterThanOrEqual(40);
      expect(svc.relics()).toHaveLength(1);
      expect(svc.toast()).toContain('Relic gained');
      expect(svc.relicList()).toHaveLength(1);
    });
  });

  describe('abandoning and ending', () => {
    it('abandoning from the shop or reward screen ends the run', async () => {
      const svc = await started();
      await svc.chooseNode({ id: 's', type: 'shop', label: '', icon: 'gem', blurb: '' });
      svc.abandon();
      expect(svc.phase()).toBe('lost');
      expect(svc.savedRun()).toBeNull();
    });

    it('a duplicate relic reward refunds coins', async () => {
      const svc = await started();
      svc.chooseReward(reward('relic', 'lucky-coin'));
      const coins = svc.coins();
      svc.chooseReward(reward('relic', 'lucky-coin'));
      expect(svc.relics()).toEqual(['lucky-coin']);
      expect(svc.coins()).toBeGreaterThan(coins);
    });
  });
});
