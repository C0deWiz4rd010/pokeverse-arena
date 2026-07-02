# Pokédex

Browse all ~1025 Pokémon with instant search and filtering.

## What it does

- Loads a lightweight **name + id index** in a single request, so search and
  type/generation filtering run instantly on the client.
- Renders a responsive grid of cards with official artwork (derived from the id
  via the sprite CDN — no per-Pokémon fetch needed for the grid).
- **Infinite scroll** via `IntersectionObserver` reveals 48 entries at a time.

## Files

| File | Responsibility |
| ---- | -------------- |
| `features/pokedex/pokedex.service.ts` | State container: loads the index once; signals for `query`, `typeFilter`, `generationFilter`, `filtered`, `visible`; exposes `names` for autocomplete. |
| `features/pokedex/pokemon-card.ts` | Grid tile: lazy image, error fallback, links to detail. |
| `features/pokedex/pokedex.ts` / `.html` / `.scss` | Search box, type chips, generation select, infinite-scroll sentinel. |

## How it works

1. `ensureLoaded()` fetches `/pokemon?limit=100000` once and maps it to an
   id-sorted index, filtering out high-id alt-forms.
2. `filtered` is a `computed` that applies the active query + type + generation
   filters synchronously over the in-memory index.
3. `visible` slices `filtered` to the current page size; the sentinel calls
   `loadMore()` when it scrolls into view.
4. Type and generation filters resolve the allowed name-sets lazily from the API
   (also cached) and intersect them with the index.

## Key decisions

- **One request, client-side filtering.** Avoids hammering the API and makes
  search feel instant.
- **Artwork by convention.** The grid derives `official-artwork` URLs from the
  id, so 1025 tiles cost zero extra requests.

## Mobile-first

Controls stack vertically with full-width inputs on mobile; the grid scales from
`minmax(108px, …)` up to denser columns at larger breakpoints.

## Living Dex overhaul (v2)

A deep interactivity + motion pass over the Pokédex.

- **Type-aware index.** A one-time enrichment fetches the 18 type lists + 9
  generation lists (cache-first, ~27 calls total — never per-Pokémon) and stamps
  every entry with `types` + `gen`, unlocking type badges, theming and instant
  client-side filtering.
- **Reborn cards.** Dual-type gradient + glow, type badges, skeleton shimmer, a
  staggered entrance, a cursor-following sheen and a 3D pointer tilt; shiny-aware
  art that cross-fades to the animated Showdown sprite on hover.
- **Quick-view popover.** An info button opens an anchored, animated card with
  lazy, memoized stats / BST / abilities / flavour and a cry button.
- **Shiny mode & cries.** Persisted ✨ toggle; a shared single-`Audio` CryService
  (URLs by id) with a mute toggle.
- **Filtering & search.** Multi-select types with Any/All (OR/AND), search by
  name / #id / #range / type, sort (#, name, gen, type, favorites, shuffle) and
  Gallery / Compact / List view modes — all pure + tested in `pokedex-filter.ts`.
- **Favourites & caught.** Per-card heart (persisted), favorites-only filter, and
  ✓ caught markers mirrored from the World expedition dex.
- **Progress HUD.** Favorites + caught counts and per-generation pips (click to
  filter a generation).
- **Compare tray.** Select up to 4 → a sticky tray → a side-by-side overlay with
  best-stat highlights, BST and a per-Pokémon weakness row.
- **Keyboard UX.** `/` search, arrow-key grid navigation, `f` favourite, `s`
  shiny.
- **Shareable URL state** and a **"Who's That Pokémon?"** silhouette mini-game.

All animations honour `prefers-reduced-motion`. New files: `pokedex-filter.ts`,
`pokedex-detail.service.ts`, `pokemon-quickview`, `pokemon-compare`, `whos-that`,
and `core/audio/cry.service.ts`.

## Mobile-first pass

On phones the search/filter bar sticks below the app header (blurred +
elevated), the 18 type chips collapse into one swipeable snap row, tap
targets grow, a back-to-top FAB appears after two screens (reduced-motion
aware, safe-area insets, lifts above the compare tray).
