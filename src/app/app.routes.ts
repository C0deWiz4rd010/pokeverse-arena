import { Routes } from '@angular/router';

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
    path: 'pokemon/:id',
    title: 'Pokémon · PokéVerse Arena',
    loadComponent: () =>
      import('./features/pokemon-detail/pokemon-detail').then((m) => m.PokemonDetailComponent),
  },
  {
    path: 'type-lab',
    title: 'Type Lab · PokéVerse Arena',
    loadComponent: () => import('./features/type-lab/type-lab').then((m) => m.TypeLabComponent),
  },
  {
    path: 'team-builder',
    title: 'Team Builder · PokéVerse Arena',
    loadComponent: () =>
      import('./features/team-builder/team-builder').then((m) => m.TeamBuilderComponent),
  },
  {
    path: 'battle',
    title: 'Battle · PokéVerse Arena',
    loadComponent: () => import('./features/battle/battle').then((m) => m.BattleComponent),
  },
  {
    path: 'arena',
    title: 'Arena · PokéVerse Arena',
    loadComponent: () => import('./features/arena/arena').then((m) => m.ArenaComponent),
  },
  {
    path: 'tournaments',
    title: 'Tournaments · PokéVerse Arena',
    loadComponent: () =>
      import('./features/tournaments/tournaments').then((m) => m.TournamentsComponent),
  },
  {
    path: 'world',
    title: 'World Explorer · PokéVerse Arena',
    loadComponent: () => import('./features/world/world').then((m) => m.WorldComponent),
  },
  { path: '**', redirectTo: '' },
];
