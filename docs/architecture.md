# Architecture — PokéVerse Arena

## Folder structure

```
src/app/
  core/
    api/        PokeAPI typed client, endpoint builders
    cache/      IndexedDB-backed response cache
    storage/    savegame / progression persistence
    models/     app view-models (separate from raw API DTOs)
    dto/        raw PokéAPI response shapes
    utils/      type-effectiveness, stat-calculator, seeded RNG
    ui/         shared presentational components (badges, stat bars, spinner)
  features/
    home/           landing page (+ lazy 3D hero)
    pokedex/        list + filters
    pokemon-detail/ detail page (stats, moves, evolution)
    type-lab/       type chart + team weakness analyzer
    team-builder/   build & validate teams
    battle/         turn-based engine + Angular UI + Pixi scene
    arena/          type-themed gyms (later)
    tournaments/    brackets (later)
    world-explorer/ regions & encounters (later)
    berry-garden/   berry growing minigame (later)
    contests/       contest mode (later)
    profile/        savegame, collection, achievements
  game/
    engine/   pure battle math (damage, AI, move resolver)
    pixi/     Pixi battle scene + Angular bridge
```

## Key principles
- **DTO ≠ Model.** Raw PokéAPI shapes live in `core/dto`; mapped, ergonomic
  view-models live in `core/models`. Mappers convert at the API boundary.
- **Signals for state.** Feature services expose `signal`/`computed`; components
  stay thin and declarative.
- **Pure battle math.** Damage, type effectiveness and RNG are pure functions →
  fully unit-testable and deterministic via a seeded RNG.
- **Cache-first networking.** `PokeApiClient` always asks the cache before the
  network; large payloads are persisted to IndexedDB.
- **Lazy everything heavy.** Battle (Pixi) and the 3D hero (Three.js) are lazy
  routes/components so the Pokédex bundle stays small.
- **Accessibility.** Reduced-motion flag, keyboard navigation, type info never
  conveyed by color alone (icon + label too).

## Data flow

```
Component (signals)
   │  calls
   ▼
Feature Service ──► PokeApiClient ──► CacheService (IndexedDB) ──► network
   ▲                                        │
   └──────────────── mapped Model ◄── DTO ──┘
```
