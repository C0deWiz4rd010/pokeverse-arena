# Feature Documentation — PokéVerse Arena

This folder documents every shipped feature in detail: what it does, the files
involved, key design decisions and how the pieces fit together. Each feature was
shipped to `develop` as a focused, multi-line commit.

For the high-level plan and milestone status, see
[../roadmap.md](../roadmap.md). For the architecture and folder conventions, see
[../architecture.md](../architecture.md).

## Index

| # | Feature | Doc | Status |
| - | ------- | --- | ------ |
| 1 | Core foundation (API client, cache, models, utils) | [core-foundation.md](core-foundation.md) | ✅ |
| 2 | App shell (theme, routing, navigation) | [app-shell.md](app-shell.md) | ✅ |
| 3 | Home & 3D hero (Three.js) | [home.md](home.md) | ✅ |
| 4 | Pokédex (list, search, filters, infinite scroll) | [pokedex.md](pokedex.md) | ✅ |
| 5 | Pokémon detail (stats, radar, evolution, moves) | [pokemon-detail.md](pokemon-detail.md) | ✅ |
| 6 | Type Lab (chart, calculator, coverage) | [type-lab.md](type-lab.md) | ✅ |
| 7 | Team Builder (build, tune, analyze, persist) | [team-builder.md](team-builder.md) | ✅ |
| 8 | Battle engine + UI (seeded combat, animated arena, weather, daily challenge) | [battle.md](battle.md) | ✅ |
| 9 | Tournaments (10 modes, visual bracket, 3-v-3 matches) | [tournaments.md](tournaments.md) | ✅ |
| 10 | Arena (type-themed gym leaders, badges) | [arena.md](arena.md) | ✅ |
| 11 | World Explorer (regions, native dex, home finder, **expeditions**) | [world.md](world.md) | ✅ |
| 12 | Contest Hall (berry Poffins, **multi-round appeals + ranks**) | [contest.md](contest.md) | ✅ |
| 13 | Ascension Spire (seeded roguelike climb) | [spire.md](spire.md) | ✅ |
| 14 | Trainer Profile (progression backbone, achievements, accent themes) | [profile.md](profile.md) | ✅ |
| 15 | ⌘K Command Palette (global search, actions, recents) | [command-palette.md](command-palette.md) | ✅ |
| 16 | Odyssey (endless biome roguelike, daze-catch, starter unlocks) | [odyssey.md](odyssey.md) | ✅ |

## Deep Systems Overhaul (v2)

A ground-up deepening of the shared battle engine and every system that runs on
it. The engine now models **status conditions, stat stages, abilities, held
items, in-battle weather & terrain, entry hazards, secondary move effects,
multi-hit/drain/recoil and real switching** — all pure, seeded and unit-tested.
Battle, Arena, Tournaments and the new Spire inherit that depth; Arena gained a
designed gym ladder + Champion Gauntlet, Tournaments gained formats (round-robin
/ Swiss) + standings + prizes, and a Trainer Profile ties all progress together.
See [../plan.md](../plan.md).

## Cross-cutting docs

- [PWA, accessibility & mobile](../pwa.md) — installable PWA, service worker, a11y.
- [Mobile-first guidelines](../mobile-first.md) — breakpoints, rules, checklist.
- [Technical decisions](../tech-decisions.md) — why PixiJS, Three.js, idb, GSAP.
- [Architecture](../architecture.md) — folder structure & principles.

## Conventions every feature follows

- **Standalone components**, `ChangeDetectionStrategy.OnPush`, signals everywhere.
- **DTOs** live in `core/dto`; **view-models + mappers** in `core/models`.
- **Cache-first** data access through `PokeApiClient` (memory + IndexedDB).
- **Pure, testable logic** (type chart, stat math, RNG, natures) in `core/utils`.
- **Mobile-first SCSS** via `@use '../../../styles/responsive' as *;` + `@include up(...)`.
- **Loading / error / empty** states handled in every data-driven view.
- **Reduced motion** respected wherever something animates.
