# Battle

Seeded, type-accurate 1-v-1 battles with an animated arena and weather backdrops.

## What it does

- **Pick a fighter** by name or dex number (datalist autocomplete), or hit
  **Surprise me** for a random matchup. Both sides fight at level 50 with their
  strongest level-up moves.
- A **pure, seeded battle engine** resolves each turn: move order, accuracy,
  STAB, type effectiveness, criticals and damage are all computed deterministically.
- An **animated arena** plays the turn back: HP bars drain, sprites shake and
  flash on hit, the battle log narrates ("super effective!", "critical hit!",
  faints), and a victory/defeat banner offers **Rematch** or **New battle**.
- **Weather backdrops** — each battle gets a fitting atmosphere (sun, rain,
  thunderstorm, sandstorm, snow, fog, windswept leaves or clear) derived from the
  fighters' types, with animated particle effects.
- **PixiJS effect layer** — a lazily-loaded WebGL overlay paints type-coloured
  impact bursts, crit flashes and charge swirls on each hit. It degrades
  gracefully: if WebGL is unavailable or the user prefers reduced motion the
  canvas is never created and the battle still plays with its CSS animations.
- **Daily Challenge** (v1.4.0) — one deterministic matchup per UTC day, derived
  from the date: same fighters, same battle seed for every trainer worldwide.
  The first attempt of the day counts toward a consecutive-day win streak
  (current/best/wins shown on the setup card, persisted); retries replay the
  identical seeded battle for fun. A counted win pops a streak toast. Deep
  link `/battle?daily=1` (used by the ⌘K palette action) auto-starts it.
  The result panel offers a **Wordle-style share text** (one emoji per turn:
  effectiveness, crits, misses) via the native share sheet or clipboard, and
  streak milestones feed two achievements (*On Fire*, *Eternal Flame*) plus a
  🔥 chip on the home dashboard.

## Files

| File | Responsibility |
| ---- | -------------- |
| `game/engine/battle-types.ts` | `Battler`, `BattleMove`, `BattleSide`, `BattleEvent` (discriminated union), `BattleState`. |
| `game/engine/damage.ts` | Pure `computeDamage()` (Gen V+ formula) + `resolveDamage`, `stabFor`, `moveEffectiveness` helpers. |
| `game/engine/battle.ts` | `Battle` class: turn resolution, action ordering, seeded tie-breaks, simple expected-damage AI. |
| `game/engine/index.ts` | Barrel export for the engine. |
| `core/battle/battler-factory.ts` | `BattlerFactory` — builds `Battler`s from the API (stats, types, move pool), picks battle sprites. Shared by Battle, Arena, Tournaments, Spire, Odyssey (`features/battle/battle.service.ts` is an alias kept for the Adventure code). |
| `core/ui/weather-overlay/weather.ts` | Cosmetic backdrop model (`Ambience`, `AMBIENCE_INFO`, `AMBIENCE_FOR_ENGINE`, `pickWeather`). |
| `core/ui/weather-overlay/` | Shared `pv-weather-overlay` particle backdrop (used by battle, tournaments, arena). |
| `core/ui/move-button/` | Shared `pv-move-button` (type-tinted, effectiveness badge, hover tooltip). |
| `features/battle/pixi/battle-fx.ts` | Lazy `pv-battle-fx` PixiJS overlay: impact bursts, crit flashes, charge swirls. |
| `features/battle/battle.ts` / `.html` / `.scss` | The component: setup form, daily-challenge card, animated arena, weather overlays, log, move buttons, result. |
| `game/daily/daily.ts` (+ spec) | Pure daily logic: UTC day key, deterministic matchup, streak record fold. |
| `features/battle/daily.service.ts` | Daily state: persisted streak record, result reporting, win toast. |
| `game/engine/battle-core.ts` | `BattleCore` — the shared turn mechanics (move execution, residuals, state atoms) used by both engines. |
| `game/engine/battle.ts` / `team-battle.ts` | The 1-v-1 duel and the party engine (switching, hazards, Tera, pivots) — thin hosts over the core. |
| `game/engine/field-effects.ts` | Screens, Tailwind and Trick Room descriptors and maths. |
| `game/engine/damage.spec.ts` / `battle.spec.ts` / `battle-mechanics.spec.ts` | Engine unit tests. |
| `game/engine/golden-master.spec.ts` | Replays 80 seeded random battles and compares event-log hashes — guards refactors. |

## How it works

- **Engine.** `computeDamage` implements the standard formula
  $((\frac{2L}{5}+2)\cdot P\cdot\frac{A}{D}/50 + 2)\times\text{mods}$, where mods are
  STAB (×1.5), type effectiveness (from the tested type chart), a critical roll
  (×1.5) and the 0.85–1.0 random factor. All randomness flows through a
  `SeededRng`, so a `(player, opponent, seed)` triple always reproduces the same
  battle.
- **Turn order.** Actions sort by move priority, then Speed, then a seeded
  coin-flip on ties. The AI (`chooseAiMove`) scores each move by expected power ×
  effectiveness and picks the best.
- **Battlers.** `buildBattler` fetches a Pokémon (cache-first), derives level-50
  stats via `quickStats`, collects its types, and selects up to four damaging
  level-up moves (falling back to Struggle).
- **Sprites.** The arena uses the **high-resolution official artwork** so fighters
  stay crisp at desktop sizes; the player's sprite is flipped to face the foe.
- **Weather.** `pickWeather` maps each fighter's types to an atmosphere
  (fire→sun, water→rain, electric→storm, ice→snow, rock/ground/steel→sand,
  grass/bug→leaves, ghost/dark/poison/psychic/fairy→fog) and a seeded pick chooses
  among the candidates, so the same matchup always gets the same sky. The
  component renders a `.weather` layer with a tinted sky plus CSS-animated
  particles (rain streaks, drifting snow, blowing sand, fog banks, sun rays,
  falling leaves, lightning flashes).
- **Playback.** `playEvents` walks the engine's `BattleEvent[]`, awaiting short
  delays between beats to animate HP changes, shake/flash hits and append log lines.

## Key decisions

- **Pure engine, dumb UI.** All game math lives in `game/engine` with no Angular
  or DOM dependencies, which is what makes it unit-testable and reusable (e.g. a
  future tournament simulator).
- **Seeded everything.** A single RNG drives damage rolls, crits, tie-breaks and
  weather — enabling reproducible battles and future replays/daily challenges.
- **Official artwork over Showdown sprites.** The small animated pixel sprites
  blurred when scaled up; the artwork is sharp on every screen size.
- **CSS particles, not a canvas.** Weather is pure CSS so it stays lightweight and
  fully honors `prefers-reduced-motion`. A richer PixiJS scene is a later phase.

## Mobile-first

The arena stacks the two fighters vertically on phones and spreads them to
opposite corners from `md` up; move buttons are a 2-column grid throughout. All
weather animations and hit feedback are disabled under `prefers-reduced-motion`.

## Tests

`damage.spec.ts` and `battle.spec.ts` cover determinism, speed/priority ordering,
immunity, STAB/crit/super-effective scaling, KO → winner, no-ops after a battle
ends, AI move selection and PP tracking — 17 tests, part of the green suite.

## Deep overhaul (v2)

The engine is now a full main-series turn loop: **status conditions** (burn/
poison/toxic/paralysis/sleep/freeze with residuals + move gates), **stat stages**
(−6..+6), **abilities** (~34, e.g. Intimidate/Levitate/Drought/Blaze/Sturdy),
**held items** (Leftovers/Life Orb/Choice/Focus Sash/berries/orbs/rocks),
**in-battle weather & terrain**, **entry hazards**, **secondary effects**,
**multi-hit/drain/recoil**, and a **tiered AI** (`basic|strong|elite`). Wild
Pokémon get a real ability and move secondaries mapped from the PokéAPI; the UI
shows status badges, stat-stage chips, the field banner and ability/item chips.
See [../plan.md](../plan.md) phases 0–3.

## Shared battle presenter

`features/battle/battle-presenter.ts` hosts the event→log/HP/FX pipeline
(visual-state signals, paced `playEvents` walker, float/log/pulse atoms) used
by the quick battle, the tournament match and the RPG battle. Components
override hooks (`onSwitched`, `onFainted`, `onImpact`, `onEnd`, timing table)
instead of forking the pipeline.

The presenter also owns the **battle speed** (v1.12): a persisted 1×/2×/3×
setting (`pv:battle:speed`) that divides every pacing beat via the shared
`wait()` helper. Each battle UI surfaces it as a small `.speed-chip` overlay
on its arena (top-right; top-left in the RPG, whose foe box sits right), so
one tap re-paces the quick battle, tournament matches *and* RPG fights alike.

## Mobile fit pass (v1.12)

Below 768 px a fight fits one screen with the moves in thumb reach: the page
header hides once the battle starts (`.battle.in-fight`), sprites and info
cards shrink, badge/HP-bar sizes tighten and the log caps at ~110 px. The RPG
battle got the same treatment (field 225 px min, log 74 px, denser commands).

## Engine v3 — one core, deeper mechanics (v3.0.6)

- **One turn core.** `Battle` and `TeamBattle` no longer duplicate the mechanics: both host `BattleCore`, which owns move
  execution, residuals and the atoms. Fixing it once fixes both (Leech Seed, Magic Guard and the log texts used to differ).
  `golden-master.spec.ts` hashes the event logs of 40 duels and 40 team battles; a refactor must leave them untouched, a
  deliberate mechanics change regenerates them.
- **Side & field conditions.** Reflect, Light Screen, Aurora Veil (snow only), Tailwind and Trick Room, with turn counters,
  banner events (`field`) and AI scoring.
- **Volatiles.** Confusion (2–5 turns, 1/3 self-hit), Substitute, Taunt, Encore, Protect (spam-proof), Leech Seed (also in party
  battles), recharge and two-turn moves (Solar Beam skips the charge in sun), Struggle when out of PP, Choice locks.
- **Special damage.** Fixed (Seismic Toss, Night Shade, Dragon Rage), fractional (Super Fang) and Knock Off (removes the item on
  a copy, ×1.5 vs holders).
- **Abilities** (+7): Mold Breaker, Sheer Force, Prankster, Moxie, Clear Body, Download, Tough Claws. **Items** (+21): Weakness
  Policy, Air Balloon, Heavy-Duty Boots and the 18 type-boosting items.
- **Party battles.** Terastallization (once per team, a `tera` flag on the move action: single defensive type, STAB rules),
  pivot moves (U-turn, Volt Switch: the user owes a switch via `mustSwitch`/`forceSwitch`, resolved at the end of the turn),
  Heavy-Duty Boots / Magic Guard vs hazards.
- **Gen 9 weather.** Hail is gone: the Hail move sets Snow, which no longer chips.
- `move-convert.ts` maps the new moves by name and by the PokéAPI `confusion` ailment; the German log lines and item/ability
  names are in `de.data.ts`.

## Battle UI v3 — shared presenter state & the new mechanics (v3.0.7)

- **One presenter base.** `BattlePresenterBase` now owns the state every battle screen mirrors from its engine — stat stages,
  weather/terrain and their turns, volatile chips and field chips — through a single `applyBattleState(me, foe, field)`; Battle and
  the party match (`tournament-match`) lost their duplicated signals, stage-chip helpers and number-key parsing.
- **Pure view helpers.** `features/battle/battle-view.ts` builds the stage chips, the per-side volatile chips (Tera, Substitute,
  Confused, Seeded, Taunted, Encore, Charging, Recharging, Move locked) and the field chips (screens, Tailwind, Trick Room with owner
  and turns); `pv-state-chips` / `pv-field-chips` render them.
- **Tera button.** Party matches show *Terastallize · <type>* while the team's Tera is unused (hotkey `T`); the next move carries
  `tera: true`.
- **Locks & Struggle.** Moves are disabled when a Choice lock, Encore or a charging move forces another one; when every move is out
  of PP a single *Struggle* button replaces them (both screens).
- **Pivots.** After U-turn / Volt Switch the tray opens with "Choose who takes over!" (the CPU switches automatically).
- New `field`, `substitute` and `tera` events are narrated in the log (translated).
