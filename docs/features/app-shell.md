# App Shell

The application frame: global providers, routing, theme and navigation that wrap
every feature.

## What it does

- Boots Angular 22 in **zoneless** mode with signals.
- Configures routing with **hash location** (GitHub Pages deep links),
  **component input binding** (route params → component inputs) and in-memory
  scroll restoration.
- Renders the persistent **navigation shell** (brand, nav, burger menu, footer)
  with a `router-outlet` for lazy feature routes.

## Files

| File | Responsibility |
| ---- | -------------- |
| `app/app.config.ts` | Providers: `provideZonelessChangeDetection()`, `provideHttpClient(withFetch())`, router with `withHashLocation()`, `withComponentInputBinding()`, `withInMemoryScrolling()`. |
| `app/app.routes.ts` | Lazy `loadComponent` routes for every module; `ComingSoon` placeholders for not-yet-built modules; `**` redirect. |
| `app/app.ts` / `.html` / `.scss` | Shell component: brand orb, 7-item nav, burger dropdown, footer. |
| `src/styles/theme.scss` | Design tokens, 18 official type colors (`--type-*`), `.glass` / `.btn` / `.gradient-text` / `.container` utilities. |
| `src/styles/_responsive.scss` | Mobile-first breakpoint mixins (`up(sm/md/lg/xl)`). |
| `src/styles.scss` | Global reset, body background, scrollbars, `prefers-reduced-motion`, focus-visible. |

## Key decisions

- **Hash routing** is intentional: GitHub Pages serves static files, so deep
  links like `/#/pokemon/6` resolve without server rewrites.
- **Lazy routes** keep the initial bundle small; heavy deps (Three.js, PixiJS)
  load only on the routes that use them.
- **ComingSoon** placeholder lets the full navigation exist from day one while
  modules are built incrementally; each route is swapped to a real component as
  it ships.
- **Mobile-first nav.** The burger dropdown is the baseline; the inline nav row
  only appears at `lg`. The mobile menu uses an opaque background so content
  never bleeds through.

## Theme

A cyber / glassmorphism aesthetic: dark gradient background, neon accents,
frosted `.glass` panels. The 18 type colors are exposed as CSS variables so any
component can tint by type via `typeColorVar(type)`.
