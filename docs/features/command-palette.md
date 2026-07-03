# ⌘K Command Palette

A global, keyboard-first launcher: from anywhere in the app, `Ctrl+K` (or the
topbar search pill) opens a glass overlay that jumps to any page, runs quick
actions, resurfaces recently viewed Pokémon and live-searches the full Pokédex
index.

## What it does

- **Go to** — all twelve pages, matched by label *and* hidden keywords
  (`"gym"` → Arena, `"roguelike"` → Spire), so users find features by concept.
- **Actions** — "Surprise me" (random Pokémon detail page), shiny-sprite
  toggle (label reflects current state), jump to favorites.
- **Recent** — the last eight Pokémon detail pages visited, most recent first,
  shown with sprite thumbnails when the query is empty. Recorded on every
  successful detail load, deduplicated, persisted via `SaveService`.
- **Pokémon** — from two typed characters, a live search over the in-memory
  Pokédex index by name or `#number`; prefix matches rank before substring
  matches, capped at eight hits.
- Fully keyboard-driven: `↑`/`↓` move (wrapping), `Enter` runs, `Esc` or a
  backdrop click closes, `Ctrl+K` toggles. ARIA combobox/listbox semantics
  with `aria-activedescendant`.

## Files

| File | Responsibility |
| ---- | -------------- |
| `app/features/command-palette/command-palette.ts` | Component: open/close lifecycle, result groups (computed), keyboard handling, execution. |
| `app/features/command-palette/command-palette.html` | Dialog markup: search input, grouped listbox, kbd-hint footer. |
| `app/features/command-palette/command-palette.scss` | Glass panel, active-row highlight, pop-in animation, mobile trims. |
| `app/core/recent/recent-pokemon.service.ts` | Rolling recents list (`pushRecent` pure helper + persisted signal). |
| `app/app.ts` / `.html` | Shell integration: global `Ctrl+K` listener, topbar search pill, `@defer (on idle)` mount. |

## Key decisions

- **Shell-owned open state.** The `App` shell owns the `paletteOpen` signal and
  the global keydown listener; the palette receives `open` as an input and
  emits `closed`. This lets the component sit inside `@defer (on idle)` — the
  hotkey works from the first paint, but the palette's code costs the initial
  bundle nothing.
- **Reuses the Pokédex index.** Search runs over `PokedexService.entries()`
  (already loaded/enriched client-side) instead of hitting the API — results
  are instant and work offline.
- **Recents are recorded at the data layer** (`PokemonDetailService.load`
  success), not in the component, so every path into a detail page — palette,
  card click, evolution tree, deep link — counts.
- **Pure logic is unit-tested** (`recent-pokemon.spec.ts` covers dedup, cap,
  ordering, immutability) per the project's pure-function testing convention.
