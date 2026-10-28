import { Component, input, output } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PokeApiClient } from '../../core/api/pokeapi.client';
import { BattlerFactory } from '../../core/battle/battler-factory';
import { SaveService } from '../../core/storage/save.service';
import type { Battler } from '../../game/engine';
import {
  WAVES_PER_BIOME,
  waveSpec,
  type OdysseyReward,
  type OdysseyShopEntry,
} from '../../game/odyssey/odyssey';
import type { MatchOutcome, PlayerMatchSetup } from '../../game/tournament';
import { TournamentMatchComponent } from '../tournaments/tournament-match/tournament-match';
import { OdysseyComponent } from './odyssey';
import { OdysseyService } from './odyssey.service';

const mon = (id: number | string, level = 15): Battler => ({
  id: typeof id === 'number' ? id : 0,
  name: typeof id === 'number' ? `mon-${id}` : id,
  level,
  types: ['normal'],
  sprite: `sprite-${id}.png`,
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

@Component({
  selector: 'pv-tournament-match',
  template: `
    <span class="stub-foe">{{ setup().foe.name }}</span>
    <button class="stub-win" type="button" (click)="win()">win</button>
    <button class="stub-lose" type="button" (click)="lose()">lose</button>
  `,
})
class StubMatchComponent {
  readonly setup = input.required<PlayerMatchSetup>();
  readonly finished = output<MatchOutcome>();
  win(): void {
    this.finished.emit({ playerWon: true, playerFinalHp: [80] });
  }
  lose(): void {
    this.finished.emit({ playerWon: false, playerFinalHp: [0] });
  }
}

describe('OdysseyComponent', () => {
  let fixture: ComponentFixture<OdysseyComponent>;
  let svc: OdysseyService;

  const root = () => fixture.nativeElement as HTMLElement;
  const text = () => root().textContent ?? '';
  const flush = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const byText = (label: string) =>
    [...root().querySelectorAll<HTMLButtonElement>('button')].find((b) =>
      b.textContent?.includes(label),
    );
  const all = (sel: string) => [...root().querySelectorAll<HTMLButtonElement>(sel)];

  function configure(): void {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: BattlerFactory,
          useValue: {
            buildBattler: (id: number | string, level = 15) => Promise.resolve(mon(id, level)),
          },
        },
        {
          provide: PokeApiClient,
          useValue: {
            species: () => Promise.reject(new Error('offline')),
            evolutionChain: () => Promise.reject(new Error('offline')),
          },
        },
      ],
    });
    TestBed.overrideComponent(OdysseyComponent, {
      remove: { imports: [TournamentMatchComponent] },
      add: { imports: [StubMatchComponent] },
    });
  }

  async function mount(): Promise<void> {
    svc = TestBed.inject(OdysseyService);
    fixture = TestBed.createComponent(OdysseyComponent);
    await flush();
  }

  async function startRun(): Promise<void> {
    byText('Begin an Odyssey')!.click();
    await flush();
    all('.roster-mon')[3]!.click();
    await vi.waitFor(() => expect(svc.phase()).toBe('wave'));
    await flush();
  }

  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
    configure();
  });

  it('shows the hub with the lifetime stats', async () => {
    await mount();
    expect(text()).toContain('Best wave');
    expect(all('.hub-stats .stat')).toHaveLength(4);
    expect(root().querySelector('.stat:nth-child(3) strong')!.textContent).toBe('4');
    expect(byText('Continue run')).toBeUndefined();
    expect(byText('Daily march')).toBeDefined();
  });

  it('starts a daily run through the starter screen and goes back from it', async () => {
    await mount();
    byText('Daily march')!.click();
    await flush();
    expect(svc.isDaily()).toBe(true);
    expect(text()).toContain('Choose your companion');
    expect(all('.roster-mon')).toHaveLength(4);

    byText('Back')!.click();
    await flush();
    expect(text()).toContain('Best wave');
  });

  it('picking a starter shows the wave preview with the foe and Engage button', async () => {
    await mount();
    await startRun();
    const spec = svc.spec()!;
    expect(text()).toContain('Wave 1');
    expect(text()).toContain(spec.biome.name);
    expect(text()).toContain('Wild encounter');
    expect(all('.foe')).toHaveLength(1);
    expect(root().querySelector('.foe')!.textContent).toContain(`Lv ${spec.level}`);
    expect(all('.pm')).toHaveLength(1);
    expect(root().querySelector('.party-balls')!.textContent).toContain('5');
  });

  it('shows an error when the starter cannot be woken', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: BattlerFactory,
          useValue: { buildBattler: () => Promise.reject(new Error('offline')) },
        },
        { provide: PokeApiClient, useValue: {} },
      ],
    });
    await mount();
    byText('Begin an Odyssey')!.click();
    await flush();
    all('.roster-mon')[0]!.click();
    await vi.waitFor(() => expect(svc.error()).toBeTruthy());
    await flush();
    expect(root().querySelector('.err')!.textContent).toContain('overslept');
    expect(text()).toContain('Choose your companion');
  });

  it('labels elite and boss waves and announces the guardian field', async () => {
    await mount();
    await startRun();
    svc.spec.set(waveSpec(5, 's'));
    await flush();
    expect(text()).toContain('Elite pack');
    expect(all('.foe')).toHaveLength(2);

    svc.spec.set(waveSpec(WAVES_PER_BIOME, 's'));
    await flush();
    expect(text()).toContain('Guardian');
    expect(root().querySelector('.wave-field')!.textContent).toContain(
      svc.spec()!.biome.field.label,
    );
  });

  it('fights through the match component, then offers a catch and a reward', async () => {
    await mount();
    await startRun();
    byText('Engage!')!.click();
    await vi.waitFor(() => expect(svc.phase()).toBe('battle'));
    await flush();
    expect(root().querySelector('.stub-foe')!.textContent).toBe('Wild Encounter');

    root().querySelector<HTMLButtonElement>('.stub-win')!.click();
    await vi.waitFor(() => expect(svc.phase()).toBe('catch'));
    await flush();
    expect(text()).toContain('is dazed!');
    expect(text()).toContain(`Catch chance ${Math.round(svc.spec()!.catchChance * 100)}%`);
    expect(text()).toContain('5 balls left');

    svc.daze.set({ ...svc.daze()!, chance: 1 });
    byText('Throw a ball')!.click();
    await vi.waitFor(() => expect(svc.phase()).toBe('reward'));
    await flush();
    expect(text()).toContain('The road provides');
    expect(all('.reward-card')).toHaveLength(3);
    expect(text()).toContain('joins the march');
    expect(all('.pm')).toHaveLength(2);

    all('.reward-card')[0]!.click();
    await vi.waitFor(() => expect(svc.phase()).toBe('wave'));
    await flush();
    expect(text()).toContain('Wave 2');
  });

  it('letting the foe flee skips to the rewards and the last ball is singular', async () => {
    await mount();
    await startRun();
    svc.phase.set('catch');
    svc.balls.set(1);
    svc.daze.set({ dexId: 10, name: 'mon-10', sprite: 's.png', chance: 0 });
    await flush();
    expect(text()).toContain('1 ball left');
    byText('Let it flee')!.click();
    await flush();
    expect(text()).toContain('The road provides');
  });

  it('disables the throw button when out of balls', async () => {
    await mount();
    await startRun();
    svc.phase.set('catch');
    svc.balls.set(0);
    svc.daze.set({ dexId: 10, name: 'mon-10', sprite: 's.png', chance: 0.5 });
    await flush();
    expect(byText('Throw a ball')!.disabled).toBe(true);
  });

  it('a boss victory leads to the trader who sells and lets you continue', async () => {
    await mount();
    await startRun();
    svc.wave.set(WAVES_PER_BIOME);
    svc.spec.set(waveSpec(WAVES_PER_BIOME, 's'));
    svc.phase.set('reward');
    svc.rewards.set([
      { kind: 'coins', label: 'Purse', desc: 'coins', payload: 0 } as OdysseyReward,
    ]);
    await flush();
    all('.reward-card')[0]!.click();
    await vi.waitFor(() => expect(svc.phase()).toBe('shop'));
    await flush();
    expect(text()).toContain('Wandering Trader');

    const stock: OdysseyShopEntry[] = [
      { kind: 'balls', label: 'Ball pack', desc: '+3', cost: 20, payload: 3 },
      { kind: 'heal', label: 'Big heal', desc: 'heal', cost: 500, payload: 1 },
    ];
    svc.shop.set(stock);
    svc.coins.set(60);
    await flush();
    const items = all('.shop-item');
    expect(items[0]!.disabled).toBe(false);
    expect(items[1]!.disabled).toBe(true);
    const balls = svc.balls();
    items[0]!.click();
    await flush();
    expect(svc.balls()).toBe(balls + 3);
    expect(svc.coins()).toBe(40);

    byText('Leave & continue')!.click();
    await flush();
    expect(svc.wave()).toBe(WAVES_PER_BIOME + 1);
    expect(text()).toContain('Wave 11');
  });

  it('a defeat ends the march, shows unlocks, and returns to camp', async () => {
    await mount();
    await startRun();
    svc.runUnlocks.set([10, 11]);
    byText('Engage!')!.click();
    await vi.waitFor(() => expect(svc.phase()).toBe('battle'));
    await flush();
    root().querySelector<HTMLButtonElement>('.stub-lose')!.click();
    await flush();

    expect(text()).toContain('The march ends at wave 1');
    expect(text()).toContain('New personal best!');
    expect(text()).toContain('New starters unlocked this run:');
    expect(all('.unlocks img')).toHaveLength(2);

    byText('Back to camp')!.click();
    await flush();
    expect(text()).toContain('Best wave');
    expect(root().querySelector('.stat strong')!.textContent).toBe('1');
  });

  it('a defeat without unlocks shows the encouragement instead', async () => {
    await mount();
    await startRun();
    svc.abandon();
    await flush();
    expect(text()).toContain('No new species this time');
  });

  it('continues a saved run from the hub and abandons it from the wave screen', async () => {
    await mount();
    await startRun();
    fixture.destroy();
    TestBed.resetTestingModule();
    configure();
    await mount();
    const cont = byText('Continue run (wave 1)');
    expect(cont).toBeDefined();
    cont!.click();
    await flush();
    expect(text()).toContain('Wave 1');

    byText('Abandon run')!.click();
    await flush();
    expect(text()).toContain('The march ends at wave 1');
    expect(TestBed.inject(SaveService).read('odyssey:run', null)).toBeNull();
  });

  it('shows relics held in the party panel', async () => {
    await mount();
    await startRun();
    svc.relics.set(['lucky-coin']);
    await flush();
    expect(root().querySelector('.relics .relic-chip')).not.toBeNull();
  });
});
