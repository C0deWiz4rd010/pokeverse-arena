# Battle

Seeded, type-accurate 1-v-1 battles with an animated arena, weather backdrops and a Daily Challenge — all running on the same engine that powers every other battle mode in the app.

## What it does

- **Pick a fighter** by name or dex number (datalist autocomplete from the Pokédex index) or hit **Surprise me**. The foe is a random Pokémon; both sides are built at level 50 with a four-move set (see "How it works").
- **Turn-based fights.** Click a move or press the number keys **1–4**. Moves are disabled when they are out of PP or when a Choice lock, Encore or a charging move forces another one; when every move is out of PP a single **Struggle** button replaces them.
- **Full mechanics on screen.** Status badges, stat-stage chips, volatile chips (Substitute, Confused, Seeded, Taunted, Encore, Charging, Recharging, Move locked), field chips (screens, Tailwind, Trick Room with turns left), the ability/item of each fighter, and a weather/terrain banner.
- **Animated playback.** HP bars drain, sprites shake and flash, floating damage numbers and a `CRITICAL!` burst appear, and the log narrates super-effective/resisted hits, crits, faints and the result. A result panel offers **Rematch** or **New battle**.
- **Battle speed.** A 1×/2×/3× chip on the arena re-paces all animation beats; the choice persists.
- **Weather backdrops.** Each fight gets an atmosphere (clear, sun, rain, thunderstorm, sandstorm, snow, fog, windswept leaves) with CSS particles. Real engine weather wins over the type-derived ambience.
- **PixiJS effect layer.** A lazily loaded WebGL overlay paints type-coloured impact bursts, crit flashes and charge swirls.
- **Daily Challenge.** One deterministic matchup (and battle seed) per UTC day, identical for every trainer. The first attempt of the day counts toward a consecutive-day win streak (current / best / wins on the setup card); retries replay the same seeded battle for fun. A counted win shows a streak toast. `/battle?daily=1` (used by the command palette) starts it automatically. The result panel offers a Wordle-style share text (one emoji per turn: effectiveness, crit, miss) via the native share sheet or the clipboard.

The 1-v-1 component has no switching and no Terastallization; those live in party battles (see [tournaments.md](tournaments.md)), which use the same engine.

## Files

| Path | Responsibility |
| ---- | -------------- |
| [game/engine/battle-core.ts](../../src/app/game/engine/battle-core.ts) | `BattleCore`: the shared turn mechanics (move execution, residuals, volatiles, special damage, side/field conditions). |
| [game/engine/battle.ts](../../src/app/game/engine/battle.ts) | `Battle`: the 1-v-1 host — a faint ends the match; exposes `takeTurn`, `forcedMove`, `mustStruggle`, AI helpers. |
| [game/engine/team-battle.ts](../../src/app/game/engine/team-battle.ts) | `TeamBattle`: the party host (switching, hazards, Terastallization, pivots). |
| [game/engine/battle-types.ts](../../src/app/game/engine/battle-types.ts) | `Battler`, `BattleMove`, `BattleSide`, `BattleState`, the `BattleEvent` union, `freshField`/`freshVolatiles`. |
| [game/engine/damage.ts](../../src/app/game/engine/damage.ts) | Pure `computeDamage`, `stabFor` / `stabForSide` (Tera-aware), effectiveness helpers. |
| [game/engine/ai.ts](../../src/app/game/engine/ai.ts) | `chooseAiMove` and the `random / basic / strong / elite` tiers. |
| `game/engine/status.ts`, `stat-stages.ts`, `weather.ts`, `terrain.ts`, `hazards.ts`, `field-effects.ts` | Pure rule modules: status conditions, ±6 stages, weather, terrain, entry hazards, screens / Tailwind / Trick Room. |
| [game/engine/abilities.ts](../../src/app/game/engine/abilities.ts), [items.ts](../../src/app/game/engine/items.ts) | Declarative registries: 41 abilities, 42 held items. |
| [game/engine/move-convert.ts](../../src/app/game/engine/move-convert.ts) | Maps PokéAPI move DTOs to `BattleMove`s (secondary effects, ailments incl. confusion, special-damage moves, utility moves). |
| [game/engine/rules.ts](../../src/app/game/engine/rules.ts) | Optional `BattleRules` (inverse chart, weather-boosted type) used by tournament modes. |
| [core/battle/battler-factory.ts](../../src/app/core/battle/battler-factory.ts) | `BattlerFactory`: builds engine-ready `Battler`s from the API; shared by Battle, Arena, Tournaments, Spire, Odyssey and the RPG. |
| [features/battle/battle.ts](../../src/app/features/battle/battle.ts) (+ `.html`, `.scss`) | `BattleComponent`: setup form, daily card, arena, move buttons, result. |
| [features/battle/battle-presenter.ts](../../src/app/features/battle/battle-presenter.ts) | `BattlePresenterBase`: the event → log / HP / FX pipeline shared by the quick battle, the party match and the RPG battle. |
| [features/battle/battle-view.ts](../../src/app/features/battle/battle-view.ts) | Pure `stageChips`, `volatileChips`, `fieldChips`. |
| [features/battle/state-chips.ts](../../src/app/features/battle/state-chips.ts) | `pv-state-chips` / `pv-field-chips` components. |
| [features/battle/pixi/battle-fx.ts](../../src/app/features/battle/pixi/battle-fx.ts) | `pv-battle-fx` PixiJS overlay. |
| [features/battle/daily.service.ts](../../src/app/features/battle/daily.service.ts) | Daily state: today's matchup, persisted streak record, result reporting, win toast. |
| [game/daily/daily.ts](../../src/app/game/daily/daily.ts) | Pure daily logic: UTC day key, deterministic matchup, streak fold, share text. |
| [core/ui/weather-overlay/](../../src/app/core/ui/weather-overlay/weather.ts) | `Ambience` model (`pickWeather`, `AMBIENCE_FOR_ENGINE`) and the `pv-weather-overlay` particle backdrop. |
| `core/ui/move-button/` | Shared `pv-move-button` (type tint, effectiveness badge, hotkey hint, tooltip). |

## How it works

- **One turn core.** `Battle` and `TeamBattle` are thin hosts over `BattleCore`; they only define the format (a faint ends a duel; a party sends in the next member). Fixing a mechanic once fixes both.
- **Turn loop.** Entry abilities, then actions ordered by priority, adjusted Speed (Tailwind, Trick Room, paralysis, stages) and a seeded tie-break, then move execution and end-of-turn residuals (status, weather, terrain, Leech Seed, items).
- **Damage.** The standard formula with STAB ×1.5 (Terastallized: the original-type STAB is kept, the Tera type gains STAB, and a Tera type matching an original type doubles it — see `stabForSide`), type effectiveness, a ×1.5 crit and a 0.85–1.0 roll, plus screens, abilities and items. All randomness goes through one `SeededRng`, so `(player, opponent, seed)` reproduces a battle exactly. `golden-master.spec.ts` hashes the event logs of 40 duels and 40 team battles to guard refactors; a deliberate mechanics change regenerates them.
- **Mechanics covered.** Statuses (burn, poison, toxic, paralysis, sleep, freeze), ±6 stat stages, sun / rain / sand / snow, four terrains, Stealth Rock / Spikes / Toxic Spikes, Reflect / Light Screen / Aurora Veil (snow only), Tailwind, Trick Room, confusion (2–5 turns), Substitute, Taunt, Encore, Protect, Leech Seed, recharge and two-turn moves, Struggle, Choice locks, multi-hit / drain / recoil, fixed and fractional damage, Knock Off, Terastallization and pivot moves (party battles).
- **AI.** `chooseAiMove` scores each usable move with a tiny seeded jitter. `basic` is power × STAB × effectiveness; `strong` and `elite` estimate real damage, spot guaranteed KOs, value priority finishers and weigh status, setup and field control. The quick battle's foe plays `strong`.
- **Battlers.** `BattlerFactory.buildBattler(idOrName, level = 50)` derives stats with `quickStats`, takes the first modelled ability (non-hidden preferred), and picks up to four moves from the 14 first level-up candidates: the strongest damaging ones, with one slot given to a useful status move when the species has one. If nothing qualifies it falls back to Struggle. With `{ levelMoves: true }` (RPG) it uses the moves known at that level instead.
- **Presenter.** `BattlePresenterBase` owns the visual state signals and a paced `playEvents` walker; screens override hooks (`onSwitched`, `onFainted`, `onImpact`, `onEnd`, `syncSide`) rather than forking the pipeline. `applyBattleState(me, foe, field)` mirrors stages, weather/terrain turns, volatile chips and field chips from the engine after each turn.
- **Weather.** `pickWeather` maps each fighter's types to ambiences (fire → sun, water → rain, electric → storm, ice → snow, rock/ground/steel → sand, grass/bug → leaves, ghost/dark/poison/psychic/fairy → fog) and a seeded pick chooses, so a matchup always gets the same sky; live engine weather overrides it.
- **Daily.** `dailyMatchup(key)` seeds an RNG with `daily-<YYYY-MM-DD>` for two dex ids at level 50. `recordDailyResult` counts only the first attempt per day; the record is stored under `daily:record` via `SaveService` (`pv:` envelope).

## Key decisions

- **Pure engine, dumb UI.** All rules live in `game/engine` with no Angular or DOM dependency, so they are unit-testable and reused headlessly by the tournament simulator.
- **One core, two hosts.** Duplicated mechanics had drifted apart (Leech Seed, Magic Guard, log texts); a single `BattleCore` plus golden-master hashes prevents that.
- **Seeded everything.** Damage rolls, crits, ties, AI jitter and weather are reproducible — the basis for the Daily Challenge and for deterministic CPU matches.
- **Shared presenter.** One event pipeline for three battle screens keeps pacing, FX and state chips consistent.
- **Official artwork, CSS weather.** Artwork stays sharp at any size; weather is CSS particles so it is light and honours reduced motion. Pixi is only for the impact layer.

## Accessibility & mobile

- Phones stack the fighters vertically; from `md` they sit in opposite corners. Below 768 px the page header hides once the fight starts, cards and bars shrink and the log is height-capped so moves stay in thumb reach.
- HP bars are `role="progressbar"` with a label and value; the battle log is `aria-live="polite"`; the speed chip has a title and `aria-label`; moves are real buttons with `aria-label` and a hotkey hint; errors use `role="alert"`.
- `prefers-reduced-motion` disables weather animation and hit feedback; the Pixi canvas is never created for users who prefer reduced motion or lack WebGL.
- Log lines, item/ability names and chip labels are translated (German data in `core/i18n/de.data*.ts`).

## Tests

- Engine: `damage.spec.ts`, `battle.spec.ts`, `battle-mechanics.spec.ts`, `engine-mechanics.spec.ts`, `team-battle.spec.ts`, `ai.spec.ts`, `status.spec.ts`, `stat-stages.spec.ts`, `weather.spec.ts`, `terrain.spec.ts`, `hazards.spec.ts`, `rules.spec.ts`, `move-convert.spec.ts`, `registries.spec.ts`, and `golden-master.spec.ts` (event-log hashes).
- Factory: `core/battle/battler-factory.spec.ts`.
- UI: `features/battle/battle.spec.ts` (component and daily flow), `battle-view.spec.ts`, `daily.service.spec.ts`; pure daily logic in `game/daily/daily.spec.ts`; the weather backdrop in `core/ui/weather-overlay/weather-overlay.spec.ts`.
