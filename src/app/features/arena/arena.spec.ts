import { Component, input, output, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { beforeEach, describe, expect, it } from 'vitest';
import { BattlerFactory } from '../../core/battle/battler-factory';
import { POKEMON_TYPES } from '../../core/utils/type-chart';
import { LEADER_LADDER } from '../../game/arena/gym-leaders';
import type { Battler } from '../../game/engine';
import type { MatchOutcome, PlayerMatchSetup } from '../../game/tournament';
import { PokedexService } from '../pokedex/pokedex.service';
import { TeamBuilderService } from '../team-builder/team-builder.service';
import { TournamentMatchComponent } from '../tournaments/tournament-match/tournament-match';
import { ArenaProgressStore } from './arena-progress.store';
import { ArenaComponent } from './arena';
import { ArenaService } from './arena.service';

/** The interactive match is covered by its own spec; here it is just a hook to report outcomes. */
@Component({
  selector: 'pv-tournament-match',
  template: '<p class="stub-match">{{ setup().foe.name }}</p>',
})
class StubMatch {
  readonly setup = input.required<PlayerMatchSetup>();
  readonly finished = output<MatchOutcome>();
}

const mon = (id: number | string, level: number): Battler => ({
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
  sprite: 'x.png',
});

describe('ArenaComponent', () => {
  let fixture: ComponentFixture<ArenaComponent>;
  let fail: boolean;
  const first = LEADER_LADDER[0]!;

  beforeEach(() => {
    localStorage.clear();
    fail = false;
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
        {
          provide: PokedexService,
          useValue: {
            entries: signal([{ id: 7, name: first.team[0]!.species }]),
            ensureLoaded: () => Promise.resolve(),
          },
        },
      ],
    });
    TestBed.overrideComponent(ArenaComponent, {
      remove: { imports: [TournamentMatchComponent] },
      add: { imports: [StubMatch] },
    });
    fixture = TestBed.createComponent(ArenaComponent);
    fixture.detectChanges();
  });

  const el = () => fixture.nativeElement as HTMLElement;
  const svc = () => TestBed.inject(ArenaService);
  const flush = async () => {
    await new Promise((r) => setTimeout(r, 0));
    fixture.detectChanges();
  };
  const click = (selector: string, index = 0) => {
    el().querySelectorAll<HTMLElement>(selector)[index]!.click();
  };
  const matchStub = () =>
    fixture.debugElement.query(By.directive(StubMatch)).componentInstance as StubMatch;

  async function enterBattle(): Promise<void> {
    click('.ladder .card .btn');
    await flush();
    click('.vs-splash .btn.big');
    fixture.detectChanges();
  }

  it('renders the hub with one card per leader and a locked gauntlet', () => {
    expect(el().querySelectorAll('.ladder .card')).toHaveLength(LEADER_LADDER.length);
    expect(el().querySelector('.progress strong')!.textContent).toContain(
      `0 / ${LEADER_LADDER.length}`,
    );
    expect(el().querySelector<HTMLButtonElement>('.gauntlet-panel .btn')!.disabled).toBe(true);
    expect(el().querySelector('.reset-row')).toBeNull();
    expect(el().querySelectorAll('.card .earned')).toHaveLength(0);
  });

  it('shows the leader team as artwork when the Pokédex knows the species', () => {
    const imgs = el().querySelectorAll<HTMLImageElement>(
      '.ladder .card:first-child .scout-mon img',
    );
    expect(imgs.length).toBeGreaterThanOrEqual(1);
    expect(imgs[0]!.src).toContain('/pokemon/7.png');
    expect(el().querySelectorAll('.ladder .card:first-child .scout-ph').length).toBe(
      first.team.length - 1,
    );
    expect(el().querySelectorAll('.ladder .card:first-child .ace-pip')).toHaveLength(1);
  });

  it('Challenge opens the VS splash with odds and a recommended lead', async () => {
    click('.ladder .card .btn');
    expect(svc().status()).toBe('loading');
    fixture.detectChanges();
    expect(el().querySelector('.state')!.textContent).toContain(first.name);
    await flush();
    expect(el().querySelector('.vs-splash')).not.toBeNull();
    expect(el().querySelector('.vs-name')!.textContent).toContain(first.name);
    expect(el().querySelector('.vs-quote')!.textContent).toContain(first.dialogue.intro);
    expect(el().querySelector('.vi-pct')!.textContent).toMatch(/· \d+%/);
    expect(el().querySelector('.vi-chip.up')!.textContent).toMatch(/\d+\/\d+/);
    expect(el().querySelectorAll('.vs-team .vs-mon').length).toBeGreaterThan(3);
  });

  it('Back on the splash returns to the hub', async () => {
    click('.ladder .card .btn');
    await flush();
    click('.vs-splash .forfeit');
    fixture.detectChanges();
    expect(svc().status()).toBe('hub');
    expect(el().querySelector('.ladder')).not.toBeNull();
  });

  it('plays a gym: battle → reward with stars and coins → hub with the badge', async () => {
    await enterBattle();
    expect(svc().status()).toBe('battle');
    expect(el().querySelector('.leader-line')!.textContent).toContain(first.dialogue.intro);
    expect(el().querySelector('.stub-match')!.textContent).toBe(first.name);

    matchStub().finished.emit({ playerWon: true, playerFinalHp: [10, 10, 10] });
    fixture.detectChanges();
    expect(svc().status()).toBe('reward');
    expect(el().querySelector('.reward-screen.win')).not.toBeNull();
    expect(el().querySelector('.reward-coins')!.textContent).toContain(`+${svc().reward()!.coins}`);
    expect(el().querySelectorAll('.star-row .star.on')).toHaveLength(3);
    expect(el().querySelector('.badge-award')).not.toBeNull();

    click('.reward-screen .btn');
    fixture.detectChanges();
    expect(svc().status()).toBe('hub');
    expect(el().querySelector('.ladder .card.owned')).not.toBeNull();
    expect(el().querySelector('.card .earned')).not.toBeNull();
    expect(el().querySelectorAll('.card-stars .star.on')).toHaveLength(3);
    expect(el().querySelector('.reset-row')).not.toBeNull();
  });

  it('a defeat shows the leader victory line without a badge', async () => {
    await enterBattle();
    matchStub().finished.emit({ playerWon: false, playerFinalHp: [0, 0, 0] });
    fixture.detectChanges();
    expect(el().querySelector('.reward-screen.win')).toBeNull();
    expect(el().querySelector('.reward-line')!.textContent).toContain(first.dialogue.victory);
    expect(el().querySelector('.badge-award')).toBeNull();
  });

  it('Rematch on a cleared gym starts a stronger challenge; leaving the gym aborts', async () => {
    TestBed.inject(ArenaProgressStore).awardBadge(first.type);
    fixture.detectChanges();
    const rematch = el().querySelector<HTMLButtonElement>('.ladder .card .btn.ghost')!;
    rematch.click();
    await flush();
    expect(el().querySelector('.vs-tag')!.textContent).toContain('Rematch');

    click('.vs-splash .btn.big');
    fixture.detectChanges();
    click('.match-wrap .forfeit');
    fixture.detectChanges();
    expect(svc().status()).toBe('hub');
  });

  it('shows an error screen and recovers to the hub', async () => {
    fail = true;
    click('.ladder .card .btn');
    await flush();
    expect(el().querySelector('.err')).not.toBeNull();
    click('.state .btn');
    fixture.detectChanges();
    expect(svc().status()).toBe('hub');
  });

  it('Reset badge progress clears the case', () => {
    TestBed.inject(ArenaProgressStore).awardBadge(first.type);
    fixture.detectChanges();
    click('.reset-row .link');
    fixture.detectChanges();
    expect(svc().earnedCount()).toBe(0);
    expect(el().querySelector('.reset-row')).toBeNull();
  });

  describe('champion gauntlet', () => {
    beforeEach(() => {
      const store = TestBed.inject(ArenaProgressStore);
      POKEMON_TYPES.slice(0, 8).forEach((t) => store.awardBadge(t));
      fixture.detectChanges();
    });

    it('opens once eight badges are held and runs trainer after trainer', async () => {
      const open = el().querySelector<HTMLButtonElement>('.gauntlet-panel .btn')!;
      expect(open.disabled).toBe(false);
      open.click();
      await flush();
      expect(svc().status()).toBe('gauntlet');
      expect(el().querySelector('.leader-line.gauntlet')!.textContent).toContain('Elite 1');

      matchStub().finished.emit({ playerWon: true, playerFinalHp: [5, 5, 5] });
      await flush();
      expect(el().querySelector('.leader-line.gauntlet')!.textContent).toContain('Elite 2');
    });

    it('a gauntlet loss returns to the hub with a message; forfeit also returns', async () => {
      click('.gauntlet-panel .btn');
      await flush();
      matchStub().finished.emit({ playerWon: false, playerFinalHp: [0, 0, 0] });
      await flush();
      expect(svc().status()).toBe('hub');
      expect(el().querySelector('.toast.loss')).not.toBeNull();

      click('.gauntlet-panel .btn');
      await flush();
      click('.match-wrap .forfeit');
      fixture.detectChanges();
      expect(svc().status()).toBe('hub');
    });
  });
});
