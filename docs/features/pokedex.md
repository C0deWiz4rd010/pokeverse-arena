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
