# Classic RPG Mode — "PokéVerse Adventure" (retro-style story mode)

## Context

PokéVerse Arena has deep battle/meta systems (Battle, Arena, Tournaments, Spire,
World, Contest) but no **classic, story-driven RPG** the way the retro games play:
walk a tile world, talk to NPCs, find a starter, battle in tall grass, **catch**
Pokémon, earn **XP/levels**, heal at a Center, shop at a Mart, beat trainers and a
gym leader for a badge. This adds that mode from A→Z as a new, self-contained
feature that **reuses the existing battle engine and data pipeline**.

**Decisions (confirmed):** v1 = compact classic slice (start town → route → gym
town, starter + first badge); **stylized canvas tiles** (no external art assets,
themed to the app); **no evolutions in v1** (clean follow-up later); **standalone
RPG save** (own party/bag/money/dex/badges — zero coupling to other modes).

## Reuse (don't reinvent)
- **`TeamBattle`** (`game/engine/team-battle.ts`) — party-aware single battles (switching, faint→send-next, weather/hazards). The RPG battle drives this. `TeamAction` = `move|switch`; add a `pass` variant for ball/item/failed-run turns.
- **`BattleService.buildBattler(idOrName, level)`** (`features/battle/battle.service.ts`) — builds a full Battler at any level from cached PokéAPI data (stats via `quickStats`, 4 strongest level-up moves).
- **`SaveService`** (`core/storage/save.service.ts`) — one namespaced/versioned `rpg:save` blob.
- **`quickStats(bases, level)`** (`core/utils/stat-calculator.ts`); DTO has `base_experience` + per-move `level_learned_at`.
- World catch math (`catchChance`/`attemptCatch`/`BALLS`, `game/world/encounters.ts`) as a starting point.
- `SeededRng`, `PokeApiClient` (cache-first), `officialArtwork`/`SPRITE_BASE`, `pv-type-badge`, `pv-icon`, the battle FX (floating numbers, send-out/faint, colour log), CSS tokens.
- Arena `GymLeader` data (`game/arena/gym-leaders.ts`) for the v1 gym leader's theme/team (scaled low).

## Architecture

**Pure logic + data — `src/app/game/rpg/`** (framework-free, unit-tested):
- `rpg-types.ts` — `Direction`, `TileKind`, `MapDef`, `WarpDef`, `NpcDef`, `TrainerDef`, `GroundItem`, `EncounterZone`, `PartyMon`, `ItemId`, `RpgSave`.
- `tiles.ts` — tile legend: walkable?, is-tall-grass?, render palette key per `TileKind`.
- `movement.ts` — `canEnter(map,x,y)`, `warpAt(map,x,y)`, `npcAt`, `facingTile(x,y,dir)`.
- `encounters.ts` — per-zone species+level tables; `rollWild(zone, rng)` (deterministic).
- `xp.ts` — `xpForLevel(n)` (medium-fast n³), `xpYield(foeBase, foeLevel)`, `applyXp(mon, gained)`.
- `party.ts` — `PartyMon` helpers: `partyAlive`, `healAll`, faint checks, build→writeback bridge.
- `catch.ts` — `catchChance(foeHpPct, status, ballMult, baseRate)`, `attemptCatch(rng)`.
- `items-catalog.ts` — `ITEMS` (potions, balls, antidote, revive…); `shop.ts` (mart stock + prices).
- `dialogue.ts` — script nodes: `say`, `choice`, `giveItem`, `startTrainer`, `heal`, `openShop`, `setFlag`, `giveStarter`.
- `save.ts` — `RpgSave` schema, `DEFAULT_SAVE`, version + light migration.
- `maps/` — registry + authored maps (`player-home`, `home-town`, `route-1`, `gym-town`, interiors). Each: `tiles[][]`, `warps`, `npcs`, `signs`, `items`, `encounters`.

**Angular feature — `src/app/features/rpg/`** (standalone, OnPush, signals):
- `rpg.service.ts` — state hub: `phase` (`title|overworld|dialogue|battle|menu|shop`), the `RpgSave` signal, derived `currentMap`/`player`/`party`. Methods: `newGame`, `continue`, `persist`, `tryStep`, `interact`, `runScript`, `startWild`, `onBattleEnd`, `useItem`, `heal`, `buy`. Persists to `rpg:save`.
- `rpg.ts/.html/.scss` — shell: title (New Game / Continue), hosts overworld | battle | menus by `phase`.
- `overworld/overworld.ts` (+ `tile-renderer.ts`) — `<canvas>` camera renderer + input: keyboard (arrows/WASD, Z/Enter, X/Esc) **and** on-screen D-pad + A/B for mobile; ~140ms tween (instant under reduced-motion); encounter roll on tall grass; rAF loop paused outside overworld.
- `battle/rpg-battle.ts` — drives `TeamBattle`; menus **Fight / Pokémon / Bag / Run**; wild **catch** (success→party/box + dex, fail→foe free turn via `pass`); post-battle XP rollup + level-ups + HP/status writeback; whiteout→nearest Center.
- `ui/` — `dialogue-box` (typewriter + choices), `party-menu`, `bag-menu`, `shop-menu`.

**Edits:** `app.routes.ts` (+ lazy `/rpg`), `app.ts` (nav entry, icon `scroll-text`), `team-battle.ts` (+`pass` action), engine `index.ts` export if needed, `docs/features/rpg.md`, optional Home feature card.

## v1 content (authored maps)
1. **player-home** (interior) → warp to town.
2. **home-town "Verdant Town"** — houses, **Lab** (Professor gives 1 of 3 starters, first-time flag), **Center** (heal), **Mart** (shop), exit south to route.
3. **route-1** — tall-grass encounters (pidgey/rattata/caterpie/weedle/oddish, Lv2–5), 1–2 trainers, a ground item, exit to gym town.
4. **gym-town "Oakhaven"** — Center, Mart, **Gym** with a low-level leader → **badge** + "To be continued…" screen.

## Delivery (phased; per phase: `ng build` clean, `vitest run` green, Playwright smoke desktop+mobile, commit on `develop`)
- **P0 — Engine/logic prep:** `pass` TeamAction (+spec); `xp`, `party`, `catch`, `items-catalog`, `shop`, `save` with specs.
- **P1 — Overworld core:** types/tiles/maps(home-town+interior), canvas renderer, movement/collision/warps, keyboard + mobile D-pad, RpgService skeleton, `/rpg` route + nav, title/new/continue.
- **P2 — Wild battles:** grass encounter → `RpgBattleComponent` on `TeamBattle`, Fight/Run, faint→XP→level-up, HP persist, whiteout→Center.
- **P3 — Catch + Bag + Center + Mart:** balls/catch, items/potions, heal, shop, party & bag menus, money.
- **P4 — NPCs/dialogue/trainers/starter:** dialogue box, starter choice, talk NPCs, trainer battles + rewards + flags.
- **P5 — Route + gym town + leader + badge:** author maps, leader battle, badge, ending; RPG Pokédex (seen/caught); polish + `docs/features/rpg.md`.

## Verification
- **Unit (`npx vitest run`):** xp curve & level-up; movement/collision/warp; deterministic encounter roll; catch math; save round-trip; `pass`-action turn.
- **Build:** `npx ng build` strict-clean each phase.
- **E2E (Playwright, desktop 1280 + mobile 390):** new game → starter → grass → wild battle → fight & catch → level-up → heal → shop → beat trainer → gym → badge. Assert **0 console errors**, save persists across reload, reduced-motion = instant hops.
