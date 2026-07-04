# Odyssey (endless roguelike)

A PokéRogue-inspired, endless, seeded march through cycling biomes — the
counterpart to the [Ascension Spire](spire.md)'s fixed climb. Where the Spire
is a 15-floor draft-and-relic run, the Odyssey never ends: waves only get
taller, every defeated foe can be caught, and every catch permanently grows
your starter roster.

Route: `/odyssey`.

## What it does

- **Eight biomes, ten waves each**, cycling forever (each full lap adds a hard
  +15 foe levels): Whisper Meadow → Gloomtangle Forest → Echo Cavern → Siren
  Coast → Cinderpeak → Frostveil Tundra → Hollow Ruins → Dragon's Roost. Each
  has its own species pool, header tint and a **guardian boss** on wave 10.
- **Wave cadence** — wilds (1 foe), **elite packs** every 5th wave (2 foes,
  +2 levels), **guardians** every 10th (+4 levels, biome's boss species last).
  AI tier scales: basic → strong (wave 10) → elite (wave 30).
- **Daze-catch** — winning a wave dazes the lead foe for one catch window:
  throw limited Poké Balls (65% wild / 45% elite / 25% guardian per throw).
  A catch joins the team (level-matched) *and* permanently unlocks the species
  as a starter.
- **Growth between waves** — the whole team levels (+1/+2/+3 by wave kind),
  and members **auto-evolve** when they pass their evolution level (live
  PokéAPI chain lookup, cache-first).
- **Reward drafts** — after the catch window, pick one of three seeded
  rewards: team heal, ball cache, Rare Candy (+2 levels to the lowest member)
  or a held item for a bare-handed member.
- **Carried HP** — no free healing between waves; HP rides as max-HP fractions
  exactly like the Spire.
- **Meta-progression** (`odyssey:meta`): best wave, runs, total catches and
  the **unlocked starter roster** (base: Bulbasaur/Charmander/Squirtle/Pikachu).
  Surfaced on the Trainer Profile (two records rows + three achievements:
  Wayfarer / Endless Marcher / Roster Builder) and feeds the rank score.
- **Daily march** — a per-day seed for a shared challenge.

### Economy & relics (v1.8.0)

- **Coins** are earned per wave (scaling with wave + kind) and spent at a
  **wandering trader** that appears after each guardian falls: restock balls,
  buy a heal, grab a held item, or purchase one of two **relics**.
- **Relics** are the Spire's run-long boons, reused here — held relics boost the
  live team each fight (`applyRelicsToTeam`) and show as chips under the party.
- **Guardian fields** — every biome boss imposes a persistent battlefield from
  turn one (its biome's terrain or weather), shown on the wave preview and
  handed to the shared match via `setup.field`.

## Files

| File | Responsibility |
| ---- | -------------- |
| `game/odyssey/odyssey.ts` | Pure logic: biomes, wave specs (kind/species/level/catch chance), reward generation, meta persistence + starter roster. |
| `game/odyssey/odyssey.spec.ts` | Biome cycling, wave cadence, level curve, determinism, reward drafts, meta unlocks. |
| `features/odyssey/odyssey.service.ts` | Run orchestration: starter pick, wave building, battle outcomes, daze-catch, level-up/evolution rebuilds, rewards, meta. |
| `features/odyssey/odyssey.ts/.html/.scss` | Hub, starter roster, biome-tinted wave preview, catch window, reward cards, run summary, party strip. |

## Key decisions

- **Reuses `pv-tournament-match`** (like the Spire) so every fight gets the
  full engine — status, abilities, items, weather, switching — without a new
  battle UI.
- **Catching happens *after* victory** (the daze window) instead of mid-battle:
  it keeps the shared match component untouched, makes the catch a strategic
  resource decision (balls are scarce, rewards restock them), and gives bosses
  a real risk/reward hook.
- **Starter unlocks are the meta loop** — the roster is the run's lasting
  trophy case, so even a wave-3 wipe can advance your collection.
- **Everything seeded** — wave species, catch rolls and reward drafts derive
  from the run seed, so a daily seed reproduces the same march for everyone.
