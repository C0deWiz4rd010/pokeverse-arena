import { Component, input, output } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BattlerFactory } from '../../core/battle/battler-factory';
import { SaveService } from '../../core/storage/save.service';
import type { Battler } from '../../game/engine';
import { TOTAL_FLOORS, type ShopEntry, type SpireNode } from '../../game/spire';
import type { MatchOutcome, PlayerMatchSetup } from '../../game/tournament';
import { TournamentMatchComponent } from '../tournaments/tournament-match/tournament-match';
import { SpireComponent } from './spire';
import { SpireService } from './spire.service';

const mon = (id: number): Battler => ({
  id,
  name: `mon-${id}`,
  level: 50,
  types: id % 2 ? ['fire'] : ['water'],
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
    this.finished.emit({ playerWon: true, playerFinalHp: [50, 50, 50] });
  }
  lose(): void {
    this.finished.emit({ playerWon: false, playerFinalHp: [0, 0, 0] });
  }
}

const nodes: SpireNode[] = [
  {
    id: 'b',
    type: 'battle',
    label: 'Trainer Battle',
    icon: 'swords',
    blurb: 'A challenger',
    foe: { name: 'Rival Rex', species: [10], level: 40, aiTier: 'basic', boss: false },
  },
  { id: 'r', type: 'rest', label: 'Campfire', icon: 'heart', blurb: 'Rest up' },
  { id: 's', type: 'shop', label: 'Merchant', icon: 'gem', blurb: 'Buy things' },
];

describe('SpireComponent', () => {
  let fixture: ComponentFixture<SpireComponent>;
  let svc: SpireService;

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
          useValue: { buildBattler: (id: number) => Promise.resolve(mon(id)) },
        },
      ],
    });
    TestBed.overrideComponent(SpireComponent, {
      remove: { imports: [TournamentMatchComponent] },
      add: { imports: [StubMatchComponent] },
    });
  }

  async function mount(): Promise<void> {
    svc = TestBed.inject(SpireService);
    fixture = TestBed.createComponent(SpireComponent);
    await flush();
  }

  /** Walk the intro → draft → map path through the UI. */
  async function beginRun(): Promise<void> {
    byText('New Run')!.click();
    await vi.waitFor(() => expect(svc.draftPool().length).toBe(6));
    await flush();
    all('.pool .pick')
      .slice(0, 3)
      .forEach((b) => b.click());
    await flush();
    byText('Begin the climb')!.click();
    await flush();
    svc.choices.set(nodes);
    await flush();
  }

  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
    configure();
  });

  it('shows the intro with lifetime meta, hiding chimera stats until earned', async () => {
    await mount();
    expect(all('.meta-stat')).toHaveLength(4);
    expect(text()).toContain('Best depth');
    expect(text()).toContain(`Climb ${TOTAL_FLOORS} floors`);
    expect(byText('Continue run')).toBeUndefined();

    TestBed.resetTestingModule();
    configure();
    TestBed.inject(SaveService).write('spire:meta', {
      bestDepth: 9,
      runs: 3,
      clears: 1,
      bankedCoins: 77,
      ascension: 2,
      chimeraWins: 2,
    });
    await mount();
    expect(all('.meta-stat')).toHaveLength(5);
    expect(root().querySelector('.meta-stat.chimera strong')!.textContent).toBe('2');
    expect(text()).toContain('77');
  });

  it('drafts exactly three starters and begins the climb', async () => {
    await mount();
    byText('New Run')!.click();
    fixture.detectChanges();
    expect(text()).toContain('Preparing the spire');
    await vi.waitFor(() => expect(svc.draftPool().length).toBe(6));
    await flush();

    expect(text()).toContain('Draft your starting trio (0/3)');
    const begin = byText('Begin the climb')!;
    expect(begin.disabled).toBe(true);

    const picks = all('.pool .pick');
    picks.slice(0, 4).forEach((b) => b.click());
    await flush();
    expect(text()).toContain('(3/3)');
    expect(picks[3]!.classList.contains('on')).toBe(false); // a fourth pick is refused
    picks[0]!.click(); // deselect
    await flush();
    expect(text()).toContain('(2/3)');
    expect(begin.disabled).toBe(true);
    picks[3]!.click();
    await flush();
    expect(begin.disabled).toBe(false);

    begin.click();
    await flush();
    expect(svc.phase()).toBe('map');
    expect(svc.partyView()).toHaveLength(3);
    expect(text()).toContain('Floor 1 / ' + TOTAL_FLOORS);
    expect(all('.climb .step')).toHaveLength(TOTAL_FLOORS);
    expect(root().querySelector('.climb .step.current')).not.toBeNull();
    expect(all('.party-mon')).toHaveLength(3);
  });

  it('a daily run drafts from the daily seed', async () => {
    await mount();
    byText('Daily Run')!.click();
    await vi.waitFor(() => expect(svc.draftPool().length).toBe(6));
    const first = svc.draftPool().map((m) => m.id);

    TestBed.resetTestingModule();
    configure();
    await mount();
    byText('Daily Run')!.click();
    await vi.waitFor(() => expect(svc.draftPool().length).toBe(6));
    expect(svc.draftPool().map((m) => m.id)).toEqual(first);
  });

  it('shows an error banner when the draft fails', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: BattlerFactory,
          useValue: { buildBattler: () => Promise.reject(new Error('offline')) },
        },
      ],
    });
    await mount();
    byText('New Run')!.click();
    await vi.waitFor(() => expect(svc.error()).toBeTruthy());
    await flush();
    expect(root().querySelector('.err')!.textContent).toContain('Could not prepare the spire');
  });

  it('lists the offered nodes with foe details and a rest heals', async () => {
    await mount();
    await beginRun();
    expect(text()).toContain('Choose your path');
    expect(all('.node')).toHaveLength(3);
    expect(root().querySelector('.node.battle .node-foe')!.textContent).toContain('Rival Rex');

    all('.node')[1]!.click(); // rest
    await flush();
    expect(text()).toContain('Floor 2 / ' + TOTAL_FLOORS);
    expect(text()).toContain('Your party rests and recovers.');
  });

  it('plays a battle through the match component and picks a reward', async () => {
    await mount();
    await beginRun();
    all('.node')[0]!.click();
    await vi.waitFor(() => expect(svc.phase()).toBe('battle'));
    await flush();
    expect(root().querySelector('.stub-foe')!.textContent).toBe('Rival Rex');
    expect(text()).toContain('Floor 1 / ' + TOTAL_FLOORS);

    root().querySelector<HTMLButtonElement>('.stub-win')!.click();
    await flush();
    expect(text()).toContain('Pick a reward');
    const rewards = all('.reward');
    expect(rewards.length).toBeGreaterThan(0);
    expect(svc.coins()).toBeGreaterThan(0);
    expect(text()).toContain(`${svc.coins()} ₽`);

    rewards[0]!.click();
    await flush();
    expect(svc.floor()).toBe(2);
    expect(text()).toContain('Choose your path');
  });

  it('skipping the reward also advances', async () => {
    await mount();
    await beginRun();
    all('.node')[0]!.click();
    await vi.waitFor(() => expect(svc.phase()).toBe('battle'));
    await flush();
    root().querySelector<HTMLButtonElement>('.stub-win')!.click();
    await flush();
    byText('Skip reward')!.click();
    await flush();
    expect(svc.floor()).toBe(2);
  });

  it('a lost battle shows the end screen and returns to the intro', async () => {
    await mount();
    await beginRun();
    all('.node')[0]!.click();
    await vi.waitFor(() => expect(svc.phase()).toBe('battle'));
    await flush();
    root().querySelector<HTMLButtonElement>('.stub-lose')!.click();
    await flush();
    expect(text()).toContain('You fell on floor 1');

    byText('Return')!.click();
    await flush();
    expect(text()).toContain('Best depth');
    expect(svc.meta().bestDepth).toBe(1);
  });

  it('shows the victory screen after clearing the spire', async () => {
    await mount();
    await beginRun();
    svc.floor.set(TOTAL_FLOORS);
    svc.choices.set([nodes[1]!]);
    await flush();
    all('.node')[0]!.click();
    await flush();
    expect(text()).toContain('You reached the summit!');
    byText('Return')!.click();
    await flush();
    expect(text()).toContain('Best depth');
  });

  it('the shop shows stock, disables unaffordable items, buys and leaves', async () => {
    await mount();
    await beginRun();
    all('.node')[2]!.click();
    await flush();
    expect(text()).toContain('Shop');
    const stock: ShopEntry[] = [
      { kind: 'heal', label: 'Potion', icon: 'heart', cost: 30, payload: 0.5 },
      { kind: 'heal', label: 'Elixir', icon: 'heart', cost: 90, payload: 1 },
    ];
    svc.shop.set(stock);
    svc.coins.set(50);
    await flush();
    const items = all('.shop-item');
    expect(items).toHaveLength(2);
    expect(items[0]!.disabled).toBe(false);
    expect(items[1]!.disabled).toBe(true);

    items[0]!.click();
    await flush();
    expect(svc.coins()).toBe(20);
    expect(all('.shop-item')).toHaveLength(1);

    byText('Leave shop')!.click();
    await flush();
    expect(svc.floor()).toBe(2);
  });

  it('shows relics and fainted party members in the run HUD', async () => {
    await mount();
    await beginRun();
    svc.relics.set(['lucky-coin']);
    await flush();
    expect(root().querySelector('.relic-bar .relic')).not.toBeNull();
    expect(root().querySelector('.hud-coins')).not.toBeNull();
  });

  it('abandon from the HUD ends the run; a saved run can be continued', async () => {
    await mount();
    await beginRun();
    fixture.destroy();
    TestBed.resetTestingModule();
    configure();
    await mount();
    const cont = byText('Continue run (floor 1)');
    expect(cont).toBeDefined();
    cont!.click();
    await flush();
    expect(svc.phase()).toBe('map');
    expect(text()).toContain('Choose your path');

    byText('Abandon')!.click();
    await flush();
    expect(text()).toContain('You fell on floor 1');
  });
});
