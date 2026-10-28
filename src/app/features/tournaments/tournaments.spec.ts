import { Component, input, output } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { beforeEach, describe, expect, it } from 'vitest';
import { PokeApiClient } from '../../core/api/pokeapi.client';
import { BattlerFactory } from '../../core/battle/battler-factory';
import type { PokemonDto } from '../../core/dto/pokeapi.dto';
import type { Battler } from '../../game/engine';
import {
  makeTrainer,
  type BracketMatch,
  type MatchOutcome,
  type PlayerMatchSetup,
} from '../../game/tournament';
import { TournamentMatchComponent } from './tournament-match/tournament-match';
import { TournamentsComponent } from './tournaments';
import { TournamentService } from './tournaments.service';

@Component({
  selector: 'pv-tournament-match',
  template: '<p class="stub-match">{{ setup().foe.name }}</p>',
})
class StubMatch {
  readonly setup = input.required<PlayerMatchSetup>();
  readonly finished = output<MatchOutcome>();
}

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
    sprite: 'x.png',
  };
};

describe('TournamentsComponent', () => {
  let fixture: ComponentFixture<TournamentsComponent>;

  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: PokeApiClient,
          useValue: {
            pokemon: (id: number) => Promise.resolve(dto(id)),
            type: () => Promise.resolve({ pokemon: [] }),
          },
        },
        {
          provide: BattlerFactory,
          useValue: {
            totalBaseStats: (d: PokemonDto) => d.stats.reduce((s, x) => s + x.base_stat, 0),
            buildBattlerFromDto: (d: PokemonDto, level: number) => Promise.resolve(built(d, level)),
            battleSprite: () => 'sprite.png',
          },
        },
      ],
    });
    TestBed.overrideComponent(TournamentsComponent, {
      remove: { imports: [TournamentMatchComponent] },
      add: { imports: [StubMatch] },
    });
    fixture = TestBed.createComponent(TournamentsComponent);
    fixture.detectChanges();
  });

  const el = () => fixture.nativeElement as HTMLElement;
  const svc = () => TestBed.inject(TournamentService);
  const flush = async () => {
    await new Promise((r) => setTimeout(r, 0));
    fixture.detectChanges();
  };
  const click = (selector: string, index = 0) =>
    el().querySelectorAll<HTMLElement>(selector)[index]!.click();
  const modeIndex = (id: string) =>
    Array.from(el().querySelectorAll('.mode-card')).findIndex((b) =>
      (b.textContent ?? '').includes(id),
    );
  const stub = () =>
    fixture.debugElement.query(By.directive(StubMatch)).componentInstance as StubMatch;
  /** Component internals the template binds to. */
  const internals = () =>
    fixture.componentInstance as unknown as {
      matchOdds: () => number;
      oddsVerdict: () => string;
      career: () => { runs: number; earnings: number; wins: number; best: number } | null;
      rivalry: () => unknown;
      pickOptions: () => { id: string; mult: number }[];
      foeIsRival: () => boolean;
      hasPlayer: (m: BracketMatch) => boolean;
      isLive: (m: BracketMatch) => boolean;
      showCardOdds: (m: BracketMatch) => boolean;
      cardOddsA: (m: BracketMatch) => number;
      draftSize: () => number;
      canConfirmDraft: () => boolean;
      columns: () => { id: string; matches: unknown[] }[];
      selectedFormat: () => string;
    };

  async function startClassic(): Promise<void> {
    click('.mode-card', 0);
    await flush();
  }

  it('lists every mode and format on the idle screen', () => {
    expect(el().querySelectorAll('.mode-card')).toHaveLength(10);
    expect(el().querySelectorAll('.format-card')).toHaveLength(3);
    expect(el().querySelector('.format-card.on')!.getAttribute('aria-checked')).toBe('true');
    expect(internals().career()).toBeNull();
  });

  it('selecting a format marks it and the next run uses it', async () => {
    click('.format-card', 1);
    fixture.detectChanges();
    expect(internals().selectedFormat()).toBe('round-robin');
    expect(el().querySelectorAll('.format-card')[1]!.getAttribute('aria-checked')).toBe('true');
    await startClassic();
    expect(svc().format()).toBe('round-robin');
    expect(svc().status()).toBe('ready');
  });

  it('starting a knockout shows the bracket, pick-em strip and the Battle button', async () => {
    await startClassic();
    expect(svc().status()).toBe('ready');
    expect(el().querySelector('.tree')).not.toBeNull();
    expect(el().querySelector('.btn.battle')).not.toBeNull();
    expect(internals().pickOptions().length).toBe(16);
    expect(
      internals()
        .columns()
        .map((c) => c.id),
    ).toEqual(['r16', 'qf', 'sf', 'final']);
    expect(internals().matchOdds()).toBeGreaterThan(0);
    expect(['Favoured', 'Slight edge', 'Even match', 'Underdog', 'Long shot']).toContain(
      internals().oddsVerdict(),
    );
  });

  it('picking the champion hides the strip and locks once the match starts', async () => {
    await startClassic();
    click('.pk-opt', 0);
    fixture.detectChanges();
    expect(svc().pick()).not.toBeNull();
    expect(el().querySelector('.pk-opt')).toBeNull();
    click('.pickem .ghost'); // withdraw the call
    fixture.detectChanges();
    expect(svc().pick()).toBeNull();
    click('.pk-opt', 0);
    fixture.detectChanges();

    click('.btn.battle');
    fixture.detectChanges();
    expect(svc().pickLocked()).toBe(true);
    expect(el().querySelector('.pickem .ghost')).toBeNull();
  });

  it('Battle opens the interactive match; its outcome advances the bracket', async () => {
    await startClassic();
    click('.btn.battle');
    fixture.detectChanges();
    expect(el().querySelector('.stub-match')!.textContent).toBe(
      svc().currentMatchSetup()!.foe.name,
    );
    expect(el().querySelector('.btn.battle')).toBeNull();

    stub().finished.emit({ playerWon: true, playerFinalHp: [1, 1, 1] });
    fixture.detectChanges();
    expect(el().querySelector('.stub-match')).toBeNull();
    expect(svc().currentMatchSetup()!.round).toBe('qf');
  });

  it('winning the whole bracket shows the champion finale with the run record', async () => {
    await startClassic();
    for (let i = 0; i < 4; i++) {
      click('.btn.battle');
      fixture.detectChanges();
      stub().finished.emit({ playerWon: true, playerFinalHp: [1, 1, 1] });
      fixture.detectChanges();
    }
    expect(svc().status()).toBe('done');
    expect(el().querySelector('.finale.you')).not.toBeNull();
    expect(el().querySelector('.confetti')).not.toBeNull();
    expect(internals().career()).toMatchObject({ runs: 1, wins: 1, best: 1 });

    click('.finale .btn');
    fixture.detectChanges();
    expect(svc().status()).toBe('idle');
    expect(el().querySelectorAll('.mode-card')).toHaveLength(10);
    expect(el().querySelector('.career, .history')).not.toBeNull();
  });

  it('losing ends the run without the champion confetti', async () => {
    await startClassic();
    click('.btn.battle');
    fixture.detectChanges();
    stub().finished.emit({ playerWon: false, playerFinalHp: [0, 0, 0] });
    fixture.detectChanges();
    expect(svc().status()).toBe('done');
    expect(el().querySelector('.finale')).not.toBeNull();
    expect(el().querySelector('.finale.you')).toBeNull();
    expect(el().querySelector('.confetti')).toBeNull();
  });

  it('the draft screen enforces the team size before the bracket opens', async () => {
    click('.mode-card', modeIndex('Draft'));
    await flush();
    expect(svc().status()).toBe('draft');
    expect(el().querySelectorAll('.pool .pick')).toHaveLength(9);
    const confirm = () => el().querySelector<HTMLButtonElement>('.btn.confirm')!;
    expect(internals().draftSize()).toBe(3);
    expect(confirm().disabled).toBe(true);

    for (const i of [0, 1, 2, 3]) click('.pool .pick', i); // the fourth is refused
    fixture.detectChanges();
    expect(el().querySelectorAll('.pool .pick.on')).toHaveLength(3);
    expect(confirm().disabled).toBe(false);

    click('.pool .pick', 0); // toggle one off again
    fixture.detectChanges();
    expect(internals().canConfirmDraft()).toBe(false);
    click('.pool .pick', 0);
    fixture.detectChanges();

    confirm().click();
    await flush();
    expect(svc().status()).toBe('ready');
    expect(el().querySelector('.tree')).not.toBeNull();
    expect(svc().currentMatchSetup()!.playerTeam).toHaveLength(3);
  });

  it('Quit abandons a running bracket and returns to the mode list', async () => {
    await startClassic();
    const quit = Array.from(el().querySelectorAll<HTMLButtonElement>('button.ghost')).find((b) =>
      b.textContent?.includes('Quit'),
    )!;
    quit.click();
    fixture.detectChanges();
    expect(svc().status()).toBe('idle');
    expect(el().querySelectorAll('.mode-card')).toHaveLength(10);
  });

  it('a league run uses the standings layout instead of the tree', async () => {
    click('.format-card', 1);
    await startClassic();
    expect(svc().format()).toBe('round-robin');
    expect(el().querySelector('.tree')).toBeNull();
    expect(svc().standings()).not.toBeNull();
    expect(el().querySelector('.btn.battle')).not.toBeNull();
  });

  it('shows a load error on the idle screen', async () => {
    TestBed.inject(BattlerFactory).buildBattlerFromDto = () => Promise.reject(new Error('x'));
    await startClassic();
    expect(svc().status()).toBe('idle');
    expect(el().querySelector('.error')!.getAttribute('role')).toBe('alert');
  });

  describe('bracket card helpers', () => {
    const player = makeTrainer(0, true, [built(dto(1), 50)]);
    const cpu = makeTrainer(1, false, [built(dto(2), 50)]);
    const match = (o: Partial<BracketMatch>): BracketMatch => ({
      id: 'm',
      round: 'r16',
      slot: 0,
      a: player,
      b: cpu,
      winner: null,
      played: false,
      ...o,
    });

    it('recognises the player match and whether it is live', () => {
      const c = internals();
      expect(c.hasPlayer(match({}))).toBe(true);
      expect(c.hasPlayer(match({ a: cpu, b: null }))).toBe(false);
      expect(c.isLive(match({}))).toBe(true);
      expect(c.isLive(match({ played: true }))).toBe(false);
      expect(c.isLive(match({ b: null }))).toBe(false);
      expect(c.isLive(match({ a: cpu, b: cpu }))).toBe(false);
    });

    it('only shows odds for ready, unplayed cards', () => {
      const c = internals();
      expect(c.showCardOdds(match({}))).toBe(true);
      expect(c.showCardOdds(match({ played: true }))).toBe(false);
      expect(c.showCardOdds(match({ a: null }))).toBe(false);
    });

    it('computes side A odds, defaulting to 50 for an unset side', () => {
      const c = internals();
      const odds = c.cardOddsA(match({}));
      expect(odds).toBeGreaterThan(0);
      expect(odds).toBeLessThan(100);
      expect(c.cardOddsA(match({ b: null }))).toBe(50);
      expect(c.cardOddsA(match({ a: null }))).toBe(50);
    });
  });
});
