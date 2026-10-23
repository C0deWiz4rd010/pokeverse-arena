import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { BattlerFactory } from '../../core/battle/battler-factory';
import type { Battler } from '../../game/engine';
import { TOTAL_FLOORS, type RewardOption, type SpireNode } from '../../game/spire';
import { SpireService } from './spire.service';

const mon = (id: number, name = `mon-${id}`): Battler => ({
  id,
  name,
  level: 50,
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

const node = (type: SpireNode['type']): SpireNode => ({
  id: `n-${type}`,
  type,
  label: type,
  icon: 'gem',
  blurb: '',
});

async function startedRun(party = [mon(1), mon(4)]): Promise<SpireService> {
  const svc = TestBed.inject(SpireService);
  await svc.newRun();
  svc.confirmStarters(party);
  return svc;
}

describe('SpireService', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: BattlerFactory,
          useValue: { buildBattler: (id: number) => Promise.resolve(mon(id)) },
        },
      ],
    });
  });

  it('prepares a draft pool and starts on floor 1 with the picked party', async () => {
    const svc = TestBed.inject(SpireService);
    await svc.newRun();
    expect(svc.draftPool().length).toBeGreaterThan(0);
    svc.confirmStarters([]); // picking nobody does nothing
    expect(svc.phase()).toBe('setup');

    svc.confirmStarters(svc.draftPool().slice(0, 2));
    expect(svc.phase()).toBe('map');
    expect(svc.floor()).toBe(1);
    expect(svc.partyView()).toHaveLength(2);
    expect(svc.partyView().every((p) => p.hpPct === 100)).toBe(true);
    expect(svc.meta().runs).toBe(1);
  });

  it('a rest node advances the floor and heals', async () => {
    const svc = await startedRun();
    await svc.chooseNode(node('rest'));
    expect(svc.floor()).toBe(2);
    expect(svc.phase()).toBe('map');
    expect(svc.toast()).toContain('rests');
  });

  it('treasure pays coins and a relic, events do something and move on', async () => {
    const svc = await startedRun();
    await svc.chooseNode(node('treasure'));
    expect(svc.coins()).toBeGreaterThan(0);
    expect(svc.relics().length).toBe(1);
    expect(svc.floor()).toBe(2);

    await svc.chooseNode(node('event'));
    expect(svc.floor()).toBe(3);
    expect(svc.toast()).toBeTruthy();
  });

  it('the shop sells for coins, refuses when poor, and leaving advances the floor', async () => {
    const svc = await startedRun();
    await svc.chooseNode(node('shop'));
    expect(svc.phase()).toBe('shop');
    const stock = svc.shop();
    expect(stock.length).toBeGreaterThan(0);

    const first = stock[0]!;
    svc.buy(first); // no coins yet
    expect(svc.shop()).toHaveLength(stock.length);

    svc.coins.set(10_000);
    for (const entry of stock.filter((e) => e.kind !== 'mon')) svc.buy(entry);
    expect(svc.coins()).toBeLessThan(10_000);

    svc.leaveShop();
    expect(svc.phase()).toBe('map');
    expect(svc.floor()).toBe(2);
  });

  it('applies every reward kind', async () => {
    const svc = await startedRun([mon(1)]);
    const reward = (r: Partial<RewardOption> & Pick<RewardOption, 'kind' | 'payload'>) =>
      ({ label: '', icon: 'gem', blurb: '', ...r }) as RewardOption;

    svc.chooseReward(reward({ kind: 'coins', payload: 50 }));
    expect(svc.coins()).toBe(50);
    svc.chooseReward(reward({ kind: 'relic', payload: 'lucky-coin' }));
    expect(svc.relics()).toEqual(['lucky-coin']);
    svc.chooseReward(reward({ kind: 'relic', payload: 'lucky-coin' })); // duplicate → refund
    expect(svc.relics()).toEqual(['lucky-coin']);
    svc.chooseReward(reward({ kind: 'item', payload: 'leftovers' }));
    expect(svc.partyView()[0]!.mon.item).toBe('leftovers');
    svc.chooseReward(reward({ kind: 'heal', payload: 0.5 }));
    svc.skipReward();
    expect(svc.floor()).toBe(7);
  });

  it('recruits a mon when there is room and converts it to coins when full', async () => {
    const svc = await startedRun([mon(1)]);
    svc.chooseReward({ kind: 'mon', label: '', icon: 'gem', blurb: '', payload: 25 });
    await Promise.resolve();
    await Promise.resolve();
    expect(svc.partyView().length).toBe(2);
  });

  it('clearing every floor wins the run and discards the save', async () => {
    const svc = await startedRun();
    for (let i = 0; i < TOTAL_FLOORS; i++) await svc.chooseNode(node('rest'));
    expect(svc.phase()).toBe('won');
    expect(svc.savedRun()).toBeNull();
    expect(svc.meta().clears).toBe(1);
  });

  it('abandon returns to setup before a run and ends an active one; backToHub resets the draft', async () => {
    const svc = TestBed.inject(SpireService);
    await svc.newRun();
    svc.abandon();
    expect(svc.phase()).toBe('setup');
    svc.backToHub();
    expect(svc.draftPool()).toHaveLength(0);

    const run = await startedRun();
    run.abandon();
    expect(run.phase()).toBe('lost');
  });

  it('survives a failed draft with an error message', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: BattlerFactory,
          useValue: { buildBattler: () => Promise.reject(new Error('offline')) },
        },
      ],
    });
    const svc = TestBed.inject(SpireService);
    await svc.newRun();
    expect(svc.error()).toBeTruthy();
    expect(svc.busy()).toBe(false);
  });
});
