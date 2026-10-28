# World Explorer — Regions & Home Finder

Roam the nine core Pokémon regions and discover where every Pokémon first appeared. Pick a region to browse its native
Pokédex and go on an expedition, or search any Pokémon by name or number to reveal the world it calls home.

Route: `/world`.

## What it does

- **Region map.** A responsive grid of the nine regions (Kanto, Johto, Hoenn, Sinnoh, Unova, Kalos, Alola, Galar, Paldea).
  Each card shows its emblem, generation, landmark, native species count, tagline and a completion ring with a percentage
  once something is registered. A **World Dex** bar above the grid shows registered species out of 1025.
- **Region view.** Selecting a region loads its native Pokémon from the PokéAPI generation endpoint and lays them out as a
  sprite grid in National Dex order, under a banner with generation, games, blurb, native count and a completion bar. Every
  tile links to the Pokémon detail page. Caught species are shown normally; uncaught ones are dimmed silhouettes.
- **Expedition.** In a region, **Roam** rolls a wild encounter from the region's dex range. Rarity sets the level band and
  the base catch rate (common 60 % of rolls, level 4-16, 70 % catch; uncommon 30 %, level 12-28, 45 %; rare 10 %, level
  22-40, 25 %). Pick a Poké, Great (x1.5) or Ultra (x2) ball; the displayed chance is capped at 95 %. A throw wobbles for
  850 ms, then catches or breaks free. A catch registers the species in the personal dex. Encounters play the Pokémon's
  cry.
- **Shinies.** Each encounter has a 1-in-40 chance to be shiny (shiny sprite and a toast). Shiny catches are tracked
  separately and shown as a chip on the region banner.
- **Home finder.** Type a Pokémon's name or dex number: the explorer resolves its debut region, jumps there and spotlights
  the matching tile with a pulse. Unknown names and out-of-range ids show a message instead.
- **Graceful states.** A spinner while a region loads, an error panel with a "Back to the map" action, and clear
  not-found and "beyond the charted regions" messages for searches.

## Files

| Path | Responsibility |
| ---- | -------------- |
| `src/app/game/world/regions.ts` | Pure data: the nine `Region`s (generation, dex range, games, landmark, accent, blurb) plus `regionForDex`, `regionById`, `regionDexCount`. |
| `src/app/game/world/encounters.ts` | Seeded `rollEncounter`, rarity table, `BALLS`, `catchChance`, `attemptCatch`, `regionCaught`, `regionCompletion`. |
| `src/app/features/world/world.service.ts` | State (idle, loading, ready, error), region loading, expedition and catch flow, personal dex persistence, the `locate()` home finder. |
| `src/app/features/world/world.ts`, `world.html`, `world.scss` | Component: world HUD and region grid, region banner, expedition panel, dex grid, search box. |

## How it works

- **Region data is static.** Each `Region` maps to a debut generation and an inclusive National Dex range; `regionForDex`
  answers "where did this Pokémon first appear?" without any network call.
- **Native Pokémon come from the generation endpoint.** `select(region)` fetches `generation/{n}` through the cache-first
  `PokeApiClient`, takes the dex number from each `pokemon_species` URL, keeps ids 1-1025, sorts them and renders the light
  pixel sprites (`sprites/pokemon/{id}.png`). Failures set the `error` status.
- **Home finder.** `locate()` calls `pokemon/{name|id}`, maps the resolved id through `regionForDex`, switches to that region
  and stores a `sighting` that adds the `.spotlight` class to the matching tile.
- **Personal dex.** Catches are written to `SaveService` as number arrays under `world:caught` and `world:shiny` (stored as
  `pv:world:*`). The signals `caught` and `shinyCaught` drive the grid state, per-region progress and the world HUD. The
  Trainer Profile reads the same keys for its totals and achievements.
- **Encounters** are seeded per roll from the region id and a step counter plus a random component; the catch roll itself uses
  `Math.random()`, injected into the pure `attemptCatch` as an explicit roll.

## Key decisions

- **Static region data.** Mapping dex ranges to regions by hand avoids a network round-trip and keeps the finder instant.
- **Pure encounter module.** Rarity, catch odds and completion maths live in `game/world` so they are unit-testable with an
  explicit roll.
- **Light sprites for the grid.** The small pixel sprites keep a whole region (up to 156 tiles) cheap to render and lazy-load.
- **Silhouettes for uncaught species** make the grid a collection goal without hiding the names.
- **Region accents as a `--accent` custom property** per card keeps the themed gradients data-driven.

## Accessibility & mobile

- Mobile-first SCSS with `@include up(...)`: the region grid reflows from one to three columns and the dex grid uses
  `auto-fill`.
- Tiles are real links with the name as `title` and sprites carry the Pokémon's name as `alt`; decorative icons, rings and
  catch sparks are `aria-hidden`.
- The ball picker and the throw/next/leave actions are buttons; throw controls are disabled while a ball is in the air.
- The spotlight pulse, wobble and spark burst are disabled under `prefers-reduced-motion`.
- The expedition result line (`exp-toast`) is a plain paragraph without a live region.

## Tests

- `src/app/game/world/regions.spec.ts`: ordering, contiguous dex ranges, dex-to-region and slug lookup.
- `src/app/game/world/encounters.spec.ts`: seeded encounters, catch chance and caps, completion counts.
- `src/app/features/world/world.service.spec.ts`: region loading, errors, locate, expedition and catching, persistence.
- `src/app/features/world/world.spec.ts`: component states, search, expedition controls.
