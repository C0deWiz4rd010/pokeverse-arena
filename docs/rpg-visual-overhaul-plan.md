# RPG Visual Overhaul — "Ultimate Modern Look"

The RPG mode is mechanically mature (v3.1: full story to Champion, PixiJS WebGL
overworld, battle FX, weather, day/night, Nuzlocke). This overhaul is **purely
presentation**: make it look modern, cool and beautiful across all five axes —
overworld tiles, battle scene, canvas fallback, character customization and
lighting/post-processing. Pure logic in `game/rpg/**` stays untouched; the
standalone `rpg:save` stays compatible (migration for new fields).

## Decisions
- Tileset strategy: **layer additional CC0 packs** on top of the existing CC0
  Ninja Adventure pack (Kenney Roguelike/RPG + Tiny Town) for cliffs, props,
  furniture and deco variety.
- License: **CC0 + CC-BY (attribution) allowed** — no paid packs; credits added
  to `public/rpg/LICENSE.md`.
- Renderer: keep the PixiJS WebGL overworld as the main path; upgrade the crude
  canvas fallback to draw real atlas art (static) so reduced-motion / no-WebGL
  users also get the pretty version.

## Key architecture
- Two renderers, shell `features/rpg/rpg.ts` picks one: `overworld/pixi-overworld.ts`
  (main, WebGL) vs `overworld/overworld.ts` + `overworld/tile-renderer.ts` (fallback).
- `overworld/atlas.ts` maps `TileKind` → sheet index; multi-sheet via `SHEET_URL`/
  `SHEET_COLS`; `TILE_ART`, `GRASS_VARIANTS` (only 1 today!), autotile `blob()` +
  `pathAutoIndex`/`wallAutoIndex`, `CHAR_SHEETS` (7), `charSheetUrl`.
- Player hardcoded `'boy'` in `pixi-overworld.ts` (`makeChar('boy',…)`, `charTex`
  fallback), `rpg-battle.ts` known-set, `dialogue-box.ts` FACE_KEYS.
- Tiles/collision `game/rpg/tiles.ts` `TILE`; `TileKind` in `game/rpg/rpg-types.ts`.
- Maps: ASCII rows → `maps/legend.ts` `parseTiles`; 21 maps in `maps/index.ts`;
  `maps.spec.ts` integrity test.
- Battle scene: DOM/CSS `battle/rpg-battle.html`/`.scss`, stage platforms,
  `pv-battle-fx` Pixi overlay, VS banner; shared `features/battle/battle-presenter.ts`.

## Phases

### Phase 0 — Asset foundation (blocks all)
Add CC0/CC-BY packs to `public/rpg/tilesets/` (Kenney Roguelike/RPG + Tiny Town)
for cliffs, props, furniture. Extend `atlas.ts` `Sheet` union + `SHEET_URL`/
`SHEET_COLS`. Update `public/rpg/LICENSE.md` + credits; fix doc drift.

### Phase 1 — Overworld tile richness
`GRASS_VARIANTS` → 3-4 seeded variants; water shoreline autotiling; new `TileKind`s
(cliff/autotiled, rock, stump, bush, lamp, flowerbed variants, bridge, fountain/
statue) in `rpg-types.ts`/`tiles.ts`/`legend.ts`. Deterministic prop scatter via
`tileHash`. Varied interiors (multiple floors, furniture, per-building theming).
Richer authored maps; update `maps.spec.ts`.

### Phase 2 — Battle scene modernization
Biome/time/weather-aware backgrounds with parallax layers; animated stage
platforms per terrain; deeper `pv-battle-fx` (impact bursts, camera push/zoom on
crit). Biome context via `BattleSetup` from `rpg.service.ts`.

### Phase 3 — Lighting & post-processing (Pixi)
Soft bloom on lights/water glints; per-biome/time colour grading; smoother
day/night gradient; warm indoor lamp light sources; better dynamic shadows.
Reduced-motion / perf gated.

### Phase 4 — Character customization
Player appearance choice (2-4 CC0 char sheets); `RpgSave.appearance`
(migration-safe); chooser in intro/field-menu; wire `charKey` through the
renderer (remove hardcoded `'boy'`), canvas fallback and battle/dialogue.

### Phase 5 — Canvas fallback glow-up
Replace crude procedural rectangles in `tile-renderer.ts` with real atlas art
(2D canvas draws from loaded sheets, same `atlas.ts` mapping); keep instant hops,
no particle/lighting cost.

### Phase 6 — Polish, perf, tests, docs
Pixi stays lazy; culling + RenderTexture caching; bundle budget. Unit specs for
cliff/water autotile, new tile walkability, appearance migration, `maps.spec.ts`.
E2E green desktop+mobile, 0 console errors. Update `docs/features/rpg.md`,
`docs/rpg-roadmap.md`, `docs/changelog.md`.

## Verification
- `npx ng build` clean each phase (Pixi lazy, bundle budget ok).
- `npx vitest run` green; new specs cover new pure logic.
- `npm run e2e` (Playwright desktop 1280 + mobile 390): new game → starter →
  grass encounter → battle (new scene) → catch → heal → gym; 0 console errors;
  reduced-motion renders real art; Pixi canvas non-blank.

## Per-increment definition of done
`ng build` clean · `vitest` green · e2e/smoke desktop+mobile 0 console errors ·
reduced-motion respected · one commit per increment on `develop`.
