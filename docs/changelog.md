# Changelog

All notable, user-facing changes to PokéVerse Arena. Versions follow
[semver](https://semver.org/); the app version is surfaced in the footer and
kept in sync between `package.json` and `src/app/core/version.ts`.

## v1.5.0 — 2026-07-03

### Added

- **Share your daily** — the daily result panel gains a *Share result* button
  that builds a Wordle-style text: challenge number + date, outcome + turn
  count + streak, and one emoji per player turn (🟩 super effective, 🟨
  neutral, 🟥 resisted, 🟪 immune, ⬜ miss, 💥 crit), wrapped at ten per row.
  Uses the native share sheet when available, otherwise copies to the
  clipboard with a confirmation toast. Pure helpers (`dailyNumber`,
  `turnEmoji`, `buildShareText`) are unit-tested.
- **Daily-streak achievements** — two new milestones, *On Fire* (3-day best
  streak) and *Eternal Flame* (7-day), evaluated from the persisted daily
  record; the achievement watcher toasts them like any other unlock. The
  profile records grid shows *Daily streak (best N)* and the home dashboard
  gains a 🔥 streak chip.

### Changed

- **Component-style budgets** raised in `angular.json` (warn 8 kB → 20 kB,
  error 20 kB → 32 kB): five feature stylesheets (tournaments 18.1 kB, arena
  14.3 kB, contest 12.7 kB, team-builder 11.8 kB, pokemon-detail 11.1 kB) are
  intentionally rich single-page components; the old threshold produced
  permanent warning noise on every build.

## v1.4.0 — 2026-07-03

### Added

- **Daily Challenge** — the Battle Arena's setup screen gains a challenge card:
  every UTC day derives one deterministic matchup (fighters *and* battle seed)
  from the date via `SeededRng`, so every trainer worldwide fights the same
  battle. The first attempt of the day counts toward a consecutive-day win
  streak (current / best / total wins, persisted as `pv:daily:record`); a loss
  breaks it, a skipped day lapses it, retries replay the identical seeded
  battle without touching the record. A counted win pops a streak toast.
  - Pure logic in `src/app/game/daily/daily.ts` (day keys, matchup derivation,
    streak fold) with 10 unit tests.
  - `DailyService` handles persistence + reporting; `?daily=1` deep-links and
    auto-starts (also from a finished battle), wired to a new ⌘K palette
    action "Fight the Daily Challenge".

### Fixed

- Deep-linking `?daily=1` while a finished battle was still on screen did not
  start the challenge (the auto-start guard only accepted the setup phase).

## v1.3.0 — 2026-07-03

### Added

- **Achievement unlock toasts** — earning any of the ten achievements now pops
  a celebratory toast (gold gradient icon, name + description) no matter which
  system earned it. `AchievementWatcherService` re-aggregates progression on
  every navigation plus a slow 30 s poll, diffs the unlocked set against a
  persisted "seen" list (`pv:achievements:seen`) and toasts only the delta.
  The very first run baselines silently, so pre-existing progress doesn't
  spam; a progress reset re-arms the toasts. Pure diff logic
  (`achievement-diff.ts`) is unit-tested.
- **Global toast system** (`src/app/core/ui/toast/`) — a reusable
  `ToastService` + `pv-toasts` stack (bottom-right, `aria-live="polite"`,
  click to dismiss, auto-dismiss after 6 s, capped at 4). Feature-local inline
  toasts (Spire, World, RPG) are unchanged; this is for cross-cutting
  notifications.

## v1.2.0 — 2026-07-03

### Added

- **Recent Pokémon in the palette** — the command palette now opens with a
  *Recent* group: the last eight detail pages you visited, most recent first,
  with sprite thumbnails. Recorded at the data layer
  (`PokemonDetailService.load` success → `RecentPokemonService`), so every way
  of reaching a detail page counts; deduplicated and persisted. Pure list
  logic (`pushRecent`) is unit-tested.
- **Accent themes** — an *Appearance* section on the Trainer Profile with five
  curated palettes (Aurora default, Ember, Verdant, Sakura, Solar). The new
  `ThemeService` (`src/app/core/theme/`) overrides the `--accent*` design
  tokens on `<html>`, so the whole app retints instantly; the choice persists
  and is re-applied at startup by the shell. Picking Aurora removes the
  overrides so the stylesheet defaults rule again.

### Documentation

- New feature doc `docs/features/command-palette.md`; index, app-shell and
  profile docs updated accordingly.

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
