# Core Foundation

The shared, framework-light layer every feature builds on. No UI here — just
typed data access, caching and pure game math.

## What it provides

- A **cache-first PokéAPI client** so the app is fast, offline-capable and
  respectful of PokéAPI's fair-use policy.
- **View-models + mappers** that translate raw API DTOs into ergonomic shapes.
- **Pure utilities** for type effectiveness, stat calculation, natures and a
  seeded RNG — all unit-tested and free of Angular/DOM dependencies.

## Files

| File | Responsibility |
| ---- | -------------- |
| `core/dto/pokeapi.dto.ts` | Raw PokéAPI response interfaces (Pokemon, Species, Evolution, Type, Move, Ability, Nature, Generation). |
| `core/api/pokeapi-endpoints.ts` | `POKEAPI_BASE`, `SPRITE_BASE`, the `endpoints` builder, `idFromUrl()`, `officialArtwork(id, shiny)`. |
| `core/api/pokeapi.client.ts` | `PokeApiClient` — generic cache-first `get<T>()` with in-flight de-duplication + typed resource methods. |
| `core/cache/cache.service.ts` | `CacheService` — `idb`-backed cache with an in-memory mirror, TTL (7 days default) and a separate `savegame` store. |
| `core/models/pokemon.model.ts` | View-models (`PokedexEntry`, `Pokemon`, `SpeciesInfo`, `EvolutionNode`, …) + mappers. |
| `core/utils/type-chart.ts` | Gen VI type chart + `singleEffectiveness`, `effectiveness`, `defensiveProfile`, `offensiveProfile`, `analyzeTeamTypes`. |
| `core/utils/stat-calculator.ts` | Gen III+ stat formulas: `calcHp`, `calcStat`, `quickStats`. |
| `core/utils/natures.ts` | The 25 natures + `natureByName`, `natureSummary`. |
| `core/utils/rng.ts` | `SeededRng` (mulberry32) + `dailySeed()` for deterministic randomness. |
| `core/ui/format.ts` | `titleCase`, `padId`, `typeColorVar`, `metersToFeet`, `kgToLbs`. |

## Key decisions

- **Cache-first with in-flight de-dup.** `get<T>()` checks memory → IndexedDB →
  network. Concurrent requests for the same URL share one promise so a burst of
  components only triggers one fetch.
- **DTO ≠ Model.** The API shape never leaks into the UI; mappers are the single
  translation point, which keeps components stable if the API changes.
- **Static game data.** Type chart and natures are hard-coded so battle/analysis
  math is deterministic and testable, and needs zero network calls.
- **Graceful degradation.** When IndexedDB is unavailable (private mode), the
  memory cache still works; writes fail silently.

## Tests

`type-chart.spec.ts`, `stat-calculator.spec.ts`, `natures.spec.ts`, `rng.spec.ts`
— 27 passing. Run with `npx ng test --watch=false`.
