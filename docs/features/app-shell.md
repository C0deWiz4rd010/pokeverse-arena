# App Shell

The application frame: global providers, routing, theme and navigation that wrap every feature.

## What it does

- Boots Angular 22 **zoneless** with signals; every component is standalone and `OnPush`.
- Configures routing with **hash location** (GitHub Pages deep links), **component input binding**, in-memory scroll
  restoration with anchor scrolling, **view transitions** (the initial navigation is skipped) and idle **preloading**.
- Renders the persistent chrome: aurora background, skip link, top bar (brand, language toggle, search pill, burger, main
  nav), the routed `<main>`, footer with the version, a back-to-top button, the toast stack, the bottom nav and the install
  prompt.
- Hosts the **command palette** trigger (search pill and a global `Ctrl+K` / `Cmd+K` listener); the palette itself is
  deferred until idle. See [command-palette.md](command-palette.md).
- Offers a one-tap **English/German switch** (see [../i18n.md](../i18n.md)); the German bundle is loaded before first paint
  for German visitors.
- Applies the persisted **accent theme** at startup through `ThemeService`.
- Renders the global **toast stack** (`pv-toasts`, with a text-only live region) and starts the **achievement watcher** so
  unlocks anywhere are celebrated, see [profile.md](profile.md).
- Shows an **install prompt** (Chromium `beforeinstallprompt`, or a manual hint on iOS) and recovers from stale lazy chunks
  after a deploy.

## Files

| Path | Responsibility |
| ---- | -------------- |
| `src/main.ts` | Bootstraps `App`; shows a plain "could not start" alert if bootstrap fails; registers `sw.js` outside local dev hosts. |
| `src/app/app.config.ts` | Providers: global error listeners, `TranslatedTitleStrategy`, an app initializer awaiting `I18nService.ready()`, zoneless change detection, `provideHttpClient(withFetch())`, and the router features below. |
| `src/app/app.routes.ts` | Lazy `loadComponent` routes for every page, `data: { preload: true }` on three of them, `**` redirects home. |
| `src/app/app.ts`, `app.html`, `app.scss` | Shell component: navigation (14 items), burger, language and search buttons, scroll state, footer, global key handler. |
| `src/app/core/theme/theme.service.ts` | Five accent palettes; applies the chosen one by overriding `--accent*` on `<html>`. |
| `src/app/core/ui/bottom-nav/bottom-nav.ts` | Phone tab bar plus a "More" bottom sheet listing every route. |
| `src/app/core/ui/install-prompt/install-prompt.ts` | Add-to-home-screen banner. |
| `src/app/core/ui/toast/toast.service.ts`, `toasts.ts` | Global toast queue and its renderer. |
| `src/app/core/update/chunk-error.ts`, `idle-preload.ts` | Reload-once handler for failed chunk imports; `IdlePreloadStrategy`. |
| `src/app/core/i18n/translated-title.strategy.ts` | Translated, language-reactive document titles. |
| `src/app/core/version.ts` | `APP_VERSION` shown in the footer. |
| `src/styles/theme.scss`, `src/styles/_responsive.scss`, `src/styles.scss` | Design tokens, utilities (`.glass`, `.btn`, `.sr-only`), breakpoint mixins, global reset, focus ring and reduced-motion rules. |

## How it works

- **Router features** in `app.config.ts`: `withComponentInputBinding()`, `withHashLocation()`, `withInMemoryScrolling`,
  `withViewTransitions({ skipInitialTransition: true })`, `withNavigationErrorHandler(chunkAwareNavigationErrorHandler)` and
  `withPreloading(IdlePreloadStrategy)`. Only `pokedex`, `pokemon/:id` and `battle` are flagged for preload; the strategy
  waits 2.5 s and skips Data Saver and 2g connections.
- **Routes.** Seventeen titled routes (home, Pokédex, showcase, detail, Type Lab, Team Builder, Battle, Arena, Tournaments,
  Spire, World, Odyssey, Fusion, Contest, Showdown, Profile, Adventure) plus the wildcard. Titles go through
  `TranslatedTitleStrategy`, which re-translates on a language switch. Heavy dependencies (Three.js, PixiJS) load only with
  the routes that use them.
- **Navigation.** One `nav` array drives both the header links and the bottom-nav sheet. The bottom bar shows Home, Dex,
  a raised Battle button, Quest and "More" (a dialog sheet with every destination). It exists below `md` only; there the
  burger is hidden. From `md` to `lg` the burger dropdown is the nav; from `lg` the nav is an inline row where inactive
  items collapse to icons with labels kept for screen readers.
- **Global keys and scroll.** The shell listens on `document:keydown` for `Ctrl+K` / `Cmd+K` (toggles the palette) and on
  `window:scroll` for the header shadow and the back-to-top button (after 900 px).
- **Startup work** in the shell constructor: start the achievement watcher, ask the browser for persistent storage and
  install the global image fallback. `ThemeService` is injected so the accent applies immediately.
- **Install prompt.** It defers `beforeinstallprompt`, shows on iOS Safari after 2.6 s, never shows when already standalone
  and remembers dismissal or install under `install-dismissed`.
- **Toasts.** `ToastService.show` keeps at most four toasts, auto-dismisses after six seconds and pauses on hover or focus.
  The visible stack is `aria-hidden`; a visually hidden `role="status"` region carries only the text.

## Key decisions

- **Hash routing** is intentional: GitHub Pages serves static files, so deep links like `/#/pokemon/6` resolve without
  server rewrites.
- **Lazy routes** keep the initial bundle small (the build budgets enforce it); idle preloading warms only the likely next
  pages and respects the user's data settings.
- **Mobile-first navigation.** Phones get a thumb-reachable tab bar; the dropdown and the inline row are progressive
  enhancements at wider breakpoints.
- **Fail soft on deploys.** A new deploy replaces hashed chunks; reloading once beats a dead tab, and the one-minute
  cooldown prevents a reload loop.
- **One navigation list** avoids the header and the bottom sheet drifting apart.

## Theme

A cyber / glassmorphism look: dark gradient background, neon accents, frosted `.glass` panels. The 18 type colours are CSS
variables (`--type-*`) so any component can tint by type with `typeColorVar(type)`. The three accent tokens (`--accent`,
`--accent-2`, `--accent-3`) are user-switchable: `ThemeService` offers Aurora (default, no overrides), Ember, Verdant,
Sakura and Solar, persists the choice under `theme:accent` and applies it as inline overrides, so every component retints.
The picker lives on the Trainer Profile page.

## Accessibility & mobile

- A skip link targets `#main-content` (a focusable `<main>`); the burger exposes `aria-expanded` and `aria-controls`; the
  language and search buttons are labelled, and search declares `aria-keyshortcuts`.
- The bottom sheet is a modal dialog (`pvModal`): focus moves in and is trapped, Escape closes it, the page behind is inert
  and focus returns to the "More" button.
- Toasts: text-only polite live region (see above); pointer or keyboard focus pauses the countdown.
- A global `:focus-visible` ring, reduced-motion rules for view transitions and animations, and safe-area insets for the
  bottom bar and landscape phones.
- The bottom bar reserves its height on the shell so the footer is never hidden behind it.

## Tests

- `src/app/app.spec.ts`, `app.config.spec.ts`, `app.routes.spec.ts`: shell rendering, global keys, providers and route table.
- `src/app/core/ui/interactive-components.spec.ts`, `display-components.spec.ts`, `modal/modal.spec.ts`,
  `toast/toast.service.spec.ts`: toasts, modal behaviour and UI primitives.
- `src/app/core/theme/theme.service.spec.ts`: palettes, persistence and DOM overrides.
- `src/app/core/update/chunk-error.spec.ts`, `idle-preload.spec.ts`, `idle-preload-strategy.spec.ts`: update safety and preloading.
- `src/app/core/i18n/translated-title.strategy.spec.ts`: translated titles.
