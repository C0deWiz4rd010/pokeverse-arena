import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  afterNextRender,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';

interface FeatureCard {
  path: string;
  icon: string;
  title: string;
  text: string;
}

@Component({
  selector: 'pv-home',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class HomeComponent implements OnDestroy {
  private readonly heroCanvas = viewChild<ElementRef<HTMLCanvasElement>>('hero');
  protected readonly heroReady = signal(false);
  private dispose: (() => void) | null = null;

  protected readonly features: FeatureCard[] = [
    { path: '/pokedex', icon: '📕', title: 'Interactive Pokédex', text: 'Search, filter, compare. Stats, moves, abilities & full evolution trees.' },
    { path: '/type-lab', icon: '🧪', title: 'Type Lab', text: 'Interactive type chart and a team weakness analyzer.' },
    { path: '/team-builder', icon: '🛠️', title: 'Team Builder', text: 'Craft teams of six with natures, abilities and legal moves.' },
    { path: '/battle', icon: '⚔️', title: 'Battle Engine', text: 'Deterministic, seeded turn-based battles with a PixiJS arena.' },
    { path: '/arena', icon: '🏟️', title: 'Arena', text: 'Take on type-themed gym leaders and earn badges.' },
    { path: '/tournaments', icon: '🏆', title: 'Tournaments', text: 'Single-elimination brackets — auto-sim or play it out.' },
  ];

  constructor() {
    // Only attempt the heavy 3D hero in the browser, after first render, and
    // never when the user prefers reduced motion.
    afterNextRender(() => {
      const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
      const canvas = this.heroCanvas()?.nativeElement;
      if (reduced || !canvas) return;
      void this.initHero(canvas);
    });
  }

  private async initHero(canvas: HTMLCanvasElement): Promise<void> {
    try {
      const { createHeroScene } = await import('./hero-scene');
      this.dispose = createHeroScene(canvas);
      this.heroReady.set(true);
    } catch {
      // WebGL unavailable — the static fallback poster stays visible.
      this.heroReady.set(false);
    }
  }

  ngOnDestroy(): void {
    this.dispose?.();
  }
}
