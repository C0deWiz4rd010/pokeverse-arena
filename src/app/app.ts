import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { APP_VERSION } from './core/version';
import { ThemeService } from './core/theme/theme.service';
import { IconComponent } from './core/ui/icon/icon';
import type { IconName } from './core/ui/icon/icons.data';
import { ToastsComponent } from './core/ui/toast/toasts';
import { BottomNavComponent } from './core/ui/bottom-nav/bottom-nav';
import { InstallPromptComponent } from './core/ui/install-prompt/install-prompt';
import { CommandPaletteComponent } from './features/command-palette/command-palette';
import { AchievementWatcherService } from './features/profile/achievement-watcher.service';

interface NavItem {
  path: string;
  label: string;
  icon: IconName;
}

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, IconComponent, ToastsComponent, BottomNavComponent, InstallPromptComponent, CommandPaletteComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  host: {
    '(document:keydown)': 'onGlobalKey($event)',
    '(window:scroll)': 'onScroll()',
  },
})
export class App {
  /** Instantiated here so the persisted accent palette applies at startup. */
  private readonly theme = inject(ThemeService);
  private readonly achievements = inject(AchievementWatcherService);

  protected readonly menuOpen = signal(false);
  protected readonly paletteOpen = signal(false);
  protected readonly scrolled = signal(false);
  protected readonly showToTop = signal(false);
  protected readonly version = APP_VERSION;

  protected readonly nav: NavItem[] = [
    { path: '/pokedex', label: 'Pokédex', icon: 'book' },
    { path: '/type-lab', label: 'Type Lab', icon: 'flask-conical' },
    { path: '/team-builder', label: 'Team Builder', icon: 'wrench' },
    { path: '/battle', label: 'Battle', icon: 'swords' },
    { path: '/arena', label: 'Arena', icon: 'castle' },
    { path: '/tournaments', label: 'Tournaments', icon: 'trophy' },
    { path: '/spire', label: 'Spire', icon: 'mountain' },
    { path: '/odyssey', label: 'Odyssey', icon: 'map-pin' },
    { path: '/world', label: 'World', icon: 'map' },
    { path: '/fusion', label: 'Fusion', icon: 'flask-conical' },
    { path: '/contest', label: 'Contest', icon: 'sparkles' },
    { path: '/showdown', label: 'Showdown', icon: 'dices' },
    { path: '/adventure', label: 'Adventure', icon: 'scroll-text' },
    { path: '/profile', label: 'Profile', icon: 'crown' },
  ];

  constructor() {
    this.achievements.start();
  }

  /** ⌘K / Ctrl+K opens the command palette from anywhere. */
  protected onGlobalKey(event: KeyboardEvent): void {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      this.paletteOpen.update((v) => !v);
      this.menuOpen.set(false);
    }
  }

  protected onScroll(): void {
    this.scrolled.set(window.scrollY > 8);
    this.showToTop.set(window.scrollY > 900);
  }

  protected scrollTop(): void {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
  }

  protected openPalette(): void {
    this.paletteOpen.set(true);
    this.menuOpen.set(false);
  }

  protected toggleMenu(): void {
    this.menuOpen.update((v) => !v);
  }

  protected closeMenu(): void {
    this.menuOpen.set(false);
  }
}
