import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

interface NavItem {
  path: string;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly menuOpen = signal(false);

  protected readonly nav: NavItem[] = [
    { path: '/pokedex', label: 'Pokédex', icon: '📕' },
    { path: '/type-lab', label: 'Type Lab', icon: '🧪' },
    { path: '/team-builder', label: 'Team Builder', icon: '🛠️' },
    { path: '/battle', label: 'Battle', icon: '⚔️' },
    { path: '/arena', label: 'Arena', icon: '🏟️' },
    { path: '/tournaments', label: 'Tournaments', icon: '🏆' },
    { path: '/world', label: 'World', icon: '🗺️' },
  ];

  protected toggleMenu(): void {
    this.menuOpen.update((v) => !v);
  }

  protected closeMenu(): void {
    this.menuOpen.set(false);
  }
}
