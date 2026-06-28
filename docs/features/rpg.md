# Adventure (Classic RPG Mode)

A retro, top-down story mode: walk a tile world, choose a starter, battle in tall
grass, **catch** Pokémon, earn XP/levels, heal at a Center, shop at a Mart, beat
trainers, and win the Oakhaven Gym badge. Standalone save — no coupling to the
other modes.

Route: `/adventure` ([rpg.ts](../../src/app/features/rpg/rpg.ts)).

## Architecture

**Pure logic + data — [`src/app/game/rpg/`](../../src/app/game/rpg/)** (framework-free, unit-tested):
- `rpg-types.ts` — tiles, maps/warps/NPCs/trainers, party mon, items, dialogue script, `RpgSave`.
- `tiles.ts` / `movement.ts` — walkability, warp/NPC/sign lookups, stepping.
- `encounters.ts` — weighted, seeded wild rolls per tall-grass zone.
- `xp.ts` — medium-fast (n³) curve, `xpYield`, `applyXp` (+level-ups), bar %.
- `party.ts`, `catch.ts`, `items-catalog.ts`, `shop.ts`, `save.ts`.
- `maps/` — authored maps: player-home, Verdant Town, Route 1, Oakhaven, and the
  Center/Mart/Lab/Gym interiors (`@return` doors resolve to the tile the player
  entered from, so interiors are reusable across towns).

**Angular feature — [`src/app/features/rpg/`](../../src/app/features/rpg/)** (standalone, OnPush, signals):
- `rpg.service.ts` — state hub: phase, the `RpgSave` signal, movement/warps/
  interaction, the dialogue script VM, encounters, bag/money/flags, battle setup,
  whiteout. Persists to `rpg:save` via `SaveService`.
- `overworld/` — `<canvas>` camera renderer (stylized tiles drawn with shapes,
  no external art) + smooth grid movement; keyboard (arrows/WASD, Z, Esc) **and**
  an on-screen D-pad + A/B for touch.
- `battle/rpg-battle.ts` — drives the party-aware `TeamBattle` engine with the
  classic Fight / Pokémon / Bag / Run menu, catching, XP rollup + level-ups, HP
  writeback, trainer rewards/badges, and whiteout.
- `ui/` — dialogue box (typewriter + choices), field menu (party / bag / dex),
  starter chooser, shop.

## Reuse
- `TeamBattle` (+ a `pass` action for ball/item/failed-run turns), `BattleService.buildBattler`, `quickStats`, `SeededRng`, `PokeApiClient`, `officialArtwork`/`SPRITE_BASE`, `pv-type-badge`/`pv-status-badge`/`pv-move-button`, CSS tokens.

## v1 content & flow
New Adventure → wake at home → Verdant Town → **Lab** (pick Bulbasaur/Charmander/
Squirtle) → tall grass (catch/train) → **Route 1** (trainer, hidden Potion) →
**Oakhaven** (Center, Mart) → **Gym** (Leader Chitin) → **Hive Badge** + "to be
continued" epilogue. Whiteout returns you to the last Center, healed.

## Save (`rpg:save`)
Player position/facing, party + box, bag, money, flags (events/trainers/pickups),
seen/caught dex, badges, whiteout respawn, and the interior-return door.

## Tests / verification
- Unit (`npx vitest run`): xp curve & level-ups, movement/collision/warp,
  encounter rolls, catch math, save round-trip, the engine `pass` turn.
- E2E (Playwright, desktop + mobile): new game → starter → grass encounter →
  fight & **catch** → level-up → Center heal → Mart shop → beat a trainer →
  Route 1 → **beat the Gym leader → Hive Badge**; 0 console errors; reduced-motion
  uses instant tile hops.
