import { Routes } from '@angular/router';
import { ComingSoonComponent } from './core/ui/coming-soon/coming-soon';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: 'PokéVerse Arena',
    loadComponent: () => import('./features/home/home').then((m) => m.HomeComponent),
  },
  {
    path: 'pokedex',
    title: 'Pokédex · PokéVerse Arena',
    loadComponent: () => import('./features/pokedex/pokedex').then((m) => m.PokedexComponent),
  },
  {
    path: 'type-lab',
    title: 'Type Lab · PokéVerse Arena',
    component: ComingSoonComponent,
    data: { title: 'Type Lab', icon: '🧪', description: 'Type matchup tools are on the way.' },
  },
  {
    path: 'team-builder',
    title: 'Team Builder · PokéVerse Arena',
    component: ComingSoonComponent,
    data: { title: 'Team Builder', icon: '🛠️', description: 'Build and validate teams of six soon.' },
  },
  {
    path: 'battle',
    title: 'Battle · PokéVerse Arena',
    component: ComingSoonComponent,
    data: { title: 'Battle', icon: '⚔️', description: 'The seeded battle engine is powering up.' },
  },
  {
    path: 'arena',
    title: 'Arena · PokéVerse Arena',
    component: ComingSoonComponent,
    data: { title: 'Arena', icon: '🏟️', description: 'Challenge type-themed gym leaders and earn badges.' },
  },
  {
    path: 'tournaments',
    title: 'Tournaments · PokéVerse Arena',
    component: ComingSoonComponent,
    data: { title: 'Tournaments', icon: '🏆', description: 'Single-elimination brackets you can auto-simulate or play.' },
  },
  {
    path: 'world',
    title: 'World Explorer · PokéVerse Arena',
    component: ComingSoonComponent,
    data: { title: 'World Explorer', icon: '🗺️', description: 'Find where each Pokémon lives across every region.' },
  },
  { path: '**', redirectTo: '' },
];
