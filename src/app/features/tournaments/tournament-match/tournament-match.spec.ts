import { Component } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SfxService } from '../../../core/audio/sfx.service';
import { HapticsService } from '../../../core/haptics/haptics.service';
import type { Battler, BattleMove } from '../../../game/engine';
import {
  makeTrainer,
  type BracketMatch,
  type MatchOutcome,
  type PlayerMatchSetup,
} from '../../../game/tournament';
import { BattleFxComponent } from '../../battle/pixi/battle-fx';
import { TournamentMatchComponent } from './tournament-match';

/** PixiJS cannot run in jsdom — a no-op layer with the same selector replaces it. */
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
const uTurn: BattleMove = {
  name: 'U-turn',
  type: 'normal',
  power: 40,
  accuracy: 100,
  damageClass: 'physical',
  pivot: true,
};

const mon = (
  name: string,
  o: Partial<Omit<Battler, 'stats'>> & { stats?: Partial<Battler['stats']> } = {},
): Battler => {
  const { stats, ...rest } = o;
  return {
    id: name.length * 100 + name.charCodeAt(0),
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
    moves: [tackle],
    sprite: `${name}.png`,
    ...rest,
  };
};

/** Hits first and hard, survives the foe's pokes. */
const bruiser = (name: string, o: Partial<Battler> = {}): Battler =>
  mon(name, { stats: { hp: 400, attack: 300, speed: 200 }, ...o });
/** Falls over to a single hit. */
const frail = (name: string, o: Partial<Battler> = {}): Battler =>
  mon(name, { stats: { hp: 20, defense: 1, speed: 1 }, ...o });
/** Hits first and kills a frail mon in one hit. */
const slayer = (name: string): Battler =>
  mon(name, { stats: { hp: 400, attack: 400, speed: 300, defense: 400 } });
/** Soaks up everything without dying. */
const wall = (name: string, o: Partial<Battler> = {}): Battler =>
  mon(name, { stats: { hp: 2000, defense: 1000, 'special-defense': 1000, speed: 1 }, ...o });

function setupFor(
  playerTeam: Battler[],
  foeTeam: Battler[],
  extra: Partial<PlayerMatchSetup> = {},
): PlayerMatchSetup {
  const player = makeTrainer(0, true, playerTeam);
  const foe = makeTrainer(1, false, foeTeam);
  const match: BracketMatch = {
    id: 'm-test',
    round: 'r16',
    slot: 0,
    a: player,
    b: foe,
    winner: null,
    played: false,
  };
  return { match, round: 'r16', player, foe, playerTeam, foeTeam, ...extra };
}

type Internals = {
  busy: () => boolean;
  done: () => boolean;
  awaitingSwitch: () => boolean;
  pivoting: () => boolean;
  switchOpen: () => boolean;
  teraArmed: () => boolean;
  canTera: () => boolean;
  canSwitch: () => boolean;
  struggling: () => boolean;
  foeQuip: () => string | null;
  playerWon: () => boolean;
  speed: () => number;
  log: () => { text: string; tone?: string }[];
  pHp: () => number;
  fHp: () => number;
  moveSlots: () => { pp: number; maxPp: number | null; locked: boolean }[];
  playerTray: () => { index: number; active: boolean; fainted: boolean; switchable: boolean }[];
  ruleBanner: () => string | null;
  useMove: (i: number) => Promise<void>;
  onTraySelect: (side: 0 | 1, i: number) => Promise<void>;
  toggleSwitch: () => void;
  toggleTera: () => void;
  cycleSpeed: () => void;
  continue: () => void;
  syncSide: (side: 0 | 1) => void;
};

describe('TournamentMatchComponent', () => {
  let fixture: ComponentFixture<TournamentMatchComponent>;
  let outcomes: MatchOutcome[];

  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    outcomes = [];
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: SfxService, useValue: { play: () => {} } },
        { provide: HapticsService, useValue: { fire: () => {} } },
      ],
    });
    TestBed.overrideComponent(TournamentMatchComponent, {
      remove: { imports: [BattleFxComponent] },
      add: { imports: [StubFx] },
    });
  });

  afterEach(() => {
    fixture.destroy();
    vi.useRealTimers();
  });

  function mount(setup: PlayerMatchSetup): Internals {
    fixture = TestBed.createComponent(TournamentMatchComponent);
    fixture.componentRef.setInput('setup', setup);
    fixture.componentInstance.finished.subscribe((o) => outcomes.push(o));
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

  /** Keep firing move 1 until the match is over. */
  async function fightToTheEnd(c: Internals): Promise<void> {
    let guard = 0;
    while (!c.done() && guard++ < 60) {
      press('1');
      await settle();
    }
  }

  it('opens with the intro log and both trays', () => {
    const c = mount(setupFor([bruiser('Alpha'), bruiser('Beta')], [frail('Gamma')]));
    const text = logText(c);
    expect(text[0]).toContain('wants to battle!');
    expect(text).toContain('Go, Alpha!');
    expect(text.some((t) => t.includes('sent out Gamma'))).toBe(true);
    expect(el().querySelectorAll('.tray .ball')).toHaveLength(3);
    expect(el().querySelectorAll('pv-move-button')).toHaveLength(1);
    expect(c.moveSlots()).toEqual([{ move: tackle, pp: Infinity, maxPp: null, locked: false }]);
    expect(c.canSwitch()).toBe(true);
    expect(c.canTera()).toBe(true);
  });

  it('banners the special rules of the mode', () => {
    expect(
      mount(setupFor([bruiser('A')], [frail('B')], { rules: { inverse: true } })).ruleBanner(),
    ).toContain('Inverse');
    fixture.destroy();
    expect(
      mount(
        setupFor([bruiser('A')], [frail('B')], { rules: { weatherBoostType: 'fire' } }),
      ).ruleBanner(),
    ).toContain('Fire-type moves are boosted');
    fixture.destroy();
    expect(mount(setupFor([bruiser('A')], [frail('B')])).ruleBanner()).toBeNull();
  });

  it('a number key plays the move: log, damage and the busy lock', async () => {
    const c = mount(setupFor([bruiser('Alpha')], [wall('Wallop')]));
    const foeFull = c.fHp();
    press('1');
    expect(c.busy()).toBe(true);
    press('1'); // ignored while busy
    await settle();
    expect(c.busy()).toBe(false);
    expect(logText(c)).toContain('Alpha used Tackle!');
    expect(c.fHp()).toBeLessThan(foeFull);
  });

  it('ignores modifier shortcuts and unrelated keys', async () => {
    const c = mount(setupFor([bruiser('Alpha')], [wall('Wallop')]));
    press('1', { ctrlKey: true });
    press('x');
    press('9');
    await settle();
    expect(logText(c).some((t) => t.includes('used'))).toBe(false);
  });

  it('wins a match, shows the victory card and emits the outcome with remaining HP', async () => {
    const c = mount(setupFor([bruiser('Alpha'), bruiser('Beta')], [frail('Gamma')]));
    await fightToTheEnd(c);
    expect(c.done()).toBe(true);
    expect(c.playerWon()).toBe(true);
    expect(logText(c)).toContain('Match won!');
    expect(el().querySelector('.result.win')).not.toBeNull();

    el().querySelector<HTMLButtonElement>('.continue')!.click();
    expect(outcomes).toHaveLength(1);
    expect(outcomes[0]!.playerWon).toBe(true);
    expect(outcomes[0]!.playerFinalHp).toHaveLength(2);
    expect(outcomes[0]!.playerFinalHp[0]).toBeGreaterThan(0);

    press('1'); // a finished match ignores keys
    expect(c.busy()).toBe(false);
  });

  it('loses a match and reports it', async () => {
    const c = mount(setupFor([frail('Fragile')], [slayer('Slayer')]));
    await fightToTheEnd(c);
    expect(c.done()).toBe(true);
    expect(c.playerWon()).toBe(false);
    expect(logText(c)).toContain('You were knocked out…');
    expect(el().querySelector('.result.win')).toBeNull();
    c.continue();
    expect(outcomes).toEqual([{ playerWon: false, playerFinalHp: [0] }]);
  });

  it('forces a replacement after a faint and resumes with the chosen mon', async () => {
    const c = mount(setupFor([frail('Fragile'), bruiser('Backup')], [slayer('Slayer')]));
    press('1');
    await settle();
    expect(c.awaitingSwitch()).toBe(true);
    expect(c.pivoting()).toBe(false);
    expect(c.busy()).toBe(false);
    expect(el().querySelector('.switch-prompt')!.textContent).toContain('fainted');
    expect(logText(c)).toContain('Choose your next Pokémon!');
    // Moves are locked while the tray is open: the move key is swallowed.
    expect(c.playerTray().filter((t) => t.switchable)).toHaveLength(1);
    expect(c.canTera()).toBe(false);
    press('t');
    expect(c.teraArmed()).toBe(false);

    press('2'); // out of range for one bench mon
    expect(c.awaitingSwitch()).toBe(true);

    press('1');
    await settle();
    expect(c.awaitingSwitch()).toBe(false);
    expect(c.switchOpen()).toBe(false);
    expect(c.playerTray().find((t) => t.active)!.index).toBe(1);
    expect(logText(c).some((t) => t.includes('Backup'))).toBe(true);
    expect(el().querySelector('.controls')).not.toBeNull();
  });

  it('a pivot move asks for a switch without a faint', async () => {
    const lead = bruiser('Pivoter', { moves: [uTurn] });
    const c = mount(setupFor([lead, bruiser('Next')], [wall('Wallop')]));
    press('1');
    await settle();
    expect(c.awaitingSwitch()).toBe(true);
    expect(c.pivoting()).toBe(true);
    expect(el().querySelector('.switch-prompt')!.textContent).toContain('pivoted out');
    expect(logText(c)).toContain('Choose who takes over!');

    press('1');
    await settle();
    expect(c.awaitingSwitch()).toBe(false);
    expect(c.playerTray().find((t) => t.active)!.index).toBe(1);
  });

  it('S opens the switch tray and a tray ball swaps the active Pokémon (taking a turn)', async () => {
    const c = mount(setupFor([bruiser('Alpha'), bruiser('Beta')], [wall('Wallop')]));
    press('s');
    expect(c.switchOpen()).toBe(true);
    expect(c.playerTray().filter((t) => t.switchable)).toHaveLength(1);

    const ball = el().querySelectorAll<HTMLButtonElement>('.tray .ball')[1]!;
    fixture.detectChanges();
    expect(ball.disabled).toBe(false);
    ball.click();
    await settle();
    expect(c.switchOpen()).toBe(false);
    expect(c.playerTray().find((t) => t.active)!.index).toBe(1);
    expect(logText(c).some((t) => t.includes('Beta'))).toBe(true);

    press('s'); // toggles open then closed again
    press('s');
    expect(c.switchOpen()).toBe(false);
  });

  it('does not open the tray with nobody to switch to', () => {
    const c = mount(setupFor([bruiser('Solo')], [wall('Wallop')]));
    expect(c.canSwitch()).toBe(false);
    press('s');
    expect(c.switchOpen()).toBe(false);
  });

  it('ignores tray taps on the foe, on the active mon or on fainted mons', async () => {
    const c = mount(setupFor([bruiser('Alpha'), bruiser('Beta')], [wall('Wallop')]));
    await c.onTraySelect(1, 1);
    await c.onTraySelect(0, 0); // the active one is not a switch target
    await c.onTraySelect(0, 7);
    await settle();
    expect(c.playerTray().find((t) => t.active)!.index).toBe(0);
    expect(logText(c).some((t) => t.includes('used'))).toBe(false);
  });

  it('T arms Terastallization (and again disarms) and the next move uses it once', async () => {
    const c = mount(setupFor([bruiser('Alpha', { teraType: 'ghost' })], [wall('Wallop')]));
    expect(el().querySelector('.tera-btn')!.textContent).toContain('Ghost');
    press('t');
    expect(c.teraArmed()).toBe(true);
    press('t');
    expect(c.teraArmed()).toBe(false);

    el().querySelector<HTMLButtonElement>('.tera-btn')!.click();
    expect(c.teraArmed()).toBe(true);
    press('1');
    await settle();
    expect(c.teraArmed()).toBe(false);
    expect(c.canTera()).toBe(false); // once per battle
    expect(el().querySelector('.tera-btn')).toBeNull();
    expect(logText(c).some((t) => /tera/i.test(t))).toBe(true);
  });

  it('cannot arm Tera while busy or when it is gone', async () => {
    const c = mount(setupFor([bruiser('Alpha')], [wall('Wallop')]));
    press('1');
    c.toggleTera();
    expect(c.teraArmed()).toBe(false);
    c.toggleSwitch(); // busy → ignored
    expect(c.switchOpen()).toBe(false);
    await settle();
  });

  it('shows Struggle when every move is out of PP', async () => {
    const lastResort: BattleMove = { ...tackle, pp: 1 };
    const c = mount(setupFor([bruiser('Alpha', { moves: [lastResort] })], [wall('Wallop')]));
    expect(c.moveSlots()[0]).toMatchObject({ pp: 1, maxPp: 1 });
    press('1');
    await settle();
    expect(c.struggling()).toBe(true);
    const btn = el().querySelector<HTMLButtonElement>('.struggle')!;
    expect(btn).not.toBeNull();
    btn.click();
    await settle();
    expect(logText(c).filter((t) => t.includes('used')).length).toBeGreaterThanOrEqual(2);
  });

  it('keys for a depleted move do nothing', async () => {
    const twoMoves = bruiser('Alpha', {
      moves: [
        { ...tackle, pp: 1 },
        { ...tackle, name: 'Slam' },
      ],
    });
    const c = mount(setupFor([twoMoves], [wall('Wallop')]));
    press('1');
    await settle();
    press('1'); // out of PP
    await settle();
    expect(logText(c).filter((t) => t === 'Alpha used Tackle!')).toHaveLength(1);
    press('2');
    await settle();
    expect(logText(c)).toContain('Alpha used Slam!');
  });

  it('cycles the playback speed and remembers it', () => {
    const c = mount(setupFor([bruiser('Alpha')], [wall('Wallop')]));
    expect(c.speed()).toBe(1);
    el().querySelector<HTMLButtonElement>('.speed-chip')!.click();
    expect(c.speed()).toBe(2);
    c.cycleSpeed();
    c.cycleSpeed();
    expect(c.speed()).toBe(1);
    c.cycleSpeed();
    expect(localStorage.getItem('pv:battle:speed')).toContain('2');
  });

  it('the foe ace taunts when it takes the field, then the banner clears', async () => {
    const c = mount(
      setupFor([bruiser('Alpha')], [frail('Opener'), frail('Ace')], { foeAce: 'Behold my ace!' }),
    );
    expect(c.foeQuip()).toBeNull();
    press('1');
    await vi.advanceTimersByTimeAsync(2500);
    fixture.detectChanges();
    expect(c.foeQuip()).toBe('Behold my ace!');
    expect(el().querySelector('.ace-quip')!.textContent).toContain('Behold my ace!');
    expect(logText(c)).toContain('Behold my ace!');
    await vi.advanceTimersByTimeAsync(3500);
    expect(c.foeQuip()).toBeNull();
  });

  it('shows the quip immediately for a lone ace only when the foe has a party', () => {
    const c = mount(setupFor([bruiser('Alpha')], [frail('Solo')], { foeAce: 'Hmph.' }));
    expect(c.foeQuip()).toBeNull();
  });

  it('resyncs a side mid-animation from the engine', () => {
    const c = mount(setupFor([bruiser('Alpha')], [wall('Wallop')]));
    c.syncSide(0);
    c.syncSide(1);
    expect(c.pHp()).toBeGreaterThan(0);
  });
});
