# ⌘K Command Palette

A global, keyboard-first launcher: from anywhere in the app, `Ctrl+K` / `⌘K` (or the topbar search pill) opens a glass dialog that jumps to any page, runs quick actions, resurfaces recently viewed Pokémon and live-searches the Pokédex index.

## What it does

- **Recent**: with an empty query, the last eight Pokémon detail pages visited (most recent first, with sprite thumbnails).
- **Go to**: 15 pages (Home, Pokédex, Type Lab, Team Builder, Battle, Arena, Tournaments, Ascension Spire, Odyssey, World Explorer, Fusion Lab, Pokédex Showcase, Contest Hall, Adventure, Trainer Profile). Matching uses the label and hidden keywords, in English and in the active translation, so `gym` finds Arena and `roguelike` finds Spire and Odyssey. Stat Showdown has no palette entry.
- **Actions** (filtered by label too):
  - Fight the Daily Challenge (`/battle?daily=1`)
  - Surprise me: random Pokémon (id 1-1025)
  - Splice today's Lab Special (the seeded fusion pair)
  - Fuse two random Pokémon
  - Enable/Disable shiny sprites (label follows the current Pokédex shiny state)
  - Show my favorites (`/pokedex?fav=1`)
- **Pokémon**: from two typed characters, a live search over the in-memory Pokédex index by name or `#number`; prefix matches rank before substring matches, capped at eight hits, with dex number and types as the hint.
- **Keyboard**: `↑` / `↓` move (wrapping), `Enter` runs the highlighted row, `Esc` or a click on the backdrop closes, `Ctrl+K` / `⌘K` toggles. Hovering a row moves the highlight. An empty result list shows a hint instead.
- Each time it opens the query and selection reset and the search box is focused.

## Files

| Path | Responsibility |
| ---- | -------------- |
| `src/app/features/command-palette/command-palette.ts` | Component: page and action tables, result groups (`computed`), Pokémon search, keyboard handling, execution. |
| `src/app/features/command-palette/command-palette.html` | Dialog markup: search input (combobox), grouped listbox, key-hint footer. |
| `src/app/features/command-palette/command-palette.scss` | Glass panel, active-row highlight, fade/pop-in animation, small-screen trims. |
| `src/app/core/recent/recent-pokemon.service.ts` | `RecentPokemonService` and pure `pushRecent` (dedupe, cap 8), persisted under `recent:pokemon` via `SaveService`. |
| `src/app/features/pokemon-detail/pokemon-detail.service.ts` | Records each successfully loaded Pokémon into the recent list. |
| `src/app/features/pokedex/pokedex.service.ts` | Source of the index (`entries()`), `ensureLoaded()`, `shiny` and `toggleShiny()`. |
| `src/app/app.ts`, `src/app/app.html` | Shell: owns `paletteOpen`, the global key listener, the topbar search button and the `@defer (on idle)` mount. |
| `src/app/core/ui/modal/modal.ts` | `pvModal` directive providing dialog behaviour. |

## How it works

- The `App` shell owns the `paletteOpen` signal and the global `keydown` handler (`Ctrl`/`Meta` + `K`, which also closes the mobile menu). The palette gets `open` as a required input and emits `closed`.
- `groups` is a `computed` that builds Recent (only when the query is empty), Go to, Actions and Pokémon (query length >= 2). `flat` flattens them in render order, which is what the arrow keys walk.
- Pokémon search reads `PokedexService.entries()`, so it makes no API calls; opening the palette calls `ensureLoaded()` to warm the index. A numeric query (with or without `#`) matches the id exactly.
- Running an item closes the palette first, then navigates or toggles.
- Recents are recorded in `PokemonDetailService.load`, so every path into a detail page counts (palette, card, evolution tree, deep link).

## Key decisions

- **Shell-owned open state.** The shell owns the hotkey so it works from first paint, while the palette itself sits in `@defer (on idle)` and costs the initial bundle nothing.
- **Reuse the Pokédex index.** Search is instant and works offline once the index is loaded.
- **Recents at the data layer**, not in the component.
- **Keywords for discovery.** Hidden search words let people find features by concept rather than exact name.

## Accessibility & mobile

- `role="dialog"` with `aria-modal` and the `pvModal` directive: background inert, body scroll locked, Tab cycling inside, `Esc` closes, focus returns to the opener.
- The input is a `role="combobox"` controlling a `role="listbox"` of `role="option"` buttons, with `aria-selected` and `aria-activedescendant` kept in sync; the key-hint footer is `aria-hidden`.
- The topbar button has a label, a title and `aria-keyshortcuts="Control+K Meta+K"`, so touch users can open it without a keyboard.
- Below the `sm` breakpoint the per-row hints and the footer are hidden.

## Tests

- `src/app/features/command-palette/command-palette.spec.ts`: closed state, opening and focus, recents, page filtering by label and keyword, Pokémon search ranking and number lookup, empty state, arrow-key wrapping and `aria-activedescendant`, Enter, click, hover, Escape, backdrop, reset on reopen, and each action.
- `src/app/core/recent/recent-pokemon.spec.ts` (pure `pushRecent`) and `recent-pokemon.service.spec.ts` (persistence).
