# Odyssey (endless roguelike)

A PokéRogue-inspired, endless, seeded march through cycling biomes — the counterpart to the [Ascension Spire](spire.md)'s
fixed climb. Where the Spire is a 15-floor draft-and-relic run, the Odyssey never ends: waves only get taller, every
defeated foe can be caught, and every catch permanently grows your starter roster.

Route: `/odyssey`.

## What it does

- **Eight biomes, ten waves each**, cycling forever: Whisper Meadow, Gloomtangle Forest, Echo Cavern, Siren Coast,
  Cinderpeak, Frostveil Tundra, Hollow Ruins, Dragon's Roost. Each has its own species pool, header tint and a guardian
  boss on its tenth wave. Every full lap adds +15 foe levels.
- **Wave cadence.** Wild encounters (1 foe), elite packs on every 5th wave (2 foes, +2 levels) and guardians on every 10th
  (2 foes with the biome's boss last, +4 levels). The AI tier is basic below wave 10, strong below wave 30, elite after.
- **Daze-catch.** Winning a wave dazes the last foe for one catch window: throw Poké Balls (65 % wild, 45 % elite, 25 %
  guardian per throw). A catch joins the party (two levels below the wave, minimum 15) and permanently unlocks the species as a
  starter. With a full party the catch only unlocks the starter.
- **Growth between waves.** The whole team gains +1 / +2 / +3 levels (wild / elite / guardian) and members auto-evolve at
  their level-up evolution level (live PokéAPI chain lookup, cache-first, via `game/evolution`).
- **Reward drafts.** After the catch window pick one of three seeded rewards drawn from five: team heal (+40 %), ball cache
  (+2 balls), Rare Candy (+2 levels for the lowest-level member), held item, or a coin purse.
- **Carried HP.** No free healing between waves; HP rides as max-HP fractions, as in the Spire.
- **Economy and relics.** Coins are earned per wave. A **wandering trader** appears after each guardian: balls, a 60 % heal,
  held gear and two relics. Relics are the Spire's registry (a curated pool of seven) and boost the live team each fight.
- **Guardian fields.** Every biome boss imposes its biome's weather or terrain from turn one, shown on the wave preview and
  passed to the shared match as `setup.field`.
- **Meta-progression** (`pv:odyssey:meta`): best wave, runs, total catches and the unlocked starter roster (base:
  Bulbasaur, Charmander, Squirtle, Pikachu). It feeds the Trainer Profile (records, rank score and the Wayfarer, Endless
  Marcher and Roster Builder achievements).
- **Daily march** uses a per-day seed (`dailySeed('odyssey')`).
- **Continue run.** A snapshot is saved at the start of every wave; the hub offers "Continue run (wave N)" after a reload.

## Files

| Path | Responsibility |
| ---- | -------------- |
| `src/app/game/odyssey/odyssey.ts` | Pure logic: biomes, `waveSpec`, level and coin curves, reward and shop generation, meta load/save, starter roster. |
| `src/app/game/evolution/evolution.ts` | `levelUpEvolutions` (chain to species-to-step map) and `evolutionAt`; level-up trigger only. Also re-exported for the Adventure by `game/rpg/evolution.ts`. |
| `src/app/game/run/run-economy.ts` | Shared coin, duplicate-relic and item helpers (also used by the Spire). |
| `src/app/game/run/run-snapshot.ts` | `parseOdysseyRun` and the shared defensive parsing of stored runs. |
| `src/app/game/spire/relics.ts` | Relic registry and `applyRelicsToTeam`, reused as-is. |
| `src/app/features/odyssey/odyssey.service.ts` | Run orchestration: starter pick, fights, daze-catch, growth and evolution, rewards, trader, resume, end of run. |
| `src/app/features/odyssey/odyssey.ts`, `odyssey.html`, `odyssey.scss` | Hub, starter roster, biome-tinted wave preview, catch window, reward and trader cards, run summary, party strip. |

## How it works

- **Phases.** `OdysseyService.phase` moves hub, starter, wave, battle, catch, reward, (shop after a guardian), wave again,
  and lost. The shared `pv-tournament-match` plays the fight.
- **State is signals.** Party and HP fractions are private signals next to `wave`, `balls`, `coins`, `relics`, `spec`,
  `daze` and `runUnlocks`. Fights are built from `waveSpec(wave, seed)`; the player team is `applyRelicsToTeam`.
- **Catching happens after victory.** `afterVictory()` pays coins, levels the team, then opens the daze window on the last
  foe. Each throw is rolled from `SeededRng(seed-catch-wave-attempt)`, so the outcome is reproducible.
- **Growth.** `rebuildMember` looks up the species and its evolution chain, evolves when `evolutionAt` says so and rebuilds
  the battler at the new level through `BattlerFactory`, keeping the held item. Network failures leave the old build.
- **Snapshot.** `persistRun()` writes the run to the `odyssey:run` key of `SaveService` (stored as `pv:odyssey:run`) as each
  wave starts. `parseOdysseyRun` validates it; `resumeRun()` rebuilds the wave spec from the seed. Ending or abandoning a
  run removes it.
- **Meta** goes through the versioned `appStore`; the old raw `odyssey:meta` key is imported once via `LEGACY_SOURCES`.

## Key decisions

- **Reuses `pv-tournament-match`** so every fight gets the full engine without a new battle UI.
- **Catch after the fight, not during.** It keeps the match component untouched, makes balls a scarce resource and gives
  guardians a real risk/reward hook (25 % catch chance).
- **Starter unlocks are the meta loop.** The roster is the lasting trophy case, so even an early wipe advances the
  collection.
- **Everything seeded.** Wave species, catch rolls, rewards and trader stock derive from the run seed, so a daily seed
  reproduces the same march for everyone.
- **Level-up evolutions only.** Item, trade and happiness evolutions are intentionally ignored.
- **Shared run modules.** Economy and snapshot logic are shared with the Spire instead of duplicated.

## Accessibility & mobile

- Toasts use `role="status"`, errors `role="alert"`; the relic strip has an `aria-label`.
- Actions are real buttons; spinners announce a label during fights and rebuilds.
- Motion is disabled under `prefers-reduced-motion`.
- The fight screen is the shared match component (see [tournaments.md](tournaments.md)).

## Tests

- `src/app/game/odyssey/odyssey.spec.ts`: biome cycling, wave cadence, level curve, determinism, rewards, shop, meta.
- `src/app/game/evolution/evolution.spec.ts`: chain parsing and `evolutionAt`.
- `src/app/game/run/run-economy.spec.ts`, `run-snapshot.spec.ts`: shared helpers and defensive parsing.
- `src/app/features/odyssey/odyssey.service.spec.ts`, `odyssey.service.flow.spec.ts`: fight setup, post-battle flow, catching,
  rewards and growth.
- `src/app/features/odyssey/odyssey.spec.ts`: component rendering of each phase.
