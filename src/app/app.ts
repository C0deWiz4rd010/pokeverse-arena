import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { APP_VERSION } from './core/version';
import { IconComponent } from './core/ui/icon/icon';
import type { IconName } from './core/ui/icon/icons.data';

interface NavItem {
  path: string;
  label: string;
  icon: IconName;
}

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, IconComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly menuOpen = signal(false);
  protected readonly version = APP_VERSION;

  protected readonly nav: NavItem[] = [
    { path: '/pokedex', label: 'Pokédex', icon: 'book' },
    { path: '/type-lab', label: 'Type Lab', icon: 'flask-conical' },
    { path: '/team-builder', label: 'Team Builder', icon: 'wrench' },
    { path: '/battle', label: 'Battle', icon: 'swords' },
    { path: '/arena', label: 'Arena', icon: 'castle' },
    { path: '/tournaments', label: 'Tournaments', icon: 'trophy' },
    { path: '/world', label: 'World', icon: 'map' },
    { path: '/contest', label: 'Contest', icon: 'sparkles' },
  ];

  protected toggleMenu(): void {
    this.menuOpen.update((v) => !v);
  }

  protected closeMenu(): void {
    this.menuOpen.set(false);
  }
}
