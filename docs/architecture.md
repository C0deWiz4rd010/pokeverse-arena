# Architecture — PokéVerse Arena

Angular 22 (standalone components, signals, zoneless, `OnPush` everywhere) with lazily loaded
feature routes. Heavy engines (PixiJS, Three.js) and the German dictionary are separate chunks.

## Folder structure

```
src/app/
  core/
    api/        PokeApiClient (throttled, retrying, deduplicated), endpoint builders
    cache/      CacheService — IndexedDB response cache (TTL sweep, LRU memory mirror)
    storage/    SaveService, safe-storage helpers, save migrations, backup/export-import
    dto/        raw PokéAPI response shapes
    models/     app view-models (mapped from DTOs at the API boundary)
    i18n/       English/German: I18nService, `t` pipe, lazy dictionary (see i18n.md)
    audio/      CryService (pooled voices), SfxService (WebAudio sound effects)
    haptics/    HapticsService (named vibration patterns)
    theme/      accent palettes        update/  chunk-load + new-version handling
    ui/         shared components: modal directive, pv-state, toasts, type/status badges, move button …
    utils/      type chart, stat calculator, seeded RNG
  game/         pure, deterministic, unit-tested game logic — no Angular imports
    engine/     battle, damage, AI, status/weather/terrain/hazards, move-convert (PokéAPI → engine)
    rpg/        maps, movement, encounters, catch, xp, evolution, time of day, save sanitising
    arena/ tournament/ spire/ odyssey/ contest/ fusion/ team/ world/ daily/ showdown/
  features/     routed screens + their feature services (signals)
    home pokedex pokemon-detail type-lab team-builder battle arena tournaments spire odyssey
    world fusion contest showdown profile command-palette
    rpg/        Adventure: RpgService, overworld (canvas + Pixi renderers sharing input.ts), RPG battle, menus
    battle/pixi battle-fx.ts — type-specific GPU effects over the CSS arena
src/styles/     theme.scss (tokens), _responsive.scss (breakpoints + mixins)
public/         sw.js, manifest, icons, tilesets
tools/          postbuild, i18n check/scan, ui-shots, e2e, acceptance, perf, serve-dist, icon generator
```

## Key principles

- **DTO ≠ model.** Raw PokéAPI shapes live in `core/dto`; ergonomic view-models in `core/models`.
- **Pure game logic.** `game/**` has no Angular or browser dependencies, uses a seeded RNG and is covered by specs.
  Services only fetch data and call into it (e.g. `convertMove` maps API moves, the engine resolves them).
- **Signals for state.** Feature services expose `signal`/`computed`; components stay thin.
- **Cache-first networking.** `PokeApiClient` asks the cache first, caps concurrency (6), retries 429/5xx with jitter and
  dedupes in-flight requests. Everything cached survives offline.
- **Defensive storage.** All `localStorage` access goes through `safe-storage`; saves are versioned and migrated, imported
  or loaded RPG saves are sanitised, quota errors surface as a toast.
- **Lazy everything heavy.** Pixi, Three.js and the German dictionary load on demand; routes are lazy with idle preloading.
- **One input layer.** Keyboard, on-screen pad, swipe, tap and gamepad share `rpg/overworld/input.ts` for both renderers.
- **Responsive by tokens.** Fluid tokens and shared mixins instead of per-component media queries (see mobile-first.md).
- **Accessible by default.** Real buttons, focus-trapping `pvModal` dialogs, `progressbar` HP bars, AA contrast, reduced
  motion and `hover-capable` gating, German/English UI.

## Rendering

- **Adventure (Pixi):** tiles live in 8×8 chunks that are hidden off-screen; animation is delta-time based; particles are pooled
  sprites; the loop sleeps when the tab is hidden, scrolled out of view or the GL context is lost; quality degrades itself when
  frames stay slow. A canvas-2D renderer is the fallback for reduced motion / no WebGL.
- **Battle:** CSS arena with a Pixi overlay (`BattleFxComponent`) that only ticks while particles exist and aims at the real sprites.
- **Hero:** Three.js scene, gated by data-saver / reduced motion / device memory, paused when unseen.

## Data flow

```
Component (signals)
   │  calls
   ▼
Feature Service ──► PokeApiClient ──► CacheService (IndexedDB) ──► network
   ▲                                        │
   └──────────────── mapped Model ◄── DTO ──┘
          │
          └─► game/** (pure engine, seeded RNG)
```
