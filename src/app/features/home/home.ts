import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { IconComponent } from '../../core/ui/icon/icon';
import { ProfileService } from '../profile/profile.service';
import { DailyService } from '../battle/daily.service';
import { dailyFusionPair } from '../../game/fusion/fusion';
import { SeededRng, dailySeed } from '../../core/utils/rng';
import { SPRITE_BASE } from '../../core/api/pokeapi-endpoints';
import type { IconName } from '../../core/ui/icon/icons.data';

interface FeatureCard {
  path: string;
  icon: IconName;
  title: string;
  text: string;
  accent: string;
}

interface StatChip {
  icon: IconName;
  label: string;
  value: string;
}

const REDUCED_MOTION =
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

@Component({
  selector: 'pv-home',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IconComponent],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class HomeComponent implements OnDestroy {
  private readonly profile = inject(ProfileService);
  protected readonly daily = inject(DailyService);
  private readonly router = inject(Router);

  /** Today's seeded Fusion Lab pair — same for every trainer. */
  protected readonly special = dailyFusionPair(dailySeed('fusion'));

  /** Daily "Who's that Pokémon?" silhouette — first tap reveals, second opens. */
  protected readonly who = new SeededRng(dailySeed('whos-that')).int(1, 1025);
  protected readonly whoRevealed = signal(false);

  protected onWho(): void {
    if (!this.whoRevealed()) this.whoRevealed.set(true);
    else void this.router.navigate(['/pokemon', this.who]);
  }

  protected sprite(id: number): string {
    return `${SPRITE_BASE}/pokemon/${id}.png`;
  }

  private readonly heroCanvas = viewChild<ElementRef<HTMLCanvasElement>>('hero');
  protected readonly heroReady = signal(false);
  private dispose: (() => void) | null = null;

  protected readonly features: FeatureCard[] = [
    { path: '/pokedex', icon: 'book', title: 'Interactive Pokédex', text: 'Type-themed cards, quick-view, shiny mode, compare tray & a living dex to fill.', accent: 'var(--accent)' },
    { path: '/type-lab', icon: 'flask-conical', title: 'Type Lab', text: 'A pinnable chart, calculator and a full team-coverage analyzer.', accent: 'var(--type-psychic)' },
    { path: '/team-builder', icon: 'wrench', title: 'Team Builder', text: 'Build six, tune natures & moves, and read coverage, speed tiers and ratings.', accent: 'var(--type-fighting)' },
    { path: '/battle', icon: 'swords', title: 'Battle Engine', text: 'Deterministic turns with status, weather, abilities, items — and a PixiJS arena.', accent: 'var(--type-fire)' },
    { path: '/arena', icon: 'castle', title: 'Arena', text: 'Climb a designed gym ladder, then face the Champion Gauntlet for badges.', accent: 'var(--type-rock)' },
    { path: '/tournaments', icon: 'trophy', title: 'Tournaments', text: 'Single-elim, round-robin & Swiss formats with seeding, standings and prizes.', accent: 'var(--accent-3)' },
    { path: '/spire', icon: 'mountain', title: 'Ascension Spire', text: 'A seeded roguelike climb — relics, shops, bosses and meta-progression.', accent: 'var(--type-dragon)' },
    { path: '/odyssey', icon: 'map-pin', title: 'Odyssey', text: 'An endless biome march — daze-catch every foe and grow your starter roster forever.', accent: 'var(--type-water)' },
    { path: '/world', icon: 'map', title: 'World Explorer', text: 'Roam regions, fill a per-region dex through animated catch expeditions.', accent: 'var(--type-grass)' },
    { path: '/fusion', icon: 'flask-conical', title: 'Fusion Lab', text: 'Splice any two Pokémon into a new species — name, typing, stats & palette.', accent: 'var(--type-poison)' },
    { path: '/contest', icon: 'sparkles', title: 'Contest Hall', text: 'A live appeal mini-game with combos, jamming, ranks and ribbons.', accent: 'var(--type-fairy)' },
    { path: '/adventure', icon: 'scroll-text', title: 'Adventure (RPG)', text: 'A classic tile-world story: pick a starter, catch in the grass, earn a badge.', accent: 'var(--type-ground)' },
    { path: '/profile', icon: 'crown', title: 'Trainer Profile', text: 'Your rank, records and achievements across every mode, in one place.', accent: 'var(--accent-2)' },
  ];

  /** A progress-aware "what next?" suggestion for the hero CTA row. */
  protected readonly nextStep = computed<{ label: string; path: string; icon: IconName }>(() => {
    const s = this.profile.state();
    if (s.badges < s.totalBadges) return { label: 'Earn your next gym badge', path: '/arena', icon: 'castle' };
    if (!s.arenaChampion) return { label: 'Face the Champion Gauntlet', path: '/arena', icon: 'crown' };
    if (s.spireClears < 1) return { label: 'Conquer the Ascension Spire', path: '/spire', icon: 'mountain' };
    if (s.tournamentWins < 1) return { label: 'Win your first cup', path: '/tournaments', icon: 'trophy' };
    if (s.fusionsRegistered < 1) return { label: 'Splice your first fusion', path: '/fusion', icon: 'flask-conical' };
    if (this.profile.unlocked() < this.profile.totalAchievements) return { label: 'Chase your next achievement', path: '/profile', icon: 'star' };
    return { label: 'Fill your living dex', path: '/world', icon: 'map' };
  });

  /** A compact "trainer dashboard" of live progress drawn from every system. */
  protected readonly stats = computed<StatChip[]>(() => {
    const s = this.profile.state();
    return [
      { icon: 'shield', label: 'Badges', value: `${s.badges}/${s.totalBadges}` },
      { icon: 'flame', label: 'Daily streak', value: `${s.dailyStreak}` },
      { icon: 'trophy', label: 'Cups', value: `${s.tournamentWins}` },
      { icon: 'mountain', label: 'Best depth', value: `${s.bestDepth}` },
      { icon: 'star', label: 'Achievements', value: `${this.profile.unlocked()}` },
      { icon: 'gem', label: 'Coins', value: `${s.coins}` },
    ];
  });
  protected readonly rank = this.profile.rank;

  constructor() {
    this.profile.refresh();
    afterNextRender(() => {
      const canvas = this.heroCanvas()?.nativeElement;
      // The orb is display:none below lg — skip the WebGL scene entirely there.
      const desktop = typeof matchMedia === 'undefined' || matchMedia('(min-width: 1024px)').matches;
      if (REDUCED_MOTION || !desktop || !canvas) return;
      void this.initHero(canvas);
    });
  }

  /** Cursor-driven sheen + tilt on a feature card (skipped for reduced motion). */
  protected onCardMove(event: PointerEvent): void {
    if (REDUCED_MOTION) return;
    const el = event.currentTarget as HTMLElement;
    const r = el.getBoundingClientRect();
    const px = (event.clientX - r.left) / r.width;
    const py = (event.clientY - r.top) / r.height;
    el.style.setProperty('--mx', `${px * 100}%`);
    el.style.setProperty('--my', `${py * 100}%`);
    el.style.setProperty('--rx', `${(0.5 - py) * 8}deg`);
    el.style.setProperty('--ry', `${(px - 0.5) * 8}deg`);
  }

  protected onCardLeave(event: PointerEvent): void {
    const el = event.currentTarget as HTMLElement;
    el.style.setProperty('--rx', '0deg');
    el.style.setProperty('--ry', '0deg');
  }

  private async initHero(canvas: HTMLCanvasElement): Promise<void> {
    try {
      const { createHeroScene } = await import('./hero-scene');
      this.dispose = createHeroScene(canvas);
      this.heroReady.set(true);
    } catch {
      this.heroReady.set(false);
    }
  }

  ngOnDestroy(): void {
    this.dispose?.();
  }
}
