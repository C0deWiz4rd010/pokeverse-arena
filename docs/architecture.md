# Architecture — PokéVerse Arena

Angular 22 (standalone components, signals, zoneless, `OnPush` everywhere) with lazily loaded feature routes. Heavy
engines (PixiJS, Three.js) and the German dictionary are separate chunks. TypeScript is strict including
`noUncheckedIndexedAccess` and `strictTemplates`; ESLint is type-aware and runs with `--max-warnings 0`.

## Folder structure

```
src/app/
  core/
    api/        PokeApiClient (throttled, retrying, deduplicated, 404 memo), endpoint builders
    battle/     BattlerFactory — builds engine-ready Battlers from PokéAPI data (shared by every battle mode)
    cache/      CacheService — IndexedDB response cache (TTL sweep, LRU memory mirror) + the savegame store
    storage/    EnvelopeStore + SaveService (versioned `pv:` saves, legacy-key import), migrations, backup,
                safe-storage helpers (plain preferences only)
    dto/        raw PokéAPI response shapes
    models/     app view-models (mapped from DTOs at the API boundary)
    i18n/       English/German: I18nService, `t` pipe, lazy dictionary split by domain (see i18n.md)
    audio/      CryService (pooled voices), SfxService (WebAudio sound effects)
    haptics/    HapticsService (named vibration patterns)
    theme/      accent palettes        update/  chunk-load + new-version handling, idle preloading
    ui/         shared components: pvModal directive, pv-state, toasts, badges, move button, stat bar/radar,
                bottom nav, install prompt, weather overlay, field banner …
    utils/      type chart, stat calculator, natures, seeded RNG
  game/         pure, deterministic, unit-tested game logic — no Angular imports
    engine/     BattleCore (shared turn mechanics) + Battle (1v1) / TeamBattle (parties) hosts, damage, AI,
                status / weather / terrain / hazards / field-effects, abilities, items, move-convert (PokéAPI → engine)
    tournament/ brackets, league (round-robin / Swiss), match-runner, trainers, odds, rival, history, pick'em
    arena/      gym leaders, progression, Elite Four, match-setup     spire/ relics, floors, meta
    odyssey/ contest/ fusion/ team/ world/ daily/ showdown/
    run/        run-economy (coins, relics, items) and run-snapshot (resume parsing) shared by Spire & Odyssey
    evolution/  level-up evolution helpers (re-exported by game/rpg)
    rpg/        maps, movement, encounters, catch, xp, time of day, save sanitising
  features/     routed screens + their feature services (signals)
    home pokedex pokemon-detail type-lab team-builder battle arena tournaments spire odyssey
    world fusion contest showdown profile command-palette
    battle/     presenter base, view helpers, chips; pixi/battle-fx.ts — GPU effects over the CSS arena
    tournaments/ the party match component + facade over roster / records services
    rpg/        Adventure: RpgService, overworld (canvas + Pixi renderers sharing input.ts), RPG battle, menus
src/styles/     theme.scss (tokens), _responsive.scss (breakpoints + mixins)
public/         sw.js, manifest, icons, tilesets
tools/          postbuild, i18n check/scan, ui-shots, e2e (adventure, flows, offline), acceptance, perf, serve-dist
```

## Key principles

- **DTO ≠ model.** Raw PokéAPI shapes live in `core/dto`; ergonomic view-models in `core/models`.
- **Pure game logic.** `game/**` has no Angular or browser dependencies, uses a seeded RNG and is covered by specs.
  Services only fetch data and call into it (`convertMove` maps API moves, the engine resolves them).
- **One battle core.** `Battle` and `TeamBattle` are thin hosts over `BattleCore`; a replay golden master hashes 80 seeded
  battles so refactors cannot change behaviour unnoticed.
- **Signals for state.** Feature services expose `signal`/`computed`; components stay thin. Big services are facades over
  small ones (tournaments → roster / records; arena → progress / teams / gauntlet).
- **Cache-first networking.** `PokeApiClient` registers the in-flight request first, then asks the cache, caps concurrency (6),
  retries 429/5xx with jitter, remembers 404s for a minute and only follows PokéAPI links. Everything cached survives offline.
- **One persistence layer.** Game progress goes through the versioned `EnvelopeStore` (`SaveService` in Angular code, the shared
  `appStore` in pure `game/**` modules): `{ v, data }` envelopes under `pv:`, a migration ladder, one-time import of old raw keys,
  a `…:corrupt` copy of unreadable blobs and a toast when a write fails. Spire and Odyssey runs are snapshots that resume.
- **Lazy everything heavy.** Pixi, Three.js and the German dictionary load on demand; routes are lazy with idle preloading;
  budgets in `angular.json` keep the initial bundle under 520 kB.
- **One input layer.** Keyboard, on-screen pad, swipe, tap and gamepad share `rpg/overworld/input.ts` for both renderers.
- **Responsive by tokens.** Fluid tokens and shared mixins instead of per-component media queries (see mobile-first.md).
- **Accessible by default.** Real buttons, `pvModal` dialogs (focus trap, inert background, scroll lock), `progressbar` HP bars,
  `meter` stat bars, AA contrast, reduced motion and `hover-capable` gating, German/English UI.
- **Honest tests.** Coverage is measured over all of `src/app` (minus the Adventure UI, GPU rendering and data files), see
  [acceptance.md](acceptance.md).

## Rendering

- **Adventure (Pixi):** tiles live in 8×8 chunks that are hidden off-screen; animation is delta-time based; particles are pooled
  sprites; the loop sleeps when the tab is hidden, scrolled out of view or the GL context is lost; quality degrades itself when
  frames stay slow. A canvas-2D renderer is the fallback for reduced motion / no WebGL.
- **Battle:** CSS arena with a Pixi overlay (`BattleFxComponent`) that only ticks while particles exist and aims at the real sprites.
- **Hero:** Three.js scene, gated by data-saver / reduced motion / device memory, paused when unseen.
- Pixi runs through its `pixi.js/unsafe-eval` build, so the CSP needs no `'unsafe-eval'`.

## Data flow

```
Component (signals)
   │  calls
   ▼
Feature Service ──► PokeApiClient ──► CacheService (IndexedDB) ──► network
   ▲                                        │
   └──────────────── mapped Model ◄── DTO ──┘
          │
          ├─► game/** (pure engine, seeded RNG)
          └─► SaveService / EnvelopeStore ──► localStorage (`pv:` keys, versioned)
```
