# Core Foundation

The shared, framework-light layer every feature builds on: typed data access, caching, persistence, translation, small
platform services and the reusable UI primitives. Pure game math lives next to it in `core/utils` and `game/**`.

## What it does

- A **cache-first PokéAPI client** so the app is fast, offline-capable and respectful of PokéAPI's fair-use policy.
- **View-models and mappers** that translate raw API DTOs into the shapes the UI uses.
- **Versioned persistence**: namespaced, migratable `localStorage` envelopes, a legacy-key import, whole-save backup and a
  separate IndexedDB store for the team.
- A **gettext-style English/German i18n layer** with a lazily loaded German bundle.
- **Platform services**: sound effects, Pokémon cries, haptics, accent theme, recent Pokémon.
- **Shared UI primitives** (icons, badges, stat bars, toasts, modal behaviour, bottom nav, install prompt).
- **Update safety**: idle route preloading and chunk-load recovery after a deploy.
- **Pure utilities** for type effectiveness, stat calculation, natures and a seeded RNG, free of Angular and the DOM.

## Files

| Path | Responsibility |
| ---- | -------------- |
| `src/app/core/dto/pokeapi.dto.ts` | Raw PokéAPI response interfaces (Pokémon, species, evolution chain, type, move, ability, nature, generation, berry flavour). |
| `src/app/core/api/pokeapi-endpoints.ts` | `POKEAPI_BASE`, `SPRITE_BASE`, the `endpoints` builder, `idFromUrl`, `officialArtwork`, `animatedSprite`, `cryUrl`. |
| `src/app/core/api/pokeapi.client.ts` | `PokeApiClient`: generic `get<T>`, typed resource methods, `byUrl`. |
| `src/app/core/api/request-pool.ts` | `Semaphore`, `isRetryableStatus`, `backoffDelay` (pure, no HttpClient). |
| `src/app/core/cache/cache.service.ts` | `CacheService`: IndexedDB `api-cache` plus an in-memory LRU mirror, and a `savegame` store. |
| `src/app/core/models/pokemon.model.ts` | View-models (`PokedexEntry`, `Pokemon`, `SpeciesInfo`, `EvolutionNode`, ...) and `map*` functions. |
| `src/app/core/models/profile.ts` | `ProfileState`, achievements, rank tiers and progress score. |
| `src/app/core/storage/envelope-store.ts` | `EnvelopeStore` (`pv:<key>` envelopes `{ v, data }`) and the shared `appStore` for pure modules. |
| `src/app/core/storage/save.service.ts` | `SaveService`: Angular wrapper with a one-time "progress could not be saved" toast; `readLegacy`, `requestPersistence`. |
| `src/app/core/storage/migrations.ts` | Per-key migration ladder and `LEGACY_SOURCES` (raw keys imported once). |
| `src/app/core/storage/backup.ts` | `buildBackup` / `parseBackup` for whole-save export and import. |
| `src/app/core/storage/safe-storage.ts` | Throw-proof `safeGet` / `safeSet` / `safeRemove`. |
| `src/app/core/i18n/i18n.service.ts` | `I18nService` (locale signal, `t()`, patterns, lazy bundle), `translate.pipe.ts`, `translated-title.strategy.ts`. |
| `src/app/core/i18n/de*.ts` | German dictionary split by domain (`de.ui`, `de.data`, `de.data.game`, `de.data.rpg`), sentence patterns, `de.bundle.ts`. |
| `src/app/core/battle/battler-factory.ts` | `BattlerFactory`: PokéAPI Pokémon to engine `Battler`s, shared by Battle, Arena, Tournaments, Spire, Odyssey. |
| `src/app/core/audio/sfx.service.ts`, `cry.service.ts` | Synthesised WebAudio sound effects; Pokémon cries including `playPair`. |
| `src/app/core/haptics/haptics.service.ts` | `HapticsService`: named vibration patterns, persisted on/off. |
| `src/app/core/theme/theme.service.ts` | Five accent palettes applied as `--accent*` overrides on `<html>`. |
| `src/app/core/recent/recent-pokemon.service.ts` | Rolling list of the last eight visited detail pages. |
| `src/app/core/update/chunk-error.ts`, `idle-preload.ts` | Chunk-load reload handler; `IdlePreloadStrategy`. |
| `src/app/core/ui/**` | Icon, type and status badges, stat bar, stat radar, spinner, page header, `pv-state`, toasts, modal directive, bottom nav, install prompt, field banner, weather overlay, gestures, image fallback, `format.ts`. |
| `src/app/core/utils/type-chart.ts`, `stat-calculator.ts`, `natures.ts`, `rng.ts` | Type chart, Gen III+ stat formulas, the 25 natures, `SeededRng` and `dailySeed`. |
| `src/app/core/version.ts` | `APP_VERSION`, shown in the footer. |

## How it works

- **API client.** `PokeApiClient.get<T>(url, ttl?)` first looks in an in-flight map and registers its promise
  synchronously, so concurrent callers share one request before the cache is even consulted. `load` then checks
  `CacheService` (memory, then IndexedDB), then a 60-second memory of 404s (a missing id does not hit the network again and
  throws the same `HttpErrorResponse`), then fetches through a `Semaphore` of six concurrent requests with a 15-second
  timeout and up to two retries with jittered exponential backoff on network errors, 408, 429 and 5xx. Successful bodies
  are cached off the critical path. `byUrl` follows a link from an API response but rejects anything outside `pokeapi.co`.
- **Cache.** Entries carry `fetchedAt` and `expiresAt` (7 days by default). The memory mirror evicts least-recently-used
  entries beyond 400, expired rows are swept once per session when idle, and a blocked or terminated connection is reopened
  lazily. A second object store, `savegame`, holds the Team Builder's team.
- **Persistence.** `SaveService.read/write/remove` store values as `{ v, data }` under `pv:<key>`. `v` selects the migration
  ladder in `MIGRATIONS`; keys that used to be raw (`arena:*`, `spire:meta`, `odyssey:meta`, `tournaments:*`) are imported
  once from their legacy slot and the old key is removed. An unreadable blob is kept as `pv:<key>:corrupt` (first copy only)
  and the fallback is returned. Pure `game/**` modules use `appStore`; components and services inject `SaveService`. A few
  device preferences (`pv:locale`, `sfx:*`, `cry:muted`) are plain strings written through `safe-storage.ts` instead.
- **Backup.** `isOwnedKey` limits export and import to this app's prefixes; `parseBackup` validates untrusted text (format,
  string values, valid JSON, size and entry caps). The API cache is excluded.
- **i18n.** The English source text is the key. `t()` looks up the exact string, then sentence patterns with `{}` slots
  (captures are translated recursively), then a "Speaker: line" split, then falls back to English. The German bundle is a
  dynamic import fetched when the locale is German, and the app initializer waits for it. The locale persists under
  `pv:locale` and sets `<html lang>`.
- **Update safety.** A navigation failure caused by a missing hashed chunk reloads once per minute, then shows an "Update
  available" toast. Routes marked `data: { preload: true }` preload 2.5 seconds after settling, never on Data Saver or 2g.

## Key decisions

- **Cache-first with in-flight de-duplication** keeps bursts of components to one fetch and works offline.
- **DTO is not model.** The API shape never reaches templates; mappers are the single translation point.
- **Static game data.** The type chart and natures are hard-coded so battle maths is deterministic and needs no network.
- **Persistence is versioned from day one.** New shapes append a migration instead of editing old data; raw keys are
  imported once, never read twice.
- **Defensive storage.** Every `localStorage` access can throw (private mode, blocked data); each wrapper degrades to a
  fallback, and a failed write is reported once instead of losing progress silently.
- **Graceful degradation.** Without IndexedDB the memory cache still works and writes fail quietly.
- **Strict toolchain.** TypeScript runs with `strict`, `noUncheckedIndexedAccess`, `noPropertyAccessFromIndexSignature` and
  more; templates use `strictTemplates` with extended diagnostics as errors; ESLint uses the type-aware recommended set
  and Prettier checks formatting (`npm run verify` runs the gates).

## Accessibility & mobile

- `pv-spinner` renders `role="status"` with a label; `pv-state` announces errors with `role="alert"`; `pv-stat-bar` is a
  `role="meter"` with min, max, now and label.
- `ModalDirective` moves focus in, traps Tab, closes on Escape, makes the page behind `inert`, locks scroll and restores
  focus on close.
- `HapticsService` stays silent when the device lacks vibration, the user disabled it or reduced motion is requested.
- `installImageFallback` swaps any permanently broken `<img>` for a placeholder so layouts never show broken icons.
- `gestures.ts` provides a dependency-free swipe and tap detector for touch screens.

## Tests

- API: `pokeapi.client.spec.ts`, `pokeapi-endpoints.spec.ts`, `request-pool.spec.ts`; cache: `cache.service.spec.ts`.
- Storage: `envelope-store.spec.ts`, `save.service.spec.ts`, `save.service.edge.spec.ts`, `migrations.spec.ts`,
  `legacy-import.spec.ts`, `backup.spec.ts`, `safe-storage.spec.ts`.
- i18n: `i18n.service.spec.ts`, `translate.pipe.spec.ts`, `translated-title.strategy.spec.ts`.
- Update: `chunk-error.spec.ts`, `idle-preload.spec.ts`, `idle-preload-strategy.spec.ts`.
- Services: `battler-factory.spec.ts`, `sfx.service.spec.ts`, `sfx.service.more.spec.ts`, `cry.service.spec.ts`,
  `haptics.service.spec.ts`, `theme.service.spec.ts`, `recent-pokemon.service.spec.ts`, `recent-pokemon.spec.ts`.
- Models and utils: `pokemon.model.spec.ts`, `profile.spec.ts`, `type-chart.spec.ts`, `stat-calculator.spec.ts`,
  `natures.spec.ts`, `rng.spec.ts`, `format.spec.ts`.
- UI: `display-components.spec.ts`, `interactive-components.spec.ts`, `modal.spec.ts`, `toast.service.spec.ts`,
  `gestures.spec.ts`, `image-fallback.spec.ts`, `radar-geometry.spec.ts`, `weather-overlay.spec.ts`.
