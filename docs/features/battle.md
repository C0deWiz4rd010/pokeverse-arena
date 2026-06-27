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

## Files

| File | Responsibility |
| ---- | -------------- |
| `game/engine/battle-types.ts` | `Battler`, `BattleMove`, `BattleSide`, `BattleEvent` (discriminated union), `BattleState`. |
| `game/engine/damage.ts` | Pure `computeDamage()` (Gen V+ formula) + `resolveDamage`, `stabFor`, `moveEffectiveness` helpers. |
| `game/engine/battle.ts` | `Battle` class: turn resolution, action ordering, seeded tie-breaks, simple expected-damage AI. |
| `game/engine/index.ts` | Barrel export for the engine. |
| `features/battle/battle.service.ts` | Builds `Battler`s from the API (stats, types, move pool), picks battle sprites. |
| `features/battle/battle-weather.ts` | Re-exports the shared weather model (now in `core/ui/weather-overlay/weather.ts`). |
| `core/ui/weather-overlay/` | Shared `pv-weather-overlay` particle backdrop (used by battle, tournaments, arena). |
| `core/ui/move-button/` | Shared `pv-move-button` (type-tinted, effectiveness badge, hover tooltip). |
| `features/battle/pixi/battle-fx.ts` | Lazy `pv-battle-fx` PixiJS overlay: impact bursts, crit flashes, charge swirls. |
| `features/battle/battle.ts` / `.html` / `.scss` | The component: setup form, animated arena, weather overlays, log, move buttons, result. |
| `game/engine/damage.spec.ts` / `battle.spec.ts` | Engine unit tests. |

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
