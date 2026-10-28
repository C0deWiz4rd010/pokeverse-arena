# Pokémon Detail

A rich profile page for a single Pokémon, at `#/pokemon/:id`.

## What it does

- **Hero card** with the dex number, official or animated sprite, name, genus and flavour text (German when the UI language is German), type badges, and height / weight (with imperial values) / animated BST count-up. The card is tinted by the Pokémon's types.
- **Sprite controls**: shiny toggle (key `s`, plays the cry and a sparkle burst), animated/still toggle, front/back toggle (shown only when an animated sprite exists). Animated sprites start off under `prefers-reduced-motion`. If a sprite fails to load it falls back to official artwork.
- **Cry** button, **favourite** heart (the same favourites set as the Pokédex), **Add to team** (disabled once the team is full or the Pokémon was just added), and links to the Battle page and the Fusion Lab (with this Pokémon as head donor).
- **Navigation**: back, previous/next buttons, arrow keys and horizontal swipe. Ids wrap around between 1 and 1025.
- **Type matchups**: defences grouped into 4x, 2x, 1/2x, 1/4x and immune.
- **Base stats**: six labelled meter bars plus the hexagonal stat radar; both grow in after load.
- **Abilities** (normal and hidden): tap to expand the short effect, fetched on demand.
- **Profile**: gender split (or genderless), catch rate, friendship, generation, egg groups, colour, habitat, and legendary / mythical / baby flags.
- **Evolution tree**: the whole chain with triggers, current Pokémon highlighted, each node links to its page; a message is shown for Pokémon that do not evolve.
- **Moves**: tabs for level-up, TM/HM, egg and tutor; tap a move to load type, stats and effect on demand.
- Visiting a page records the Pokémon in the "recent" list used by the command palette.

## Files

| Path | Responsibility |
| ---- | -------------- |
| `src/app/features/pokemon-detail/pokemon-detail.ts`, `pokemon-detail.html`, `pokemon-detail.scss` | Page component: hero, toggles, navigation, lazy ability/move expansion, move tabs. |
| `src/app/features/pokemon-detail/pokemon-detail.service.ts` | Loads and aggregates pokemon + species + evolution chain into `state`; `ability()` and `move()` lazy loaders; records recents. |
| `src/app/features/pokemon-detail/evolution-tree.ts` | Recursive `pv-evolution-tree` component. |
| `src/app/core/ui/stat-radar/stat-radar.ts`, `radar-geometry.ts` | `pv-stat-radar` component and the shared radar geometry. |
| `src/app/core/ui/stat-bar/stat-bar.ts` | `pv-stat-bar` meter used for the six stats. |
| `src/app/core/models/pokemon.model.ts` | DTO-to-model mappers (`mapPokemon`, `mapSpecies`, `mapEvolutionChain`, `mapAbility`, `mapMoveInfo`). |
| `src/app/core/recent/recent-pokemon.service.ts` | Rolling list of the last 8 visited Pokémon (`recent:pokemon`). |
| `src/app/core/utils/type-chart.ts` | `groupDefenses` for the matchup block. |

## How it works

- The route id is bound to a required component input. An `effect` resets all per-Pokémon UI state (shiny, back, move tab, expanded rows) and calls `PokemonDetailService.load`.
- `load()` fetches the Pokémon, then its species, then the evolution chain (each through the cache-first API client) and publishes one `state` signal, or an error message. `ensureLoaded()` of the Pokédex index is kicked off afterwards so favourites and the team are ready.
- Abilities and moves are fetched only when expanded, and cached in component signals keyed by name.
- Stats start at zero and are swapped for the real values on the next frame (about 40 ms), which animates bars and radar. The BST count-up runs on `requestAnimationFrame`; the reveal timer and the frame are cancelled via `DestroyRef`.
- Swipe is wired with `onSwipe` (threshold 60 px) after first render and gives haptic feedback; it mirrors the arrow keys. Keyboard shortcuts are ignored while typing in a field.
- Learnable moves are filtered by `method` for the active tab.

## Key decisions

- **One aggregate state signal.** The page renders from a single object, with loading and error handled by the shared `pv-state` component (retry reloads).
- **Lazy detail.** Ability and move text is loaded on demand to keep the first render fast.
- **Shared radar geometry.** The radar uses a 180 x 176 box, radius 64 around (90, 86), a fixed 180 maximum and 25/50/75/100 % rings, so the polygon always matches its axes; the Pokédex quick view, compare overlay and showcase use the same functions.
- **Favourites live in the Pokédex service**, and the team in the Team Builder service, so the detail page adds no storage of its own.

## Accessibility & mobile

- Stat bars use `role="meter"` with `aria-valuemin/max/now` and a label; the radar SVG has `role="img"` and a label; the hero's cry, favourite (`aria-pressed`) and shiny (`aria-pressed`) buttons are real labelled buttons. Types are shown as text badges, not colour alone.
- Loading and error states use `pv-state`.
- Single-column baseline; the hero becomes sticky only at the `lg` breakpoint. The evolution tree stacks vertically and goes horizontal from 768 px.
- Swipe left/right changes Pokémon on touch. Animated sprites, sparkle and grow-in motion respect `prefers-reduced-motion`.

## Tests

- `pokemon-detail.spec.ts`: page component behaviour (loading/error, toggles, navigation, lazy ability and move expansion, favourites, team).
- `pokemon-detail.service.spec.ts`: aggregation, error handling, lazy loaders, recent recording.
- `evolution-tree.spec.ts`: recursive rendering and current-node highlight.
- Shared pieces are covered in `core/recent/recent-pokemon.service.spec.ts`, `core/models/pokemon.model.spec.ts` and `core/ui/stat-radar/radar-geometry.spec.ts`.
