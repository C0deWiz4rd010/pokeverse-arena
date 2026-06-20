# World Explorer — Regions & Home Finder

Roam the nine core Pokémon regions and discover where every Pokémon first
appeared. Pick a region to browse its native Pokédex, or search any Pokémon by
name or number to reveal the world it calls home.

## What it does

- **Region map** — a responsive grid of the nine core regions (Kanto → Paldea),
  each as a themed card with its generation, signature landmark, native species
  count and an evocative tagline.
- **Region view** — selecting a region loads its native Pokémon from the PokeAPI
  generation endpoint and lays them out as a sprite grid in National Dex order,
  with a themed banner (generation, games, blurb and count). Every Pokémon links
  straight to its detail page.
- **Home finder** — type a Pokémon's name or dex number and the explorer resolves
  its debut region, jumps there, and spotlights the matching entry with a glowing
  pulse.
- **Graceful states** — loading spinner while charting a region, a friendly error
  with a retry path, and clear "not found" / "beyond the charted regions"
  messages for searches.

## Files

| File | Responsibility |
| ---- | -------------- |
| [game/world/regions.ts](../../src/app/game/world/regions.ts) | Pure data: the nine `Region`s (generation, dex range, games, landmark, accent, blurb) + `regionForDex`, `regionById`, `regionDexCount` helpers. |
| [game/world/regions.spec.ts](../../src/app/game/world/regions.spec.ts) | Unit tests: ordering, contiguous dex ranges, dex→region lookup, slug lookup. |
| [features/world/world.service.ts](../../src/app/features/world/world.service.ts) | State (idle / loading / ready / error), region loading, sprite mapping, the `locate()` home finder. |
| [features/world/world.ts](../../src/app/features/world/world.ts) / [.html](../../src/app/features/world/world.html) / [.scss](../../src/app/features/world/world.scss) | The component: region grid, region banner + dex grid, search box. |

## How it works

- **Region data is static and pure.** Each `Region` maps to a debut generation
  and an inclusive National Dex range. `regionForDex(dex)` answers "where did this
  Pokémon first appear?" in O(9) without any network call — the basis of the home
  finder.
- **Native Pokémon come from the generation endpoint.** `select(region)` fetches
  `generation/{n}`, reads `pokemon_species`, extracts the dex number from each
  resource URL, sorts ascending and renders the light pixel sprites
  (`sprites/pokemon/{id}.png`) so a whole region loads as a cheap grid. Requests
  are cache-first through the shared `PokeApiClient`.
- **The home finder** calls `pokemon/{name|id}`, reads the resolved `id`, maps it
  through `regionForDex`, switches to that region and stores a `sighting` that the
  template uses to add a `.spotlight` pulse to the matching tile.

## Design notes

- Mobile-first SCSS with `@include up(sm|md)` so the region grid reflows from one
  to three columns; the dex grid uses `auto-fill` so it adapts to any width.
- The spotlight pulse and hover lifts are disabled under
  `prefers-reduced-motion`.
- Region accents are passed as a `--accent` custom property per card, keeping the
  themed gradients and glows data-driven.
