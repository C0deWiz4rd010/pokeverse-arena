# Changelog

All notable, user-facing changes to PokéVerse Arena. Versions follow
[semver](https://semver.org/); the app version is surfaced in the footer and
kept in sync between `package.json` and `src/app/core/version.ts`.

## v1.1.0 — 2026-07-03

### Added

- **⌘K Command Palette** (`src/app/features/command-palette/`) — a global
  overlay opened with `Ctrl+K` (or the topbar search pill) that offers:
  - *Go to* — every page, searchable by name and hidden keywords
    (e.g. "gym" finds the Arena).
  - *Actions* — "Surprise me" (random Pokémon detail page), shiny-sprite
    toggle, jump to favorites.
  - *Pokémon* — live search over the Pokédex index by name or #number with
    sprite thumbnails; `Enter` opens the detail page.
  - Fully keyboard-driven (`↑`/`↓`, `Enter`, `Esc`), ARIA combobox/listbox
    semantics, backdrop click closes. Lazy-loaded via `@defer (on idle)` so it
    costs the initial bundle nothing.
- **Pokédex skeleton loading** — the first load now shows 12 shimmering
  placeholder cards (staggered fade-in) instead of a spinner; screen readers
  still get a loading status announcement.

### Changed

- **Router view transitions** — `withViewTransitions()` plus a fade-out /
  rise-in animation between pages (View Transitions API). Unsupported browsers
  skip it; `prefers-reduced-motion` disables it.
- **Topbar** — new search pill (icon-only on mobile, `Ctrl K` hint on desktop,
  full "Search…" label ≥1600px), a subtle shadow once the page scrolls, and
  `min-height` instead of a fixed height so the 11-item nav wraps gracefully
  inside the glass panel on mid-size screens (previously it could overflow).
- **Buttons** — global `:active` press feedback (tiny scale-down) for snappier
  micro-interactions.
