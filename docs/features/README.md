# Feature Documentation — PokéVerse Arena

One document per feature, each describing the **current** code: what it does, the files involved, how it works, the
decisions behind it, accessibility/mobile notes and which specs cover it. Release history lives in the
[changelog](../changelog.md); finished plans are in [../archive/](../archive/).

For the milestones see [../roadmap.md](../roadmap.md), for the folder structure and principles
[../architecture.md](../architecture.md).

## Index

| Feature | Doc | Route |
| ------- | --- | ----- |
| Core foundation (API client, cache, storage, models, utils) | [core-foundation.md](core-foundation.md) | — |
| App shell (theme, routing, navigation, install prompt, toasts) | [app-shell.md](app-shell.md) | — |
| Home & 3D hero (Three.js, daily cards) | [home.md](home.md) | `/` |
| Pokédex (list, search, filters, compare, quick view, Who's That?) | [pokedex.md](pokedex.md) | `/pokedex` |
| Pokémon detail (stats, radar, evolution, moves) | [pokemon-detail.md](pokemon-detail.md) | `/pokemon/:id` |
| Type Lab (chart, calculator, coverage) | [type-lab.md](type-lab.md) | `/type-lab` |
| Team Builder (build, tune, analyze, export/import) | [team-builder.md](team-builder.md) | `/team-builder` |
| Battle (engine, arena UI, daily challenge) | [battle.md](battle.md) | `/battle` |
| Arena (gym ladder, Elite Four, Champion gauntlet) | [arena.md](arena.md) | `/arena` |
| Tournaments (ten modes, three formats, rival, pick'em) | [tournaments.md](tournaments.md) | `/tournaments` |
| Ascension Spire (seeded roguelike climb, resumable) | [spire.md](spire.md) | `/spire` |
| Odyssey (endless biome march, daze-catch, starter unlocks) | [odyssey.md](odyssey.md) | `/odyssey` |
| World Explorer (regions, native dex, expeditions) | [world.md](world.md) | `/world` |
| Fusion Lab (deterministic splicing, Fusion Dex, share links) | [fusion-lab.md](fusion-lab.md) | `/fusion` |
| Contest Hall (Poffins, multi-round appeals, ranks) | [contest.md](contest.md) | `/contest` |
| Stat Showdown (higher-or-lower duel) | [showdown.md](showdown.md) | `/showdown` |
| Trainer Profile (progress, achievements, themes, backup) | [profile.md](profile.md) | `/profile` |
| ⌘K Command Palette (search, actions, recents) | [command-palette.md](command-palette.md) | global |

The Adventure (RPG) is documented separately: [rpg.md](rpg.md) and the `rpg-*.md` plans in [../](../).

## Cross-cutting docs

- [PWA, accessibility & mobile](../pwa.md) — installable PWA, service worker, a11y.
- [Mobile-first guidelines](../mobile-first.md) — breakpoints, rules, checklist.
- [Internationalisation](../i18n.md) — the English/German layer and how to add text.
- [Technical decisions](../tech-decisions.md) — why PixiJS, Three.js, idb.
- [Acceptance & quality gates](../acceptance.md) — tests, coverage, browser suite, Lighthouse.
- [Deployment & CI](../deployment.md).

## Conventions every feature follows

- **Standalone components**, `ChangeDetectionStrategy.OnPush`, zoneless, signals everywhere.
- **DTOs** live in `core/dto`; **view-models + mappers** in `core/models`.
- **Cache-first** data access through `PokeApiClient` (memory + IndexedDB).
- **Pure, testable logic** in `game/**` and `core/utils` — no Angular imports, seeded RNG.
- **Persistence** through `SaveService` / `EnvelopeStore` (versioned `pv:` keys), never raw `localStorage`.
- **Mobile-first SCSS** via `@use '../../../styles/responsive' as *;` + `@include up(...)`.
- **Loading / error / empty** states in every data-driven view (`pv-state`).
- **Reduced motion** respected wherever something animates; dialogs use `pvModal`.
- **Every non-RPG file is covered by unit specs** (thresholds in `angular.json`); GPU rendering and the Adventure are covered by the browser flows.
