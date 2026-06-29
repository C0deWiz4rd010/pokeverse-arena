# RPG Overhaul — "High-End Pixel Action-RPG" (PixiJS + CC0 art + onboarding)

## Context
The RPG mode works mechanically (overworld, wild/trainer battles, catching, XP,
gym/badge) but two things fail the user: (1) **battles feel impossible to trigger**
— encounters are gated behind `party.length > 0` in
[rpg.service.ts `commitStep`](src/app/features/rpg/rpg.service.ts) and the only way to
get a starter is to find Prof. Oak's Lab, which the onboarding barely signposts; and
(2) the **canvas overworld looks basic**, not the "high-end pixel action-RPG" the user
wants. This overhaul keeps the proven pure logic and rebuilds **presentation +
onboarding**: a PixiJS (WebGL) overworld with real CC0 pixel tilesets and
action-RPG effects, a guided intro that puts a starter + first battle in the first
~30 seconds, and juiced-up battle visuals.

**Decisions (confirmed):** Kenney **CC0** packs (downloaded + committed to `public/`);
**full PixiJS** overworld rewrite; **augment** the existing battle UI with action FX
(not a full battle rewrite). PixiJS (not Three.js) because this is 2D pixel art —
Pixi v8 is already a dependency and is already lazy-loaded by the battle FX.

## Assets (CC0 — safe to commit)
- **Kenney "Tiny Town"** (16×16, CC0): outdoor — grass/path/water/trees/houses/roofs/
  fences/flowers + townsfolk sprites. Direct zip:
  `https://kenney.nl/media/pages/assets/tiny-town/.../kenney_tiny-town.zip`.
- **Kenney "Tiny Dungeon"** (16×16, CC0): interiors — floors/walls/props/counters.
- Download during implementation via `curl`, extract the packed sheets to
  `public/rpg/tilesets/` + add `public/rpg/LICENSE.md` (CC0, credit Kenney).
- **Fallback** (if the download is blocked in this env): generate a 16×16 atlas
  procedurally to a canvas→texture so the feature still ships; swap art in later.
- Player/NPC walk: use Tiny Town character sprites with a 2-frame step-bob + L/R
  flip (front/back variants where the sheet provides them). Pokémon stay PokéAPI
  sprites in battle (already used); overworld uses generic CC0 characters only
  (Pokémon overworld sprites are copyrighted — avoided).

## Architecture
**Keep all pure logic** in `game/rpg/**` (maps, movement, encounters, xp, party,
catch, save) and the `RpgService` API unchanged — this is presentation + content.

**New PixiJS overworld — `features/rpg/overworld/`:**
- `atlas.ts` — lazy `Assets.load` the Kenney sheets; slice into per-index 16×16
  textures; `tileTexture(kind)` (TileKind→atlas index map) + `charTexture(key,dir,frame)`.
- `pixi-overworld.ts` — a lazy-loaded Pixi `Application` mounted in the component:
  - **Tilemap**: cull to the camera; cache the static layer to a `RenderTexture`;
    animated water/grass via frame swap.
  - **Entities**: player + NPC `Sprite`s with walk bob/flip; ground-item Poké Balls.
  - **Camera**: eased follow; integer-snapped for crisp pixels; `roundPixels`.
  - **Effects layer**: vignette + soft radial player light (additive blend),
    day/night color tint (time-based), weather particles (rain/snow) on routes,
    step-dust + grass-rustle + sparkle particles (lightweight custom emitter), and
    a battle **encounter transition** (flash → shake → zoom/wipe).
  - Reuses `RpgService` for movement/warps/interact; input = keyboard + the existing
    on-screen D-pad/A-B overlay (HTML over the Pixi canvas).
  - Reduced-motion / no-WebGL → keep the current `overworld.ts` canvas renderer as a
    graceful fallback (component picks one at init).
- `overworld.ts` (current canvas) demoted to fallback; `tile-renderer.ts` kept for it.

**Battle FX augment — `features/rpg/battle/rpg-battle.*`:**
- Add the existing `<pv-battle-fx>` Pixi layer (as tournament-match does) and call
  `cast()`/`impact()` for type-coloured attack bursts + impact particles.
- Animated sprites via `animatedSprite()` ([pokeapi-endpoints.ts](src/app/core/api/pokeapi-endpoints.ts)) with static fallback;
  **hitstop** (micro-pause on hit), stronger screen-shake, and an entry transition
  continuous with the overworld wipe. (Floating numbers / send-out / faint already exist.)

**Onboarding & gameplay overhaul — `features/rpg/` + maps:**
- **Guided intro**: New Game → short Mom/rival lines → step outside → the Lab is
  adjacent and flagged; Prof. Oak hands a starter in the first beats (keep the 3-way
  choice). Encounters stop being a hidden gate.
- **Objective banner** (signal-driven by flags): "▶ Choose a starter at the Lab" →
  "▶ Battle in the tall grass" → "▶ Beat the Oakhaven Gym", with an on-map arrow to
  the next target.
- **Discoverable battles**: animated tall grass, a clear encounter **flash→battle**
  transition, a slightly higher first-patch rate, and a tutorial NPC explaining
  move/catch. Controls hint stays visible.
- Keep `whiteout`/Center heal; ensure the very first fight is reachable in seconds.

**Files (representative):** `public/rpg/tilesets/*`, `public/rpg/LICENSE.md`;
`features/rpg/overworld/{atlas,pixi-overworld}.ts`; edits to
`features/rpg/overworld/overworld.ts` (fallback), `features/rpg/rpg.ts/.html/.scss`
(host Pixi + objective banner), `features/rpg/rpg.service.ts` (objective/flag
helpers, intro script, first-battle guarantee), `features/rpg/battle/rpg-battle.*`
(battle FX), `game/rpg/maps/*` (intro tweaks, arrows), `docs/features/rpg.md`.

## Reuse
PixiJS lazy-import pattern + `pv-battle-fx` ([battle-fx.ts](src/app/features/battle/pixi/battle-fx.ts)); `animatedSprite`/`officialArtwork`/`SPRITE_BASE`;
`CryService`; `RpgService` + all `game/rpg/**` logic; `SeededRng`; CSS tokens; the
existing D-pad overlay + reduced-motion patterns.

## Delivery (phased; each: `ng build` clean · `vitest run` green · Playwright smoke desktop+mobile, 0 console errors · commit on `develop`)
- **A — Assets + Pixi tilemap overworld**: download/commit Kenney CC0; atlas loader;
  Pixi renderer at parity with current maps (tiles, player/NPC, camera, movement,
  warps, touch); canvas fallback retained.
- **B — Action-RPG effects**: lighting/vignette, day/night, particles, grass rustle,
  screen shake, weather, encounter transition.
- **C — Onboarding/gameplay**: intro flow, immediate starter, objective banner +
  arrow, discoverable first battle, tutorial NPC.
- **D — Battle FX augment**: Pixi `battle-fx` + animated sprites + hitstop + transition.
- **E — Polish/perf/docs**: perf (cull/RenderTexture), reduced-motion + no-WebGL
  fallback verified, update `docs/features/rpg.md` + roadmap.

## Verification
- `npx vitest run` green (pure logic unchanged; add tests for any new pure helpers,
  e.g. objective/flag derivation, atlas index map).
- `npx ng build` clean; watch initial-bundle budget (Pixi stays lazy).
- **E2E (Playwright, desktop 1280 + mobile 390):** New Game → guided intro →
  starter in hand → walk → **grass encounter fires with a transition** → fight (FX) →
  catch → heal → trainer → gym → badge. Assert **0 console errors**, the objective
  banner advances, reduced-motion uses the canvas fallback with instant hops, and
  the Pixi canvas actually renders (non-blank) on desktop + mobile.
