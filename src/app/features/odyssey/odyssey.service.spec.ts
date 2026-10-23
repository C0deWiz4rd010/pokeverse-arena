import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { BattlerFactory } from '../../core/battle/battler-factory';
import type { Battler } from '../../game/engine';
import {
  WAVES_PER_BIOME,
  waveSpec,
  type OdysseyReward,
  type OdysseyShopEntry,
} from '../../game/odyssey/odyssey';
import { OdysseyService } from './odyssey.service';

const mon = (id: number): Battler => ({
  id,
  name: `mon-${id}`,
  level: 5,
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

const shopEntry = (
  kind: OdysseyShopEntry['kind'],
  payload: number | string,
  cost = 10,
): OdysseyShopEntry => ({ kind, label: '', desc: '', cost, payload });

async function startedRun(): Promise<OdysseyService> {
  const svc = TestBed.inject(OdysseyService);
  svc.startNewRun(false);
  await svc.pickStarter(25);
  return svc;
}

describe('OdysseyService', () => {
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

  it('starts at the hub, then drafts a starter and enters wave 1', async () => {
    const svc = TestBed.inject(OdysseyService);
    expect(svc.phase()).toBe('hub');
    expect(svc.starters().length).toBeGreaterThan(0);
    svc.startNewRun(true);
    expect(svc.phase()).toBe('starter');
    expect(svc.isDaily()).toBe(true);
    await svc.pickStarter(25);
    expect(svc.phase()).toBe('wave');
    expect(svc.wave()).toBe(1);
    expect(svc.balls()).toBe(5);
    expect(svc.partyView()).toHaveLength(1);
    expect(svc.spec()?.kind).toBe('wild');
  });

  it('goes back to the starter screen when the starter cannot be built', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: BattlerFactory,
          useValue: { buildBattler: () => Promise.reject(new Error('offline')) },
        },
      ],
    });
    const svc = TestBed.inject(OdysseyService);
    svc.startNewRun(false);
    await svc.pickStarter(25);
    expect(svc.phase()).toBe('starter');
    expect(svc.error()).toBeTruthy();
    expect(svc.busy()).toBe(false);
  });

  it('applies balls, coins, heal and item rewards then moves to the next wave', async () => {
    const svc = await startedRun();
    await svc.chooseReward(reward('balls', 3));
    expect(svc.balls()).toBe(8);
    expect(svc.wave()).toBe(2);
    await svc.chooseReward(reward('coins', 40));
    expect(svc.coins()).toBe(40);
    await svc.chooseReward(reward('heal', 0.5));
    await svc.chooseReward(reward('item', 'leftovers'));
    expect(svc.partyView()[0]!.mon.item).toBe('leftovers');
    expect(svc.wave()).toBe(5);
  });

  it('a boss wave leads to the trader, who sells and refuses like the Spire shop', async () => {
    const svc = await startedRun();
    svc.wave.set(WAVES_PER_BIOME);
    svc.spec.set(waveSpec(WAVES_PER_BIOME, 'x'));
    await svc.chooseReward(reward('coins', 0));
    expect(svc.phase()).toBe('shop');
    expect(svc.shop().length).toBeGreaterThan(0);

    const ballsBefore = svc.balls();
    svc.buy(shopEntry('balls', 2)); // too poor
    expect(svc.balls()).toBe(ballsBefore);

    svc.coins.set(500);
    svc.buy(shopEntry('balls', 2));
    svc.buy(shopEntry('heal', 0.3));
    svc.buy(shopEntry('relic', 'lucky-coin'));
    svc.buy(shopEntry('relic', 'lucky-coin')); // duplicate refunds
    svc.buy(shopEntry('item', 'life-orb'));
    expect(svc.balls()).toBe(ballsBefore + 2);
    expect(svc.relics()).toEqual(['lucky-coin']);

    svc.leaveShop();
    expect(svc.phase()).toBe('wave');
    expect(svc.wave()).toBe(WAVES_PER_BIOME + 1);
  });

  it('abandoning ends the run, records it and clears the save; backToHub resets', async () => {
    const svc = await startedRun();
    expect(svc.savedRun()).not.toBeNull();
    svc.abandon();
    expect(svc.phase()).toBe('lost');
    expect(svc.savedRun()).toBeNull();
    expect(svc.meta().runs).toBe(1);
    svc.backToHub();
    expect(svc.phase()).toBe('hub');
    expect(svc.spec()).toBeNull();

    svc.abandon(); // from the hub: stays put
    expect(svc.phase()).toBe('hub');
  });
});
