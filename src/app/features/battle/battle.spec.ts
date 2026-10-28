import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { SfxService } from '../../core/audio/sfx.service';
import { BattlerFactory } from '../../core/battle/battler-factory';
import { HapticsService } from '../../core/haptics/haptics.service';
import { ToastService } from '../../core/ui/toast/toast.service';
import { dailyMatchup, dailyKey } from '../../game/daily/daily';
import type { Battler, BattleMove } from '../../game/engine';
import { PokedexService } from '../pokedex/pokedex.service';
import { BattleComponent } from './battle';
import { BattleFxComponent } from './pixi/battle-fx';

@Component({ selector: 'pv-battle-fx', template: '' })
class StubFx {
  cast(): void {}
  impact(): void {}
}

const tackle: BattleMove = {
  name: 'Tackle',
  type: 'normal',
  power: 40,
  accuracy: 100,
  damageClass: 'physical',
};

const mon = (id: number, name: string, stats: Partial<Battler['stats']>, moves = [tackle]) =>
  ({
    id,
    name,
    level: 50,
    types: ['normal'],
    stats: {
      hp: 200,
      attack: 100,
      defense: 100,
      'special-attack': 100,
      'special-defense': 100,
      speed: 100,
      ...stats,
    },
    moves,
    sprite: `${name}.png`,
  }) as Battler;

const bruiser = (id: number, moves = [tackle]) =>
  mon(id, `bruiser-${id}`, { hp: 400, attack: 300, speed: 200 }, moves);
const frail = (id: number) => mon(id, `frail-${id}`, { hp: 20, defense: 1, speed: 1 });
const slayer = (id: number) =>
  mon(id, `slayer-${id}`, { hp: 400, attack: 400, speed: 300, defense: 400 });
const wall = (id: number, moves = [tackle]) =>
  mon(id, `wall-${id}`, { hp: 2000, defense: 1000, 'special-defense': 1000, speed: 1 }, moves);

type Internals = {
  phase: () => string;
  mode: () => string;
  error: () => string | null;
  busy: () => boolean;
  winner: () => 0 | 1 | null;
  log: () => { text: string; tone?: string }[];
  playerInput: () => string;
  playerHp: () => number;
  oppHp: () => number;
  struggling: () => boolean;
  blockedMoves: () => boolean[];
  weather: () => string;
  speed: () => number;
  start: () => Promise<void>;
  surpriseMe: () => Promise<void>;
  startDaily: () => Promise<void>;
  useMove: (i: number) => Promise<void>;
  rematch: () => void;
  newBattle: () => void;
  shareDaily: () => Promise<void>;
  setPlayerInput: (e: Event) => void;
  cycleSpeed: () => void;
};

describe('BattleComponent', () => {
  let fixture: ComponentFixture<BattleComponent>;
  let build: Mock<(id: string | number, level?: number) => Promise<Battler>>;
  let roster: (id: number) => Battler;
  let toast: ReturnType<typeof vi.fn>;
  let randomIds: number[];

  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    randomIds = [11, 22, 33, 44];
    roster = (id) => (id % 2 === 0 ? wall(id) : bruiser(id));
    build = vi.fn((id: string | number) => {
      if (id === 'missingno') return Promise.reject(new Error('404'));
      return Promise.resolve(roster(Number(id)));
    });
    toast = vi.fn();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: SfxService, useValue: { play: () => {} } },
        { provide: HapticsService, useValue: { fire: () => {} } },
        { provide: ToastService, useValue: { show: toast } },
        {
          provide: BattlerFactory,
          useValue: {
            buildBattler: build,
            randomId: (exclude?: number) => {
              const id = randomIds.shift() ?? 99;
              return id === exclude ? id + 1 : id;
            },
          },
        },
        {
          provide: PokedexService,
          useValue: {
            names: signal(['bulbasaur', 'ivysaur']),
            entries: signal([]),
            ensureLoaded: () => Promise.resolve(),
          },
        },
      ],
    });
    TestBed.overrideComponent(BattleComponent, {
      remove: { imports: [BattleFxComponent] },
      add: { imports: [StubFx] },
    });
  });

  afterEach(() => {
    fixture.destroy();
    vi.useRealTimers();
    Reflect.deleteProperty(navigator, 'share');
    Reflect.deleteProperty(navigator, 'clipboard');
  });

  const stubNav = (props: Record<string, unknown>) => {
    for (const [k, v] of Object.entries(props))
      Object.defineProperty(navigator, k, { value: v, configurable: true });
  };

  function mount(daily?: string): Internals {
    fixture = TestBed.createComponent(BattleComponent);
    if (daily !== undefined) fixture.componentRef.setInput('daily', daily);
    fixture.detectChanges();
    return fixture.componentInstance as unknown as Internals;
  }

  const el = () => fixture.nativeElement as HTMLElement;
  const press = (key: string, init: KeyboardEventInit = {}) =>
    document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...init }));
  const settle = async () => {
    await vi.runAllTimersAsync();
    fixture.detectChanges();
  };
  const logText = (c: Internals) => c.log().map((l) => l.text);

  async function fightToTheEnd(c: Internals): Promise<void> {
    let guard = 0;
    while (c.phase() === 'fighting' && guard++ < 60) {
      press('1');
      await settle();
    }
  }

  it('starts in setup with the name autocomplete and the daily card', () => {
    const c = mount();
    expect(c.phase()).toBe('setup');
    expect(el().querySelectorAll('#dex-names option')).toHaveLength(2);
    expect(el().querySelector('.daily')!.textContent).toContain(dailyKey());
    expect(el().querySelector('.daily-hint')).not.toBeNull();
  });

  it('fights the typed Pokémon (trimmed, lower-cased) against a different random foe', async () => {
    const c = mount();
    const input = el().querySelector<HTMLInputElement>('input[type=text]')!;
    input.value = '  PIKACHU  ';
    c.setPlayerInput({ target: input } as unknown as Event);
    expect(c.playerInput()).toBe('  PIKACHU  ');
    roster = (id) => bruiser(id);
    build.mockImplementation((id: string | number) =>
      Promise.resolve(bruiser(typeof id === 'number' ? id : 25)),
    );
    await c.start();
    expect(build.mock.calls[0]![0]).toBe('pikachu');
    expect(c.phase()).toBe('fighting');
    expect(c.mode()).toBe('free');
    fixture.detectChanges();
    const text = logText(c);
    expect(text[0]).toBe('A wild Bruiser 11 appeared!');
    expect(text[1]).toBe('Go, Bruiser 25!');
    expect(el().querySelectorAll('pv-move-button')).toHaveLength(1);
  });

  it('a blank name rolls a random fighter; Surprise me clears the field first', async () => {
    const c = mount();
    await c.start();
    expect(build.mock.calls[0]![0]).toBe(11);
    expect(build.mock.calls[1]![0]).toBe(22);

    c.newBattle();
    fixture.detectChanges();
    el().querySelector<HTMLInputElement>('input[type=text]')!.value = 'mew';
    c.setPlayerInput({ target: el().querySelector('input[type=text]') } as unknown as Event);
    await c.surpriseMe();
    expect(c.playerInput()).toBe('');
    expect(c.phase()).toBe('fighting');
  });

  it('reports an unknown Pokémon and stays in setup', async () => {
    const c = mount();
    const input = el().querySelector<HTMLInputElement>('input[type=text]')!;
    input.value = 'missingno';
    c.setPlayerInput({ target: input } as unknown as Event);
    await c.start();
    expect(c.phase()).toBe('setup');
    expect(c.error()).toContain('Could not load');
    fixture.detectChanges();
    expect(el().querySelector('.err')!.getAttribute('role')).toBe('alert');
  });

  it('plays turns by key, locks input while busy and ignores modifier keys', async () => {
    roster = (id) => (id === 11 ? bruiser(id) : wall(id));
    const c = mount();
    await c.start();
    const before = c.oppHp();
    press('1', { ctrlKey: true });
    expect(c.busy()).toBe(false);
    press('1');
    expect(c.busy()).toBe(true);
    press('1'); // ignored: busy
    await settle();
    expect(c.busy()).toBe(false);
    expect(c.oppHp()).toBeLessThan(before);
    expect(logText(c)).toContain('Bruiser 11 used Tackle!');
  });

  it('keys do nothing outside a fight', () => {
    const c = mount();
    press('1');
    expect(c.busy()).toBe(false);
    expect(c.phase()).toBe('setup');
  });

  it('a win shows the result and lets you rematch or start over', async () => {
    roster = (id) => (id === 11 ? bruiser(id) : frail(id));
    const c = mount();
    await c.start();
    await fightToTheEnd(c);
    expect(c.phase()).toBe('done');
    expect(c.winner()).toBe(0);
    expect(logText(c)).toContain('You won the battle!');
    expect(el().querySelector('.result.win')).not.toBeNull();

    c.rematch();
    expect(c.phase()).toBe('fighting');
    expect(c.winner()).toBeNull();
    expect(c.playerHp()).toBeGreaterThan(0);
    expect(logText(c)[0]).toContain('appeared');

    c.newBattle();
    expect(c.phase()).toBe('setup');
    expect(c.log()).toEqual([]);
    c.rematch(); // nobody left to rematch
    expect(c.phase()).toBe('setup');
  });

  it('a loss reports the defeat', async () => {
    roster = (id) => (id === 11 ? frail(id) : slayer(id));
    const c = mount();
    await c.start();
    await fightToTheEnd(c);
    expect(c.winner()).toBe(1);
    expect(logText(c)).toContain('You were defeated…');
    expect(el().querySelector('.result.loss')).not.toBeNull();
  });

  it('shows Struggle when every move is out of PP and blocks the empty move key', async () => {
    const onePp: BattleMove = { ...tackle, pp: 1 };
    roster = (id) => (id === 11 ? bruiser(id, [onePp]) : wall(id));
    const c = mount();
    await c.start();
    expect(c.blockedMoves()).toEqual([false]);
    press('1');
    await settle();
    expect(c.blockedMoves()).toEqual([true]);
    expect(c.struggling()).toBe(true);
    const struggle = el().querySelector<HTMLButtonElement>('.struggle')!;
    expect(struggle).not.toBeNull();
    struggle.click();
    await settle();
    expect(logText(c).filter((t) => t.includes('Bruiser 11 used')).length).toBeGreaterThanOrEqual(
      2,
    );
  });

  it('cycles and persists the playback speed', () => {
    const c = mount();
    c.cycleSpeed();
    expect(c.speed()).toBe(2);
    expect(localStorage.getItem('pv:battle:speed')).toContain('2');
  });

  describe('daily challenge', () => {
    const m = dailyMatchup(dailyKey());

    it('loads the seeded matchup and feeds the streak on the first win', async () => {
      roster = (id) => (id === m.playerId ? bruiser(id) : frail(id));
      const c = mount();
      await c.startDaily();
      expect(c.mode()).toBe('daily');
      expect(build).toHaveBeenCalledWith(m.playerId, m.level);
      expect(build).toHaveBeenCalledWith(m.opponentId, m.level);
      await fightToTheEnd(c);
      expect(c.winner()).toBe(0);
      expect(toast).toHaveBeenCalledTimes(1);
      expect((toast.mock.calls[0]![0] as { title: string }).title).toContain('streak');

      // A retry replays the exact same seeded battle but no longer counts.
      c.rematch();
      expect(c.mode()).toBe('daily');
      await fightToTheEnd(c);
      expect(toast).toHaveBeenCalledTimes(1);
    });

    it('a loss is recorded as the day’s counted attempt', async () => {
      roster = (id) => (id === m.playerId ? frail(id) : slayer(id));
      const c = mount();
      await c.startDaily();
      await fightToTheEnd(c);
      expect(c.winner()).toBe(1);
      fixture.detectChanges();
      expect(toast).not.toHaveBeenCalled();
      expect(localStorage.getItem('pv:daily:record')).toContain('"plays":1');
    });

    it('a deep link (?daily=1) starts the challenge by itself', async () => {
      roster = (id) => bruiser(id);
      const c = mount('1');
      await vi.runAllTimersAsync();
      expect(c.mode()).toBe('daily');
      expect(c.phase()).toBe('fighting');
    });

    it('any other daily value does not auto-start', () => {
      const c = mount('0');
      expect(c.phase()).toBe('setup');
    });

    it('falls back to free mode with an error when a challenger fails to load', async () => {
      build.mockRejectedValue(new Error('offline'));
      const c = mount();
      await c.startDaily();
      expect(c.mode()).toBe('free');
      expect(c.phase()).toBe('setup');
      expect(c.error()).toContain('Could not load today');
    });

    async function finishedDaily(): Promise<Internals> {
      roster = (id) => (id === m.playerId ? bruiser(id) : frail(id));
      const c = mount();
      await c.startDaily();
      await fightToTheEnd(c);
      toast.mockClear();
      return c;
    }

    it('shares through the native share sheet when available', async () => {
      const share = vi.fn(() => Promise.resolve());
      stubNav({ share });
      const c = await finishedDaily();
      await c.shareDaily();
      expect(share).toHaveBeenCalledTimes(1);
      const text = (share.mock.calls[0] as unknown as [{ text: string }])[0].text;
      expect(text).toContain(`PokéVerse Daily`);
      expect(text).toContain('Won in');
      expect(toast).not.toHaveBeenCalled();
    });

    it('copies the result when sharing is unavailable', async () => {
      const writeText = vi.fn(() => Promise.resolve());
      stubNav({ clipboard: { writeText } });
      const c = await finishedDaily();
      await c.shareDaily();
      expect(writeText).toHaveBeenCalledTimes(1);
      expect((toast.mock.calls[0]![0] as { title: string }).title).toContain('copied');
    });

    it('falls back to the clipboard when the share sheet is dismissed', async () => {
      const writeText = vi.fn(() => Promise.resolve());
      stubNav({ share: () => Promise.reject(new Error('abort')), clipboard: { writeText } });
      const c = await finishedDaily();
      await c.shareDaily();
      expect(writeText).toHaveBeenCalled();
    });

    it('says so when neither sharing nor copying works', async () => {
      stubNav({ clipboard: { writeText: () => Promise.reject(new Error('no')) } });
      const c = await finishedDaily();
      await c.shareDaily();
      expect((toast.mock.calls[0]![0] as { title: string }).title).toContain('Could not copy');
    });
  });
});
