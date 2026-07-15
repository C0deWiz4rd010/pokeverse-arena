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
  lazy, memoized stats / BST / abilities / flavour, a cry button and a **Fuse**
  chip into the Fusion Lab (head donor pre-filled).
- **Shiny mode & cries.** Persisted ✨ toggle; a shared single-`Audio` CryService
  (URLs by id) with a mute toggle. In shiny mode every card gets two twinkling
  golden sparkles, de-synchronized per card by reusing the entrance-stagger
  delay (pure CSS, reduced-motion safe).
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

## 3D holo cards (v1.19)

Grid tiles are miniature TCG cards now: pointer/touch tilt runs at 12° with a
hover scale, a **holo foil** (a pointer-angled rainbow masked at the glare,
`color-dodge`-blended — brightest on shiny mode and favorites) sweeps the
face, and real depth layers push artwork, name and type badges above the card
plane (`translateZ` under `preserve-3d`). Loaded artwork idles on a gentle,
per-card-staggered levitation loop. Everything is disabled under
`prefers-reduced-motion`, and the sheen/holo layers are `pointer-events: none`
so nothing steals taps.

## Quickview 2.0 (v1.20)

The popover gained a subtle 5-degree pointer parallax and a card flip: the
*Radar* chip rotates it (preserve-3d; instant under reduced motion) to an SVG
stat radar - a type-colored hexagon over 25/50/75/100 % rings with labeled
axes and raw values (HP at 12 o'clock), BST in the header and a back chip.
The radar geometry (rings, axes, labels, shape) shares one pure point
function, so the polygon always matches its axes.

## 3D Showcase - the second dex version (v2.0)

The classic grid stays as-is; a "3D Showcase" chip in the toolbar (route
`#/showcase`, also in the command palette) switches to an immersive
one-Pokemon stage: type-colored scenery with orbiting dashed rings and a
giant blurred artwork echo, pointer-parallax tilt + levitation on the
artwork, the shared stat radar, the evolution chain (tap to jump), cry and
shiny toggles, and prev/next via buttons, arrow keys or swipe. Deep-linkable
via `?id=94`; mobile-first with zero horizontal overflow; all motion honours
prefers-reduced-motion. The compare overlay additionally opens with overlaid
color-coded stat polygons + legend (shared `stat-radar` geometry module).
