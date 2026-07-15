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
- `overworld/pixi-overworld.ts` — **PixiJS (WebGL) renderer** on the **CC0
  Ninja Adventure** pack by pixel-boy & AAA (in `public/rpg/`, mapped by
  `atlas.ts`; see v3.0 below): auto-tiled paths and room walls, tree canopies
  above walkers, characters with real 4-direction walk cycles, follow camera,
  **procedural animated water & tall grass**, plus an action-RPG FX layer
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

## v2.8 — 💀 Nuzlocke mode (app v1.15)

Opt-in per save slot (a second button on empty slots; rules restated by
Prof. Oak in the intro). State lives on the save as `RpgSave.nuzlocke`
(`usedEncounters` + `fallen` memorial), so classic saves are untouched.

- **Rules module** — `game/rpg/nuzlocke.ts` is pure and unit-tested:
  `consumeEncounter` (rule 1: one catch chance per map, spent at battle
  start) and `buryFainted` (rule 2: split survivors from the fallen and
  grow the memorial).
- **Service** — `startEncounter` consumes the map's chance for wild battles
  and exposes `nuzCatchAllowed`; `applyPartyWithBurial` replaces the plain
  writeback on Nuzlocke saves; `nuzlockeGameOver` (rule 3) erases the slot
  and pays respects via the global toast stack.
- **Battle** — ball throws are refused in the log once the route's chance is
  spent; result lines mourn each loss; a party wipe plays a farewell beat
  then ends the run instead of the free whiteout heal.
- **Surfaces** — 💀 in the overworld location pill (both renderers), on the
  title-slot name, and a fallen counter on the slot card.
- **v1.16 honors** — the field menu's Dex tab carries an *In memoriam*
  strip (grayscale sprites + fell-at level), and the Trainer Profile scans
  all three slots for `nuzlockeBadges`, unlocking **Survivor** (first badge
  on a run) and **Iron Grit** (all four badges on one run).

## v3.0 — 🎨 the Ninja Adventure art overhaul (app v1.18)

The Pixi overworld moved from Kenney's Tiny sheets to the **CC0 Ninja
Adventure** pack (pixel-boy & AAA; `public/rpg/LICENSE.md`):

- **Autotiling** — `atlas.ts` grew pure, spec-covered `pathAutoIndex` /
  `wallAutoIndex`: rounded 3×3-blob dirt roads on grass, and interiors framed
  by real room walls (1-thick runs face the floor via side hints).
- **Depth** — tree rows fuse alternating pine halves into two-tile conifers;
  their crowns render on a canopy layer *above* entities, so the player walks
  behind treetops. Isolated trunks fall back to a round tree.
- **Living ground** — seeded grass variants (`tileHash`), pack-art tall-grass
  tufts with procedural sway, water re-tinted to the pack palette with
  deep-rim + foam shorelines and lily pads on calm water; doors are drawn as
  standalone leaf overlays.
- **Walk cycles** — all seven character keys (hero, girl, prof, nurse, clerk,
  leader, oldman) use 4-direction × 4-frame sheets; NPC wanderers face their
  travel direction mid-glide. The canvas fallback renderer is unchanged.
- **v1.19 polish** — dialogue lines carry a **faceset portrait** of their
  speaker (NPC interactions pass the character key into `runScript`; Prof.
  Oak/Mom resolve statically; redundant "Name: " text prefixes are stripped),
  outdoor maps drift **region-tinted ambient petals** (sakura at home, amber
  in the desert, mist by the coast), and the battle field grounds both
  fighters on **stage platforms**.
- **v1.20 VS banner** — trainer battles open with a cinematic pill showing
  the challenger's faceset + "«Name» wants to battle!" (slides in, fades
  after ~2.4 s). The key travels on `BattleSetup.portrait` from all three
  entry paths: interaction, line-of-sight spotting and rematches.

## v3.1 — 👑 the Elite finale (app v2.0)

The story gets its ending. Mistfall's **east gate** (Tide Badge) opens onto:

- **Victory Pass (Route 5)** — a snow-swept switchback climb: Lv 26–30
  wilds (sneasel/graveler/machoke; day Lapras, night Jynx, rare Snorlax),
  two sight-line Ace Trainers, ledges and a stash of Hyper Potions.
- **Crownspire City** — the fifth town: stone plaza, Center/Mart, a
  gatekeeper who warns that the gauntlet has **no mid-run healing**, and
  the Elite Hall.
- **Elite Hall** — Elite **Rin** (psychic, Lv 30–31) and Elite **Kael**
  (Lv 31–32) challenge on sight from *beside* the corridor, so their beaten
  selves never block the way; **Champion Aria** (Pidgeot, Rhydon, Arcanine,
  Alakazam, Dragonite Lv 35) waits on the rug dais. Victory sets
  `beat-champion`, pays 10 000 ₽ and rolls the Hall-of-Fame epilogue; the
  objective banner and two new quests (16 total) track the run.

**v2.0 fixes from a scripted self-playthrough**: encounter tall grass is a
dense, unmistakable thicket again (the v1.18 art swap had blurred the line
to decorated meadow); Esc/X closes the field menu and shop; the field menu
fits phone viewports (swipeable tab row, shrinkable card grid); beaten-elite
placement bug caught in playtesting (they initially blocked the corridor).
