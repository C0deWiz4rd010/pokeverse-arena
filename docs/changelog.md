# Changelog

All notable, user-facing changes to PokéVerse Arena. Versions follow
[semver](https://semver.org/); the app version is surfaced in the footer and
kept in sync between `package.json` and `src/app/core/version.ts`.

## v1.20.0 — 2026-07-15

🎴 **Quickview 2.0 & VS banners** — the dex popover flips to a stat radar,
and RPG trainers announce themselves face-first.

### Added

- **Quickview card flip** — a *Radar* chip flips the Pokédex popover
  (rotateY, `preserve-3d`, instant under reduced motion) to a back face with
  an **SVG stat radar**: a type-colored hexagon over 25/50/75/100 % rings,
  labeled axes with raw values (HP at 12 o'clock), BST in the header, and a
  ‹ chip to flip back. Radar geometry is pure math shared by rings, axes,
  labels and the shape polygon.
- **Quickview parallax** — the popover itself tilts subtly (5°) under the
  pointer, matching the grid's holo cards.
- **Trainer VS banner (RPG)** — trainer battles open with a cinematic pill:
  the challenger's **faceset** plus "«Name» wants to battle!", sliding in
  and fading after ~2.4 s. The character key rides `BattleSetup.portrait`,
  fed by all three entry paths (interaction, line-of-sight spotting,
  rematch).

### Verification

- 378/378 unit tests; production build clean.
- Playwright: quickview opened on Charizard, front shot, flipped to the
  radar (all six axes + BST verified readable; a clipped Back chip was found
  and moved into the header before release) — 0 console errors. The VS
  banner is template/AOT-covered; its portrait keys reuse the v1.19 faceset
  set.

## v1.19.0 — 2026-07-15

✨ **Portraits, holo cards & staged battles** — JRPG dialogue faces, a 3D
Pokédex and grounded battle arenas on every screen size.

### Added

- **Dialogue portraits (RPG)** — the Ninja Adventure facesets
  (`public/rpg/facesets/`, CC0) frame the speaker beside every dialogue line:
  NPC interactions pass their character key through `runScript`, well-known
  narrators (Prof. Oak, Mom) resolve via a static map, and a redundant
  "Name: " text prefix is stripped since the label already names them.
  Unknown keys (e.g. roaming-Pokémon NPCs) gracefully show no portrait.
- **Ambient petals (RPG)** — outdoor maps breathe: ten drifting, slowly
  spinning petals tinted per region (sakura pink at home/Verdant, desert
  amber around Sunreach, sea mist near Mistfall, leaf green elsewhere);
  suppressed during rain/snow/sandstorms and under reduced motion.

### Changed

- **Pokédex cards go 3D-holo** — deeper pointer tilt (12°) with hover scale,
  a TCG-style **holo foil** (pointer-angled rainbow, masked at the glare,
  `color-dodge`; loud on shiny/favorites), true depth layers
  (artwork/name/types ride `translateZ` above the card plane) and an idle
  **levitation** on the artwork, staggered per card. Touch drives the same
  tilt; `prefers-reduced-motion` disables all of it.
- **Battle stages** — elliptical, accent-lit **ground platforms** under both
  combatants in the quick battle, tournament/spire matches (plus a faint
  horizon line) and the RPG battle, sized for phone and desktop; the chimera
  hue filter now keeps its drop shadow.

### Verification

- 378/378 unit tests; production build clean.
- Playwright: Oak's portrait confirmed in a fresh intro, holo tilt shot on a
  hovered dex card, quick battle shot on desktop (fog weather) and 375 px
  mobile (one-screen fight intact) — 0 console errors across all runs.

## v1.18.0 — 2026-07-15

🎨 **Adventure art overhaul** — the RPG overworld moves to the gorgeous CC0
**Ninja Adventure** pack (pixel-boy & AAA) with autotiling and real walk cycles.

### Changed

- **New tilesets** (`public/rpg/tilesets/nj-*.png`, CC0 — see LICENSE.md):
  a 28-column outdoor master sheet (houses with doors, trees, fences, signs,
  props), patterned interior floors and room-frame walls. The old Kenney
  sheets are retired with thanks.
- **Autotiled paths & walls** — `pathAutoIndex`/`wallAutoIndex` (pure,
  unit-tested) pick rounded 3×3-blob tiles from same-kind neighbor masks, so
  dirt roads get rounded corners on grass and interiors read as framed rooms;
  1-thick wall runs face their side toward the floor via hints.
- **Trees with depth** — tree rows fuse alternating pine halves into full
  two-tile-tall conifers whose crowns land on a **canopy layer above
  entities** (you walk behind treetops); isolated trunks and odd row ends use
  a self-contained round tree.
- **Living ground** — seeded grass texture variants (`tileHash`), tall grass
  as swaying tufts from the pack, water re-tinted to the pack's palette
  (#72C4E6) with **deep-rim + foam shorelines** and the occasional lily pad
  on calm open water.
- **Real 4-direction walk cycles** — every character sheet carries
  down/up/left/right columns × 4 walk frames; the player animates while
  stepping (and faces on blocked bumps), wandering NPCs face their travel
  direction and cycle frames mid-glide. Seven distinct villagers: hero, girl,
  professor, nurse, straw-hat clerk, gym leader, elder.
- **Doors as overlays** — a standalone door leaf on house walls outdoors and
  on the floor indoors, so entrances read at a glance.

### Verification

- 378/378 unit tests (11 new: blob autotiling incl. floor-side hints, frame
  rects per sheet, char frame layout, tile hash).
- Playwright drove a fresh adventure (intro → starter → overworld walk →
  town tour) on desktop + a mobile new-game run — 0 console errors; bedroom,
  town and mobile screenshots inspected.

## v1.17.0 — 2026-07-14

🧬 **Secret chimera bosses** — the Fusion Lab escapes into the Ascension Spire.

### Added

- **Chimera keepers** — late boss floors (10: 25 %, summit: 40 %, seeded per
  run, so daily climbs share the encounter) may swap the floor guardian for a
  **Chimera Keeper** (Geneweaver Syl, Dr. Helix, The Splice Warden, Curator
  Myx). Their ace is a real **fused Pokémon**: `fuseBattlers` (new in
  `game/fusion/fusion.ts`) splices name, types, head/body-weighted stats and
  an interleaved four-move set from two seeded donors, built two levels hot.
  In battle it wears the body's artwork **hue-rotated toward the head's
  palette** (new UI-only `Battler.hue`), and the keeper announces it with an
  ace quip.
- **Tell, don't spoil** — the boss door's blurb turns to *"Something in there
  sounds… stitched together."*, and the hub rules line now carries the rumor.
- **Tame the chimera** — beating a keeper pays +60 ₽ and puts a unique
  **"Tame …"** card on top of the reward draft: the defeated chimera joins
  your party at full HP (party full → it dissolves into coins).
- **Meta + honors** — `SpireMeta.chimeraWins` (persisted, survives run
  records) shows as an iridescent *Chimeras slain* stat on the hub once > 0,
  a *Chimeras slain* Records row on the profile, and two achievements:
  **Chimera Slayer** (first kill) and **Myth Hunter** (three). 27 total.

### Verification

- 367/367 unit tests (6 new: `fuseBattlers` splice/moves/id, chimera roll
  determinism + floor gating, meta carry-through, achievement thresholds).
- Playwright: scripted Spire run into a real floor-1 battle (sprites, trays,
  moves render; 0 console errors) + hub/profile shots.

## v1.16.0 — 2026-07-12

Nuzlocke honors — a memorial in the field menu and profile achievements.

### Added

- **In memoriam** — on Nuzlocke saves the field menu's Dex tab shows the
  memorial: every fallen partner as a grayscale sprite with name and the
  level it fell at, framed by a dashed mourning border.
- **Nuzlocke achievements** — `ProfileState.nuzlockeBadges` (the most
  Adventure badges held on any single Nuzlocke slot; all three save slots
  are scanned) drives **Survivor** (first badge on a Nuzlocke run) and
  **Iron Grit** (all four demo badges on one run), plus a *Nuzlocke badges*
  Records row. 25 achievements total.

## v1.15.0 — 2026-07-12

💀 **Nuzlocke mode** for the Adventure (RPG) — the classic hardcore challenge,
opt-in per save slot.

### Added

- **Nuzlocke runs** — every empty save slot offers a *Nuzlocke* start next to
  *New Adventure* (rules in the tooltip and in Prof. Oak's intro). The three
  classic rules, enforced by a pure, unit-tested rules module
  (`game/rpg/nuzlocke.ts`, 8 specs):
  1. **One catch per route** — only the first wild battle on each map may
     throw balls; the chance is spent when the battle starts, win, lose,
     flee or catch (fishing counts). Later attempts get a battle-log refusal.
  2. **Permadeath** — fainted partners leave the party for a **memorial**:
     the battle result lists `💀 … fell in battle`, and the title-screen slot
     shows the fallen count.
  3. **Whiteout ends the run** — with no survivors the save is erased after
     a farewell beat, with a global toast honouring the fallen.
- **UI ties** — a 💀 marker in the overworld location HUD (both renderers)
  and on the title-slot name; Nuzlocke state lives on the save
  (`RpgSave.nuzlocke`), so classic saves are byte-compatible and unaffected.

## v1.14.0 — 2026-07-12

Home page decluttered — a phone now sees the whole landing page in a third of
the scroll — plus a daily silhouette game and a stamped Trainer Card.

### Changed

- **Mobile home redesign** (~4600 px → ~1500 px page height at 375 px width):
  - The **3D hero orb is desktop-only** — below `lg` it's hidden *and* the
    WebGL scene is never initialized (saves a context + ~320 px of scroll
    before any content).
  - The **feature grid becomes a dense two-column launcher** on phones (icon +
    title only; descriptions and "Explore →" return at `md`). Thirteen big
    cards were the bulk of the scroll height.
  - The **"Today" strip is a horizontal swipe row** with scroll-snap on
    mobile (three cards at ≥900 px), and the **dashboard chips scroll in one
    row** instead of wrapping four deep.
  - Tighter hero paddings/lead; section titles scale down on phones.

### Added

- **Daily silhouette** — a third "Today" card plays *Who's that Pokémon?*
  right on the landing page: a seeded, blacked-out sprite of the day; the
  first tap fades the colours in, the second opens its detail page. Zero API
  calls, like the rest of the strip.
- **Trainer Card stamp** — the shareable card now carries a tilted, dashed
  "LAB SPECIAL of the day" rubber stamp with both seeded donor sprites, so
  every card is unique to its day.

## v1.13.0 — 2026-07-12

Today at a glance + a shareable Trainer Card.

### Added

- **"Today" strip on Home** — two compact cards between the hero and the
  feature grid: the **Daily Challenge** (state-aware copy — ready / cleared /
  attempt spent — plus live streak and both matchup sprites) and **Today's
  Lab Special** (both seeded donors), each one tap from playing. Sprites come
  straight off the id-addressed CDN — zero API calls on the landing page.
- **Trainer Card** — a *Share Trainer Card* button on the profile renders a
  1200×630 PNG on an offscreen canvas: accent-palette border and glows, name,
  title, rank pill, achievement bar, six record chips and up to three
  favourite Pokémon artworks (a drawn Poké-orb when there are none). Uses the
  Web Share API where available, otherwise downloads — verified end-to-end
  with a scripted download check.

### Changed

- **Micro-polish** — text selection now uses the accent palette and the grey
  mobile tap-flash is gone (`-webkit-tap-highlight-color: transparent`).

## v1.12.0 — 2026-07-12

Mobile & pacing quality-of-life: the PWA respects the OS rotation lock, a
whole fight fits one phone screen, battles play at 1×/2×/3×, and the RPG gets
a touch run toggle.

### Fixed

- **Installed PWA no longer rotates against the OS rotation lock.** The
  manifest declared `"orientation": "any"`, which overrides the system
  auto-rotate setting in standalone mode on Android — the app kept rotating
  even with the lock on. The member is now omitted, so the installed app
  follows the system lock exactly like the browser; the service-worker cache
  version was bumped (`v1` → `v2`) so installed clients pick the fix up.

### Added

- **Battle speed 1×/2×/3×** — the shared battle presenter owns a persisted
  playback speed that divides every pacing beat; a small ×-chip on the arena
  cycles it in the quick battle, tournament matches and RPG fights alike.
  Scripted RPG beats (catch shakes, item use, whiteout) are speed-aware too.
- **RPG touch run toggle** — a sticky 🏃 button joins A/B on the on-screen
  pad in both overworld renderers; the canvas fallback also gained keyboard
  Shift-run for parity.

### Changed

- **Mobile battle fit** — below 768 px the page header hides once a fight
  starts, fighters/info cards/log tighten, and the full fight (arena, four
  moves, log) fits one screen — no more scrolling to reach the attacks. The
  RPG battle got the same compaction (field 225 px, log 74 px).

## v1.11.0 — 2026-07-12

Fusion Lab round 2 — the daily **Lab Special** — plus shiny sparkles in the
Pokédex and deeper cross-app ties.

### Added

- **Today's Lab Special** — a seeded fusion of the day (`dailyFusionPair`,
  pure + unit-tested, same pair for every trainer, head ≠ body guaranteed).
  A golden banner on the Fusion Lab previews the spliced name and both donors
  straight from the in-memory dex index (zero fetches) and loads the pair on
  click; the ⌘K palette gains a "Splice today's Lab Special" action.
- **Shiny sparkles** — with shiny mode on, every Pokédex card gets two
  twinkling golden sparks over the artwork, de-synchronized per card by
  reusing the grid's entrance-stagger delay (pure CSS, reduced-motion safe).
- **Quickview → Fuse** — the Pokédex quick-view popover gains a *Fuse* chip
  that sends the Pokémon into the lab as head donor.
- **Profile** — a *Fusions registered* row in Records; the Home "What's next"
  coach now suggests your first splice once you've won a cup.

### Notes

- `dailyFusionPair` reuses the shared `SeededRng` + `dailySeed` machinery the
  Daily Challenge is built on — one seeding convention across the app.

## v1.10.0 — 2026-07-12

⚗️ **Fusion Lab** — a brand-new mode — plus a global UI/FX pass.

### Added

- **Fusion Lab** (`/fusion`) — splice any two Pokémon into a new species
  ([full doc](features/fusion-lab.md)):
  - Deterministic engine (`game/fusion/fusion.ts`, pure + 17 unit tests):
    syllable-spliced **name**, head-primary + differing-body **typing**,
    head/body **2:1-weighted stats** (mind vs. physique), seeded ability &
    epithet, averaged height/weight.
  - **Fused visual** — the body's artwork re-tinted toward the head's palette
    via a type-hue `hue-rotate`, inside a spinning two-tone halo ring.
  - **DNA-merge animation** — parents stream into a pulsing energy beam, the
    fusion pops in with a spring reveal + spark burst (reduced-motion safe).
  - **Chimera cry** — head's cry answered by the body's, pitched up.
  - **Fusion Dex** — persist keepers, reload or remove them from a gallery;
    registering pops the shared toast.
  - **Share links** — the pair lives in the URL (`?head=6&body=150`); Share
    copies a summary + deep link.
- **Cross-app integration** — a **Fuse** quick action on the Pokémon detail
  page, a Fusion Lab page + "Fuse two random Pokémon" action in the ⌘K
  palette, a Home feature card, a nav entry, and two achievements
  (**Mad Scientist**, **Gene Weaver**) via `ProfileState.fusionsRegistered`.
- **Back-to-top FAB** — a glass floating button fades in after deep scroll on
  any page (great for the infinite-scroll Pokédex) and smooth-scrolls up.
- **Primary-button light sweep** — `.btn-primary` gets a hover shine sweep,
  app-wide, pure CSS, disabled under reduced motion.

### Fixed / tooling

- `npm run shots` now covers **Fusion, Odyssey and Adventure**, and routes
  with query params no longer crash the screenshot writer on Windows
  (filename sanitization).
- `package.json` version (stale at 1.7.0) re-synced with `core/version.ts`.

## v1.9.0 — 2026-07-04

Adventure (RPG) overhaul, part 2 — "The Misted Coast".

### Added

- **New region beyond Sunreach** — a badge-gated south gate (needs the
  **Knuckle Badge**) opens **Route 4**, the rain-swept **Mistfall Town** built
  around a tidal bay, and the **Mistfall Gym** — Leader Nerida (Water) and the
  fourth demo badge, the **Tide Badge**. Route 4 adds a line-of-sight Ranger
  and Mistfall a Swimmer trainer, ground items, and bay **fishing** (day/night
  tables including a rare night **Lapras**).
- **Day/night encounters** — `EncounterEntry.time` restricts a wild to `'day'`
  or `'night'`; `rollEncounter` filters the table by the current band
  (`timeBand`, pure + unit-tested). Route 4 fields sun-lovers (Psyduck,
  Meowth, Staryu) by day and nocturnals (Zubat, Hoothoot, Murkrow) after dark;
  the overworld header shows a 🌞/🌙 badge so the clock is legible.
- **Quests** — two new milestones: *Earn the Tide Badge* and *Catch a
  nocturnal Pokémon*; the objective banner now points to Mistfall after the
  third badge.

### Notes

- The map-registry integrity spec validates the three new maps (dimensions,
  warp targets, NPC/sign/item bounds) in CI.

## v1.8.0 — 2026-07-04

Odyssey deep pass — economy, relics, guardian fields & profile ties.

### Added

- **Coins & wandering trader** — clearing a wave now pays coins (scaling with
  wave + kind). After every **guardian** falls, a seeded shop appears: restock
  Poké Balls, buy a team heal, pick up a held item, or buy one of two **relics**
  (`coinsForWave` + `generateOdysseyShop`, unit-tested).
- **Relics** — the Odyssey borrows the Spire's run-long relic system (Lucky
  Coin, Vitamin Boost, Leftovers Aura, Swift Feather, Guardian Shell,
  Berserker Band, Focus Charm). Held relics tint the party bar as chips and
  boost the team via `applyRelicsToTeam` each fight.
- **Guardian field conditions** — each biome's boss imposes a persistent
  battlefield from turn one (Grassy/Psychic/Electric Terrain, Rain, Sun, Sand,
  Snow), shown on the wave preview and passed to the match via `setup.field`.
- **Profile integration** — `ProfileState` gains `odysseyBestWave` +
  `odysseyUnlocked`; two records rows and three achievements (**Wayfarer**
  wave 10, **Endless Marcher** wave 30, **Roster Builder** 12 starters), and
  Odyssey depth now feeds the rank score.

## v1.7.0 — 2026-07-03

### Added

- **Odyssey** (`/odyssey`) — a new, PokéRogue-inspired **endless roguelike**
  mode, complementing the Spire's fixed climb:
  - **Eight cycling biomes** (ten waves each, +15 foe levels per full lap),
    each with its own species pool, tint and a wave-10 **guardian boss**;
    elite packs every 5th wave; AI tier scales basic → strong → elite.
  - **Daze-catch**: winning a wave opens one catch window on the lead foe
    (65/45/25% per ball by wave kind, balls are scarce). Catches join the
    team level-matched *and* permanently **unlock the species as a starter**
    (`odyssey:meta`) — the collection is the meta-progression.
  - **Growth**: the team levels after every wave and **auto-evolves** past
    evolution thresholds (live chain lookup, cache-first); HP carries between
    waves as max-HP fractions (no free healing).
  - **Seeded reward drafts** (heal / ball cache / Rare Candy / held item) and
    a **Daily march** seed shared by everyone.
  - Fights reuse the shared `pv-tournament-match` component, so the full
    engine depth applies. Pure wave/meta logic in `game/odyssey/` (11 specs).
  - Wired into the nav, home grid and the ⌘K palette (try "pokerogue").

## v1.6.0 — 2026-07-03

Adventure (RPG) overhaul, part 1 — "Angler, Ledges & Wild Luck".

### Added

- **🎣 Fishing** — Fisher Finn by the Verdant Town pond hands over the **Old
  Rod** (new key item + two quest-log entries). Face any water tile and press
  A to cast: maps can define a `fishing` encounter table (`MapDef.fishing`),
  authored for the Verdant pond (Magikarp/Poliwag/Psyduck) and the Sunreach
  fountain (Goldeen/Staryu/… and a 1-in-10 **Dratini**). Hooked battles open
  with "The hooked X attacks!".
- **🧴 Repel** — new Mart item (₽350): suppresses wild rolls for 100 steps
  (`RpgSave.repelSteps`), used straight from the Bag without a target, with a
  wear-off toast. New `field` item category.
- **✨ Shiny wilds** — every wild roll (grass *and* fishing) has a 1/128 shiny
  chance: shiny artwork in battle, a sparkle log line, and the caught
  `PartyMon.shiny` flag surfaces as ✨ in the party HUD, field menu and box
  (shiny box sprites).
- **🪾 One-way ledges** — classic hop-down ledges (`ledgeLanding` in
  `movement.ts`, unit-tested): pressing down vaults the ledge with a little
  arc + landing dust; every other approach is blocked. Ledge tiles are tinted
  earthy so they read as drops. Route 3's authored ledges now behave.
- **🗺️ Area-name banner** — entering any map pops an animated location banner
  (also on first load — found & fixed: the initial map build ran before the
  ticker, so the banner never fired on entry).
- **🎮 Gamepad support** — the Pixi overworld polls the first connected pad:
  left stick / d-pad walks, A interacts, B opens the menu, X runs.

### Changed

- **Overworld graphics pass** — soft drop shadows under the player and every
  NPC (grounded while the sprite bobs/hops), wandering sparkle glints on
  water tiles.

### Fixed

- Fisher Finn originally spawned in the town's main walking column and could
  block the path south (caught by the checked-in adventure E2E); he now fishes
  from the pond's east bank.

## v1.5.0 — 2026-07-03

### Added

- **Share your daily** — the daily result panel gains a *Share result* button
  that builds a Wordle-style text: challenge number + date, outcome + turn
  count + streak, and one emoji per player turn (🟩 super effective, 🟨
  neutral, 🟥 resisted, 🟪 immune, ⬜ miss, 💥 crit), wrapped at ten per row.
  Uses the native share sheet when available, otherwise copies to the
  clipboard with a confirmation toast. Pure helpers (`dailyNumber`,
  `turnEmoji`, `buildShareText`) are unit-tested.
- **Daily-streak achievements** — two new milestones, *On Fire* (3-day best
  streak) and *Eternal Flame* (7-day), evaluated from the persisted daily
  record; the achievement watcher toasts them like any other unlock. The
  profile records grid shows *Daily streak (best N)* and the home dashboard
  gains a 🔥 streak chip.

### Changed

- **Component-style budgets** raised in `angular.json` (warn 8 kB → 20 kB,
  error 20 kB → 32 kB): five feature stylesheets (tournaments 18.1 kB, arena
  14.3 kB, contest 12.7 kB, team-builder 11.8 kB, pokemon-detail 11.1 kB) are
  intentionally rich single-page components; the old threshold produced
  permanent warning noise on every build.

## v1.4.0 — 2026-07-03

### Added

- **Daily Challenge** — the Battle Arena's setup screen gains a challenge card:
  every UTC day derives one deterministic matchup (fighters *and* battle seed)
  from the date via `SeededRng`, so every trainer worldwide fights the same
  battle. The first attempt of the day counts toward a consecutive-day win
  streak (current / best / total wins, persisted as `pv:daily:record`); a loss
  breaks it, a skipped day lapses it, retries replay the identical seeded
  battle without touching the record. A counted win pops a streak toast.
  - Pure logic in `src/app/game/daily/daily.ts` (day keys, matchup derivation,
    streak fold) with 10 unit tests.
  - `DailyService` handles persistence + reporting; `?daily=1` deep-links and
    auto-starts (also from a finished battle), wired to a new ⌘K palette
    action "Fight the Daily Challenge".

### Fixed

- Deep-linking `?daily=1` while a finished battle was still on screen did not
  start the challenge (the auto-start guard only accepted the setup phase).

## v1.3.0 — 2026-07-03

### Added

- **Achievement unlock toasts** — earning any of the ten achievements now pops
  a celebratory toast (gold gradient icon, name + description) no matter which
  system earned it. `AchievementWatcherService` re-aggregates progression on
  every navigation plus a slow 30 s poll, diffs the unlocked set against a
  persisted "seen" list (`pv:achievements:seen`) and toasts only the delta.
  The very first run baselines silently, so pre-existing progress doesn't
  spam; a progress reset re-arms the toasts. Pure diff logic
  (`achievement-diff.ts`) is unit-tested.
- **Global toast system** (`src/app/core/ui/toast/`) — a reusable
  `ToastService` + `pv-toasts` stack (bottom-right, `aria-live="polite"`,
  click to dismiss, auto-dismiss after 6 s, capped at 4). Feature-local inline
  toasts (Spire, World, RPG) are unchanged; this is for cross-cutting
  notifications.

## v1.2.0 — 2026-07-03

### Added

- **Recent Pokémon in the palette** — the command palette now opens with a
  *Recent* group: the last eight detail pages you visited, most recent first,
  with sprite thumbnails. Recorded at the data layer
  (`PokemonDetailService.load` success → `RecentPokemonService`), so every way
  of reaching a detail page counts; deduplicated and persisted. Pure list
  logic (`pushRecent`) is unit-tested.
- **Accent themes** — an *Appearance* section on the Trainer Profile with five
  curated palettes (Aurora default, Ember, Verdant, Sakura, Solar). The new
  `ThemeService` (`src/app/core/theme/`) overrides the `--accent*` design
  tokens on `<html>`, so the whole app retints instantly; the choice persists
  and is re-applied at startup by the shell. Picking Aurora removes the
  overrides so the stylesheet defaults rule again.

### Documentation

- New feature doc `docs/features/command-palette.md`; index, app-shell and
  profile docs updated accordingly.

## v1.1.0 — 2026-07-03

### Added

- **⌘K Command Palette** (`src/app/features/command-palette/`) — a global
  overlay opened with `Ctrl+K` (or the topbar search pill) that offers:
  - *Go to* — every page, searchable by name and hidden keywords
    (e.g. "gym" finds the Arena).
  - *Actions* — "Surprise me" (random Pokémon detail page), shiny-sprite
    toggle, jump to favorites.
  - *Pokémon* — live search over the Pokédex index by name or #number with
    sprite thumbnails; `Enter` opens the detail page.
  - Fully keyboard-driven (`↑`/`↓`, `Enter`, `Esc`), ARIA combobox/listbox
    semantics, backdrop click closes. Lazy-loaded via `@defer (on idle)` so it
    costs the initial bundle nothing.
- **Pokédex skeleton loading** — the first load now shows 12 shimmering
  placeholder cards (staggered fade-in) instead of a spinner; screen readers
  still get a loading status announcement.

### Changed

- **Router view transitions** — `withViewTransitions()` plus a fade-out /
  rise-in animation between pages (View Transitions API). Unsupported browsers
  skip it; `prefers-reduced-motion` disables it.
- **Topbar** — new search pill (icon-only on mobile, `Ctrl K` hint on desktop,
  full "Search…" label ≥1600px), a subtle shadow once the page scrolls, and
  `min-height` instead of a fixed height so the 11-item nav wraps gracefully
  inside the glass panel on mid-size screens (previously it could overflow).
- **Buttons** — global `:active` press feedback (tiny scale-down) for snappier
  micro-interactions.
