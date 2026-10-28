import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_IDENTITY, type ProfileState } from '../../core/models/profile';
import { dailyFusionPair } from '../../game/fusion/fusion';
import { dailySeed } from '../../core/utils/rng';
import { DailyService } from '../battle/daily.service';
import { ProfileService } from '../profile/profile.service';
import { HomeComponent } from './home';

const EMPTY_STATE: ProfileState = {
  badges: 0,
  totalBadges: 18,
  arenaChampion: false,
  bestDepth: 0,
  spireClears: 0,
  ascension: 0,
  tournamentWins: 0,
  tournamentRuns: 0,
  coins: 0,
  adventureBadges: 0,
  adventureCaught: 0,
  worldCaught: 0,
  shinyCaught: 0,
  contestRibbons: 0,
  rivalWins: 0,
  rivalLosses: 0,
  pickemHits: 0,
  dailyStreak: 0,
  dailyBest: 0,
  odysseyBestWave: 0,
  odysseyUnlocked: 0,
  fusionsRegistered: 0,
  nuzlockeBadges: 0,
  chimeraWins: 0,
};

describe('HomeComponent', () => {
  let fixture: ComponentFixture<HomeComponent>;
  let state: ReturnType<typeof signal<ProfileState>>;
  let unlocked: ReturnType<typeof signal<number>>;
  let refresh: ReturnType<typeof vi.fn>;
  let daily: {
    wonToday: ReturnType<typeof signal<boolean>>;
    playedToday: ReturnType<typeof signal<boolean>>;
    streak: ReturnType<typeof signal<number>>;
    best: ReturnType<typeof signal<number>>;
    matchup: { playerId: number; opponentId: number };
  };

  const root = () => fixture.nativeElement as HTMLElement;
  const text = () => root().textContent ?? '';
  const nextStep = () => root().querySelector<HTMLAnchorElement>('.next-step')!;
  const flush = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  async function mount(): Promise<void> {
    fixture = TestBed.createComponent(HomeComponent);
    await flush();
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
    // A narrow, non-desktop viewport keeps the lazy three.js hero out of the test.
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({ matches: false, addEventListener() {}, removeEventListener() {} }),
    );
    state = signal({ ...EMPTY_STATE });
    unlocked = signal(0);
    refresh = vi.fn();
    daily = {
      wonToday: signal(false),
      playedToday: signal(false),
      streak: signal(2),
      best: signal(5),
      matchup: { playerId: 25, opponentId: 150 },
    };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: ProfileService,
          useValue: {
            state,
            unlocked,
            totalAchievements: 10,
            rank: signal('Adept'),
            identity: signal(DEFAULT_IDENTITY),
            refresh,
          },
        },
        { provide: DailyService, useValue: daily },
      ],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('refreshes progress and renders the trainer dashboard chips', async () => {
    state.set({ ...EMPTY_STATE, badges: 4, tournamentWins: 3, bestDepth: 7, coins: 120 });
    unlocked.set(6);
    await mount();
    expect(refresh).toHaveBeenCalled();
    expect(text()).toContain('Adept Trainer');
    const chips = [...root().querySelectorAll('.dash-chip')].map((c) =>
      c.textContent!.replace(/\s+/g, ' ').trim(),
    );
    expect(chips).toEqual([
      expect.stringContaining('4/18'),
      expect.stringContaining('Daily streak'),
      expect.stringContaining('3'),
      expect.stringContaining('7'),
      expect.stringContaining('6'),
      expect.stringContaining('120'),
    ]);
    // The hero orb stays unloaded below the desktop breakpoint.
    expect(root().querySelector('.hero-visual')!.classList.contains('ready')).toBe(false);
  });

  describe('next step suggestion', () => {
    const cases: [string, Partial<ProfileState>, number, string, string][] = [
      ['gym badges first', {}, 0, '/arena', 'Earn your next gym badge'],
      [
        'the champion once all badges are won',
        { badges: 18 },
        0,
        '/arena',
        'Face the Champion Gauntlet',
      ],
      [
        'the spire',
        { badges: 18, arenaChampion: true },
        0,
        '/spire',
        'Conquer the Ascension Spire',
      ],
      [
        'a first cup',
        { badges: 18, arenaChampion: true, spireClears: 1 },
        0,
        '/tournaments',
        'Win your first cup',
      ],
      [
        'a first fusion',
        { badges: 18, arenaChampion: true, spireClears: 1, tournamentWins: 1 },
        0,
        '/fusion',
        'Splice your first fusion',
      ],
      [
        'remaining achievements',
        {
          badges: 18,
          arenaChampion: true,
          spireClears: 1,
          tournamentWins: 1,
          fusionsRegistered: 1,
        },
        3,
        '/profile',
        'Chase your next achievement',
      ],
      [
        'the living dex when everything is done',
        {
          badges: 18,
          arenaChampion: true,
          spireClears: 1,
          tournamentWins: 1,
          fusionsRegistered: 1,
        },
        10,
        '/world',
        'Fill your living dex',
      ],
    ];

    it.each(cases)('suggests %s', async (_name, patch, unlockedCount, path, label) => {
      state.set({ ...EMPTY_STATE, ...patch });
      unlocked.set(unlockedCount);
      await mount();
      expect(nextStep().getAttribute('href')).toBe(path);
      expect(nextStep().textContent).toContain(label);
    });
  });

  it('shows the daily challenge in its three states with streak numbers', async () => {
    await mount();
    const card = () => root().querySelector('.daily-card')!;
    expect(card().textContent).toContain('One counted attempt');
    expect(card().textContent).toContain('2 streak');
    expect(card().textContent).toContain('best 5');
    expect(card().getAttribute('href')).toContain('daily=1');
    expect(card().querySelectorAll('img')).toHaveLength(2);
    expect(card().querySelector<HTMLImageElement>('img')!.src).toContain('/pokemon/25.png');

    daily.playedToday.set(true);
    await flush();
    expect(card().textContent).toContain('Attempt spent');

    daily.wonToday.set(true);
    await flush();
    expect(card().textContent).toContain('Cleared');
  });

  it("who's-that: the first tap reveals, the second opens the detail page", async () => {
    await mount();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const card = root().querySelector<HTMLButtonElement>('.who-card')!;
    expect(card.classList.contains('revealed')).toBe(false);
    expect(card.textContent).toContain('Daily silhouette');

    card.click();
    await flush();
    expect(card.classList.contains('revealed')).toBe(true);
    expect(card.textContent).toContain('Revealed');
    expect(navigate).not.toHaveBeenCalled();

    card.click();
    expect(navigate).toHaveBeenCalledTimes(1);
    const [commands] = navigate.mock.calls[0]!;
    expect((commands as unknown[])[0]).toBe('/pokemon');
    expect((commands as number[])[1]).toBeGreaterThanOrEqual(1);
    expect((commands as number[])[1]).toBeLessThanOrEqual(1025);
  });

  it("links the lab special to today's seeded fusion pair", async () => {
    await mount();
    const pair = dailyFusionPair(dailySeed('fusion'));
    const href = root().querySelector('.lab-card')!.getAttribute('href')!;
    expect(href).toContain('/fusion');
    expect(href).toContain(`head=${pair.head}`);
    expect(href).toContain(`body=${pair.body}`);
    expect(root().querySelector('.showdown-card')!.getAttribute('href')).toBe('/showdown');
    expect(root().querySelectorAll('.showdown-card img')).toHaveLength(2);
  });

  it('lists every feature card with a link, and tilts the hovered card', async () => {
    await mount();
    const cards = [...root().querySelectorAll<HTMLAnchorElement>('a.feature')];
    expect(cards.length).toBeGreaterThanOrEqual(14);
    const paths = cards.map((c) => c.getAttribute('href'));
    expect(paths).toContain('/pokedex');
    expect(paths).toContain('/showdown');
    expect(new Set(paths).size).toBe(paths.length);

    const card = cards[0]!;
    vi.spyOn(card, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 200,
      height: 100,
    } as DOMRect);
    const move = new Event('pointermove') as Event & { clientX: number; clientY: number };
    move.clientX = 100;
    move.clientY = 25;
    card.dispatchEvent(move);
    expect(card.style.getPropertyValue('--mx')).toBe('50%');
    expect(card.style.getPropertyValue('--my')).toBe('25%');
    expect(card.style.getPropertyValue('--rx')).toBe('2deg');
    expect(card.style.getPropertyValue('--ry')).toBe('0deg');

    card.dispatchEvent(new Event('pointerleave'));
    expect(card.style.getPropertyValue('--rx')).toBe('0deg');
  });
});
