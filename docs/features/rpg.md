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
- `overworld/pixi-overworld.ts` — **PixiJS (WebGL) renderer** with Kenney **CC0**
  pixel tilesets (Tiny Town outdoors / Tiny Dungeon interiors + characters, in
  `public/rpg/`, mapped by `atlas.ts`): real tilemap, follow camera, character
  sprites, **procedural animated water & tall grass**, plus an action-RPG FX layer
  (vignette + player light, day/night tint with fireflies, step/leaf particles,
  screen-shake). Keyboard + on-screen D-pad/A-B input.
- `overworld/overworld.ts` — the original shape-drawn `<canvas>` renderer, kept as
  the **fallback** for `prefers-reduced-motion` / no-WebGL (the shell picks one).
- **Onboarding**: New Game runs a short intro then opens the starter chooser
  immediately (no Lab hunt); a flag-derived **objective banner** guides the player
  to the first battle and the gym.
- `battle/rpg-battle.ts` — drives the party-aware `TeamBattle` engine with the
  classic Fight / Pokémon / Bag / Run menu, catching, XP rollup + level-ups, HP
  writeback, trainer rewards/badges, whiteout; **action FX** (Pixi attack/impact
  bursts, animated sprites, floating numbers, send-out/faint, hit-stop, cries).
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

## Feel pack + battle depth (v2.1)

- **Overworld feel**: per-map ambient **weather** (rain on Route 2, snow in
  Stonehollow — particles + tint + a header icon), **Shift to run** (95 ms
  steps), cinematic **encounter transitions** (flash/spiral/split wipes for wild
  fights, the classic “!” alert for trainers), **field poison** (1 HP per 4
  steps, floored at 1 HP — `game/rpg/field.ts`), and a compact **party HUD**
  (name, level, HP bar, status tag) over the overworld canvas.
- **Battle depth**: field **status carries into battle** (`TeamBattle`
  `startStatusA/B`; sleepers roll fresh sleep turns) and the end-of-battle
  status is written back to the party (fainting clears it). **Revive works in
  battle** via Bag → revive-mode party targeting (half HP, costs the turn).
  **Held items** — Leftovers, Sitrus/Lum Berry, Muscle Band, Wise Glasses — are
  Mart stock, given/taken in the field menu (🎒 chip; swapped items return to
  the Bag) and ride into every battle on the engine `Battler.item`.

## v2.2 — EXP Share & rematches

- **Participant XP**: only Pokémon that actually fought earn the full yield;
  the **EXP Share** key item (Mart, owned once) pays the bench half XP.
- **Trainer rematches**: beaten trainers (incl. gym leaders) offer a dialogue
  choice to fight again at half reward, without replaying badge/epilogue beats.

## v2.3 — Tier-3 world + living towns

- **Wandering NPCs** (`game/rpg/npc-walk.ts` + spec): a pure runtime-position
  layer — NPCs with `wander: n` amble within n tiles of home (never onto the
  player, other NPCs, warps, items or blocked tiles). Blocking, interaction and
  trainer line-of-sight all read runtime positions; the Pixi renderer glides
  sprites between tiles (canvas draws them directly). Villagers in Verdant
  Town, Stonehollow and Sunreach now roam.
- **Route 3 → Sunreach → Gym 3**: a sandstorm desert pass (ledges, two
  trainers incl. a line-of-sight Ranger, ground/fighting wilds up to Rhyhorn),
  the sun-baked town of Sunreach (Center/Mart reuse, fountain square) and the
  Fighting gym — Leader Vala, **Knuckle Badge**, third and final demo badge.
- **Badge-gated warp**: `WarpDef.requiresBadge` — the south road out of
  Stonehollow is closed by a ranger until you hold the Boulder Badge.
- **Weather polish**: sunny maps get a warm tint; sandstorms drive horizontal
  dust streaks.
- **Map-registry integrity spec** (`maps.spec.ts`): every map's dimensions,
  warp targets (existing map + walkable tile), NPC/sign/item bounds, encounter
  tables and gate badges are validated in CI.
- **Checked-in E2E** (`npm run e2e`): the adventure happy-path (new game →
  starter → wild battle → run → save) drives a real browser and fails on any
  console error.

## v2.4 — slots, quests, a11y, perf

- **Save slots**: three adventures side by side (slot 1 = legacy key, so old
  saves keep working); title-screen previews with Continue / New / two-tap
  Delete.
- **Quest log**: ten spec-covered milestones (`game/rpg/quests.ts`) as a
  field-menu tab with progress bar and hints.
- **A11y**: field menu is a labelled dialog with focus landing on the first
  tab; battle focus returns to FIGHT each turn; result overlay is a status
  region; the log was already aria-live.
- **Perf**: the canvas overworld blits a per-map offscreen tile cache and
  re-draws only animated water each frame.
- **Shared presenter**: rpg-battle now runs on the battle-presenter base
  (cries/hit-stop as hooks) — see `features/battle/battle-presenter.ts`.

## v2.5 — Angler, Ledges & Wild Luck

- **Fishing**: the **Old Rod** key item (Fisher Finn, Verdant pond; two new
  quests) casts at any faced water tile via `MapDef.fishing` encounter
  tables — Verdant pond and the Sunreach fountain (rare Dratini). Hooked
  battles get their own intro line.
- **Repel** (Mart, ₽350): `RpgSave.repelSteps` suppresses wild rolls for 100
  steps; used from the Bag without a target (new `field` item category),
  wear-off toast.
- **Shiny wilds**: 1/128 per wild roll (grass + fishing) — shiny battle
  artwork, sparkle log line, persistent `PartyMon.shiny` shown as ✨ in the
  party HUD / field menu / box.
- **One-way ledges**: `ledgeLanding` (unit-tested) — down-presses vault the
  ledge with an arc + landing dust; other approaches block. Ledge tiles are
  tinted so the drop reads.
- **Overworld polish**: drop shadows under all characters (grounded during
  bob/hop), water sparkle glints, an animated **area-name banner** on every
  map entry (initial-entry bug found by verification and fixed).
- **Gamepad**: stick/d-pad walks, A interacts, B menu, X runs (Pixi renderer).

## v2.6 — The Misted Coast

- **New region**: a badge-gated (Knuckle Badge) south gate from Sunreach opens
  **Route 4** → **Mistfall Town** (tidal bay, Center/Mart) → the **Mistfall
  Gym** (Leader Nerida, Water; the **Tide Badge** — fourth demo badge). Adds a
  line-of-sight Ranger, a Swimmer trainer, ground items and bay fishing.
- **Day/night encounters**: `EncounterEntry.time` = `'day'`/`'night'` and
  `rollEncounter` filters the table by `timeBand()` (pure, unit-tested). Route 4
  fields sun-lovers by day, nocturnals after dark; the overworld header shows a
  🌞/🌙 badge. Mistfall's bay fishing has its own day/night table (rare night
  Lapras).
- **Quests**: *Earn the Tide Badge* and *Catch a nocturnal Pokémon*; the
  objective banner points to Mistfall after the third badge. The map-registry
  spec covers the three new maps.

## v2.7 — mobile & pacing quality-of-life (app v1.12)

- **Battle speed 1×/2×/3×** — inherited from the shared presenter; the chip
  sits top-left of the battle field (the foe box owns the top-right). Every
  scripted beat (catch shakes, item use, whiteout) is speed-aware too.
- **Touch run toggle** — a sticky 🏃 button joins A/B on the on-screen pad
  (both renderers): touch players finally get the Shift-run (95 ms steps).
  The canvas fallback renderer also learned keyboard Shift-run for parity.
- **Mobile battle fit** — compact field/log/commands so a full fight (field,
  log, four moves or the command grid) fits one phone screen without
  scrolling.
