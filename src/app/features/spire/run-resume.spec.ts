import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { BattlerFactory } from '../../core/battle/battler-factory';
import type { Battler } from '../../game/engine';
import { OdysseyService } from '../odyssey/odyssey.service';
import { SpireService } from './spire.service';

const mon = (id: number, name: string): Battler => ({
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

function freshInjector() {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      {
        provide: BattlerFactory,
        useValue: { buildBattler: (id: number) => Promise.resolve(mon(id, `mon-${id}`)) },
      },
    ],
  });
}

describe('run resume', () => {
  beforeEach(() => {
    localStorage.clear();
    freshInjector();
  });

  it('Spire: a started run survives a reload and continues on the same floor', async () => {
    const first = TestBed.inject(SpireService);
    await first.newRun();
    expect(first.savedRun()).toBeNull();
    first.confirmStarters([mon(1, 'bulbasaur'), mon(4, 'charmander')]);
    expect(first.phase()).toBe('map');
    expect(first.savedRun()?.floor).toBe(1);

    freshInjector(); // "reload"
    const second = TestBed.inject(SpireService);
    expect(second.phase()).toBe('setup');
    expect(second.savedRun()?.floor).toBe(1);
    second.resumeRun();
    expect(second.phase()).toBe('map');
    expect(second.floor()).toBe(1);
    expect(second.partyView().map((p) => p.mon.name)).toEqual(['bulbasaur', 'charmander']);
    expect(second.choices().length).toBeGreaterThan(0);
  });

  it('Spire: abandoning the run discards the save', async () => {
    const svc = TestBed.inject(SpireService);
    await svc.newRun();
    svc.confirmStarters([mon(1, 'bulbasaur')]);
    svc.abandon();
    expect(svc.phase()).toBe('lost');
    expect(svc.savedRun()).toBeNull();
    freshInjector();
    expect(TestBed.inject(SpireService).savedRun()).toBeNull();
  });

  it('Spire: ignores a damaged save instead of crashing', () => {
    localStorage.setItem('pv:spire:run', JSON.stringify({ v: 1, data: { seed: 's', floor: 3 } }));
    expect(TestBed.inject(SpireService).savedRun()).toBeNull();
  });

  it('Odyssey: a run in progress is offered after a reload and keeps its wave and balls', async () => {
    const first = TestBed.inject(OdysseyService);
    first.startNewRun(false);
    await first.pickStarter(25);
    expect(first.phase()).toBe('wave');
    expect(first.savedRun()?.wave).toBe(1);

    freshInjector();
    const second = TestBed.inject(OdysseyService);
    expect(second.phase()).toBe('hub');
    second.resumeRun();
    expect(second.phase()).toBe('wave');
    expect(second.wave()).toBe(1);
    expect(second.balls()).toBe(5);
    expect(second.spec()).not.toBeNull();
    expect(second.partyView()).toHaveLength(1);
  });

  it('Odyssey: ending the run clears the save', async () => {
    const svc = TestBed.inject(OdysseyService);
    svc.startNewRun(false);
    await svc.pickStarter(25);
    svc.abandon();
    expect(svc.phase()).toBe('lost');
    expect(svc.savedRun()).toBeNull();
  });
});
