import { describe, expect, it } from 'vitest';
import { routes } from './app.routes';

describe('route table', () => {
  const pages = routes.filter((r) => r.loadComponent);

  it('has the expected set of pages', () => {
    expect(pages.map((r) => r.path)).toEqual([
      '',
      'pokedex',
      'showcase',
      'pokemon/:id',
      'type-lab',
      'team-builder',
      'battle',
      'arena',
      'tournaments',
      'spire',
      'world',
      'odyssey',
      'fusion',
      'contest',
      'showdown',
      'profile',
      'adventure',
    ]);
  });

  it('gives every page a non-empty, unique title branded for the app', () => {
    const titles = pages.map((r) => r.title as string);
    for (const t of titles) {
      expect(typeof t).toBe('string');
      expect(t.trim()).not.toBe('');
      expect(t).toContain('PokéVerse Arena');
    }
    expect(new Set(titles).size).toBe(titles.length);
  });

  it('matches the home page only on the exact empty path', () => {
    const home = routes[0]!;
    expect(home.path).toBe('');
    expect(home.pathMatch).toBe('full');
  });

  it('flags only the hot routes for idle preloading', () => {
    const preloaded = routes.filter((r) => r.data?.['preload']).map((r) => r.path);
    expect(preloaded).toEqual(['pokedex', 'pokemon/:id', 'battle']);
  });

  it('redirects unknown URLs to the home page', () => {
    const wildcard = routes[routes.length - 1]!;
    expect(wildcard.path).toBe('**');
    expect(wildcard.redirectTo).toBe('');
  });

  it('keeps the wildcard last so it cannot shadow a page', () => {
    expect(routes.findIndex((r) => r.path === '**')).toBe(routes.length - 1);
  });

  it.each(pages.map((r) => [r.path ?? '(home)', r] as const))(
    'lazy-loads a component class for "%s"',
    async (_path, route) => {
      const loaded = await (route.loadComponent as () => Promise<unknown>)();
      expect(typeof loaded).toBe('function');
      expect((loaded as { name: string }).name).toMatch(/Component$/);
    },
    30_000,
  );
});
