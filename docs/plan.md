# PokéVerse Arena — Deep Game-Systems Overhaul

> Living implementation plan. Each phase ships as one focused commit on `develop`.
> Status is updated as work progresses.

| Phase | Scope | Status |
| ----- | ----- | ------ |
| 0 | Engine data model & registries (status, stages, weather, terrain, abilities, items) | ⏳ |
| 1 | Turn-engine rewrite + tiered AI | ⏳ |
| 2 | Mid-battle switching in 3v3 | ⏳ |
| 3 | Battle feature UI (expose depth) | ⏳ |
| 4 | Arena build-out (designed leaders, ladder, Elite Four, rewards) | ⏳ |
| 5 | Tournament build-out (formats, seeding, standings, prizes) | ⏳ |
| 6 | New system: Ascension Spire (roguelike) | ⏳ |
| 7 | Progression backbone (core/storage + profile) | ⏳ |
| 8 | Contest, World, Team deepening | ⏳ |
| 9 | Docs, tests, polish, ship | ⏳ |

## Context

Every battle-driven system rests on a mechanically shallow core. The engine
(`src/app/game/engine`) knows only: damage, STAB, type effectiveness, crit, a
damage roll, priority/speed ordering, PP, and a one-ply greedy AI. It has **no**
status conditions, stat stages, abilities, held items, in-battle weather/terrain
mechanic, entry hazards, secondary move effects, or switching. Status moves do
nothing. Arena leaders are "top-3 BST of a type"; tournaments are single-elim with
random pairing and no prizes; Contest/World/Team are thin; there is no progression
backbone.

**Goal:** deepen the shared engine once so Battle, Arena, Tournament and the new
system inherit the depth; build out Arena and Tournament; add an **Ascension
Spire** roguelike; add a progression backbone; deepen Contest, World, Team.

**Invariant:** all game logic stays pure, deterministic (seeded RNG),
framework-free in `src/app/game/**`, unit-tested; services expose signals;
components stay thin + OnPush + mobile-first + reduced-motion.

## PHASE 0 — Engine data model & registries

New `src/app/game/engine/` files: `stat-stages.ts` (−6..+6 multiplier tables),
`status.ts` (burn/poison/toxic/paralysis/sleep/freeze + residuals + gates),
`weather.ts` (sun/rain/sand/hail/snow damage mods + chip), `terrain.ts`
(electric/grassy/psychic/misty), `abilities.ts` (~30 data-driven hooks),
`items.ts` (held-item hooks). Extend `battle-types.ts` (move `secondary`/`drain`/
`recoil`/`multiHit`/`flags`; battler `ability`/`item`; side `status`/`stages`/
`volatiles`; new `BattleEvent` kinds). Specs for each.

## PHASE 1 — Turn-engine rewrite

Rewrite `Battle` into a canonical loop: action select (move|switch) → switch
resolution (hazards, switch-in abilities) → ordering (priority, adjusted speed,
seeded tiebreak) → execution (gates, accuracy, immunity, full damage pipeline,
secondary effects, drain/recoil, contact triggers) → end-of-turn residuals
(weather, terrain, items, status, leech, counters) → faint/winner. New `ai.ts`
tiered evaluator (`random|basic|strong|elite`). Update engine specs.

## PHASE 2 — Switching in 3v3

Extend `simulateMatch` + `tournament-match` so a side may switch mid-battle;
headless AI decides switches; HP/status carry preserved.

## PHASE 3 — Battle feature UI

Status badges, stat-stage arrows, weather+terrain banner, ability/item chips,
switch tray, move tooltips, richer log. Optional pre-battle loadout. Reduced-
motion + mobile-first.

## PHASE 4 — Arena build-out

Designed leader identities (signature team + abilities + items + role plan +
weather/terrain theme + AI tier + dialogue); badge ladder + difficulty curve;
Elite Four + Champion gauntlet (no heal between, HP/PP/status carry); rematches;
badge rewards wired to the profile.

## PHASE 5 — Tournament build-out

`BracketFormat`: single-elim, double-elim, round-robin (group → playoff), swiss;
`standings.ts`; seeding by strength; configurable field/team size; best-of-N;
prizes + records + history; optional draft ban/protect. New UI.

## PHASE 6 — Ascension Spire (new system)

Pure seeded run engine in `game/spire/` (map-gen, rewards, relics, shop,
ascension, run state machine) + `features/spire/` UI (run setup, node map,
battles, reward draft, shop, rest, event, summary) + meta-progression. New route
`/spire` + nav + icon.

## PHASE 7 — Progression backbone

`core/storage/save.service.ts` (versioned, typed, namespaced) + `core/models/
profile.ts` + `features/profile/`: name/title, currency, achievements, records,
unlocks. Migrate `arena:badges`. Wire all reward sources.

## PHASE 8 — Contest, World, Team deepening

Contest: multi-round appeals + combos + jamming + rank ladder. World:
expedition/encounter loop + personal dex. Team: role/synergy analyzer with
suggestions.

## PHASE 9 — Docs, tests, polish, ship

Update `docs/features/*` + roadmap; add `spire.md` + `profile.md`. Full a11y +
reduced-motion + mobile pass. Keep suite green.

## Verification

- `npx vitest run` green after every phase (start 74 tests).
- `npx ng build` succeeds (strict TS) before each commit.
- Manual smoke via `npm start` per phase.
- One focused commit per phase on `develop`.
