# Pokédex

Browse all ~1025 Pokémon with instant search, filtering, a quick view, comparison and an immersive 3D showcase.

## What it does

- Shows a grid of cards (official artwork, type badges, dex number) with **infinite scroll**: 48 entries are revealed at a time as the sentinel scrolls into view.
- **Search** matches name, `#id` / bare id, an id range (`#1-151`) or a type name.
- **Filters**: multi-select type chips with an Any/All (OR/AND) switch (shown once two or more types are selected), a generation select (1-9), and a favourites-only toggle. A badge on the Filter button counts active filters; on phones the filter panel starts collapsed.
- **Sort**: # lowest, # highest, name A-Z, generation, type, favourites, shuffle.
- **View modes**: Gallery, Compact, List. Sort, view and shiny mode persist; the rest of the state is carried in the URL.
- **Shiny mode** toggle (also key `s`) swaps card and quick-view art to shiny artwork. A mute toggle controls Pokémon cries.
- **Favourites and caught**: a heart on every card (persisted), and a check mark for species caught in the World expedition. A progress HUD shows favourite and caught counts plus per-generation pips; clicking a generation filters to it.
- **Cards** are type-themed (dual-type gradient), show a skeleton until the artwork loads, tilt with the pointer, show a holo/sheen layer and swap to the animated sprite on hover. Each card has a favourite heart, a quick-view button and a compare button.
- **Quick view**: an anchored dialog with cry, genus and flavour text (German when the UI language is German), evolution line (links to each stage), six stat bars with BST, height/weight and abilities. A **Radar** chip flips the panel to an SVG stat radar. A **Fuse** chip opens the Fusion Lab with this Pokémon as head donor; **Full page** opens the detail page. Scrolling the page closes it.
- **Compare tray**: select up to 4 cards; with 2 or more selected a sticky tray offers a compare overlay with overlaid colour-coded stat polygons and legend, a per-stat table that highlights the best value, BST and a "weak to" row per Pokémon.
- **Who's That Pokémon?**: silhouette mini-game with three choices, a cry on a correct guess and a session streak/best counter (not persisted).
- **3D Showcase** (`#/showcase?id=94`): a one-Pokémon stage with type-coloured scenery, orbiting rings, a blurred artwork echo, pointer parallax and levitation, stat radar, evolution chain (tap to jump), cry and shiny chips. Navigate with prev/next buttons, arrow keys or swipe. The id is validated (1-1025) and kept in the URL.
- **Keyboard**: `/` focuses search, arrow keys move between cards, `f` favourites the focused card, `s` toggles shiny, `Esc` closes whichever overlay is open.
- A back-to-top button appears after about 900 px of scrolling.

## Files

| Path | Responsibility |
| ---- | -------------- |
| `src/app/features/pokedex/pokedex.ts`, `pokedex.html`, `pokedex.scss` | Page component: toolbar, filter panel, grid, sentinel observer, overlays, keyboard handling, URL sync. |
| `src/app/features/pokedex/pokedex.service.ts` | State container: index load and enrichment, filter/sort/view/shiny/favourite/compare signals, paging. |
| `src/app/features/pokedex/pokedex-filter.ts` | Pure functions: `matchesQuery`, `parseRange`, `applyDexFilters`, `sortDex`, `asSort`, `asView`, `parseTypes`. |
| `src/app/features/pokedex/pokedex-detail.service.ts` | Memoized per-id detail (`load`) and evolution stages (`loadChain`) shared by quick view, compare and showcase. |
| `src/app/features/pokedex/pokemon-card.ts`, `pokemon-card.scss` | Grid tile with tilt, holo, hover sprite and action buttons. |
| `src/app/features/pokedex/pokemon-quickview.ts`, `.scss` | Quick-view modal with radar flip side. |
| `src/app/features/pokedex/pokemon-compare.ts`, `.scss` | Compare overlay. |
| `src/app/features/pokedex/whos-that.ts`, `.scss` | Silhouette mini-game dialog. |
| `src/app/features/pokedex/showcase/showcase.ts`, `showcase.scss` | 3D showcase stage (own lazy route `showcase`). |
| `src/app/core/ui/stat-radar/radar-geometry.ts` | Shared radar math (rings, axes, labels, shape) used by quick view, compare and showcase. |
| `src/app/core/audio/cry.service.ts` | Single shared `Audio` element for cries, with mute. |

## How it works

1. `ensureLoaded()` fetches `/pokemon?limit=100000` once, keeps entries with id <= 10000 (drops alternate forms), sorts by id and derives artwork URLs from the id, so the grid needs no per-Pokémon requests.
2. `enrichIndex()` then fetches the 18 type lists and 9 generation lists (cache-first, about 27 calls) and stamps every entry with `types` and `gen`. It is non-fatal: without it the grid works but has no badges, type filter or generation filter; a hint shows while it runs.
3. `filtered` is a `computed` that runs `applyDexFilters` and `sortDex` over the in-memory index; `visible` slices it to the page size. Changing any filter resets paging to 48. Shuffle uses a seeded RNG, so the order is stable across re-renders.
4. The sentinel is observed inside an `effect` with an `onCleanup` that disconnects the `IntersectionObserver`, so it re-attaches whenever the list re-renders.
5. URL sync: `restoreFromUrl()` reads `q`, `types`, `mode`, `gen`, `sort`, `view`, `shiny`, `fav` once at start; an `effect` writes them back with `replaceUrl` (defaults omitted).
6. Persistence goes through `SaveService` (`pv:` envelopes): `pokedex:sort`, `pokedex:view`, `pokedex:shiny`, `pokedex:favorites`. The caught set (written by World Explorer) is read once at startup with `SaveService.read('world:caught')`, so both features share the same `pv:world:caught` entry; the Pokédex only reads it.
7. Quick view, compare and showcase call `PokedexDetailService.load`, which caches mapped view-models and dedupes in-flight requests; the species call is optional flavour and failure is ignored.

## Key decisions

- **One request, client-side filtering.** Search and filters feel instant and the API is not hammered.
- **Artwork by convention.** 1025 tiles cost zero extra requests.
- **Pure filter module.** Query parsing, filtering and sorting have no Angular or network dependency, so they are deterministic and unit-testable.
- **Shared radar geometry, not a shared template.** Quick view, compare and showcase draw their own SVG on one set of point functions, so polygons always match their axes. The `pv-stat-radar` component is used by the detail page.
- **Showcase is CSS 3D, not three.js.** It is a separate lazy route that keeps the classic grid untouched.
- **Shareable state in the URL, preferences in storage.** Filters are shareable links; sort, view and shiny are remembered per device.

## Accessibility & mobile

- Quick view, compare and Who's That are `role="dialog"` with the `pvModal` directive: background inert, scroll locked, `Esc` closes, focus returns to the trigger.
- Favourite, compare and quick-view buttons are real buttons with labels; favourite uses `aria-pressed`. Type chips, the Any/All switch and view modes are labelled groups with `aria-pressed`; the Filter button uses `aria-expanded`. A screen-reader-only status announces loading; errors use the shared `pv-state`.
- All motion (tilt, holo, levitation, flip, parallax, smooth scroll) is disabled under `prefers-reduced-motion`.
- On phones the toolbar sticks below the header, the type chips form one swipeable snap row, the filter panel is collapsed by default, and the back-to-top button respects safe-area insets and lifts above the compare tray. The 3D hover effects are skipped for touch pointers in the showcase.

## Tests

- `pokedex.spec.ts`: loading states, search/filters, favourites and progress, paging, compare, overlays, scroll, keyboard, URL state.
- `pokedex.service.spec.ts`: loading, enrichment, filtering and paging, favourites, caught, compare.
- `pokedex-filter.spec.ts`: query parsing, filtering, sorting, coercion helpers.
- `pokedex-detail.service.spec.ts`: memoization, in-flight dedupe, evolution stages.
- `pokemon-card.spec.ts`, `pokemon-quickview.spec.ts`, `pokemon-compare.spec.ts`, `whos-that.spec.ts`.
- `core/ui/stat-radar/radar-geometry.spec.ts` covers the shared geometry. The showcase has no spec of its own.
