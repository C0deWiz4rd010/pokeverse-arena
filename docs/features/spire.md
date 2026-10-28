# Ascension Spire (roguelike)

A seeded, run-based climb that consumes the full depth of the battle engine.

Route: `/spire`.

## What it does

- **Draft a starting trio.** A seeded offering of six random Pokémon (level 65) is shown; the player keeps three.
- **Climb 15 floors.** Each floor offers a choice of nodes: Battle, Elite, Rest, Treasure, Event or Shop. Floors 5, 10
  and 15 offer a single Boss node instead.
- **HP carries between fights.** There is no free healing. Rest nodes (+50 %), potions (+40 %), events (+35 %) and the
  shop's Full Restore are the only recovery, so every battle is a resource decision.
- **Reward drafts after each win.** Three options (four with the Type Lens relic) drawn from: recruit a Pokémon, equip a
  held item, take a relic, heal the party, or bank coins. A full party converts a recruit into coins.
- **Relics** are run-long modifiers (ten in total): coin multiplier (Lucky Coin), extra reward choice (Type Lens), stat
  multipliers (Vitamin Boost, Swift Feather, Guardian Shell, Berserker Band) and item grants (Leftovers Aura, Sand Charm,
  Focus Charm, Mega Battery). A duplicate relic refunds 40 coins.
- **Shops** sell three held items, one relic and a Full Restore for coins; prices rise with depth.
- **Bosses** field four Pokémon at the elite AI tier.
- **Secret chimera bosses.** On floor 10 (25 %) and floor 15 (40 %) the guardian may be a Chimera Keeper whose ace is a
  genuine Fusion Lab splice (`fuseBattlers`): spliced name, fused types and stats, an interleaved four-move set and a
  hue-shifted sprite. The keeper brings three regular Pokémon plus the ace, whose donors are built two levels above the
  keeper's other Pokémon. The door only hints at it ("sounds stitched together"). Beating one pays 60 bonus coins, counts toward the
  Chimera Slayer / Myth Hunter achievements and adds a unique **Tame** reward that puts the chimera in the party.
- **Meta-progression** persists: best depth, runs, clears, banked coins, chimeras slain and an **ascension tier** (max 10)
  that rises on each clear and adds +4 foe levels per tier.
- **Daily run** uses a stable per-day seed (`dailySeed('spire')`), including the same chimera roll for everyone.
- **Continue run.** A snapshot is saved at the start of every floor; after a reload the hub offers "Continue run
  (floor N)". Winning, losing or abandoning clears it.

## Files

| Path | Responsibility |
| ---- | -------------- |
| `src/app/game/spire/spire-types.ts` | Node, foe-spec, reward, shop-entry, run-phase and meta types. |
| `src/app/game/spire/spire.ts` | Seeded generators: `generateFloorChoices`, `generateFoe`, `generateRewards`, `generateShop`; floor, level, AI-tier and chimera-chance curves. |
| `src/app/game/spire/relics.ts` | Relic registry plus `coinMultiplier`, `rewardChoiceBonus`, `applyRelicsToTeam`. |
| `src/app/game/spire/meta.ts` | Meta-progression load/save and `recordRun` / `recordChimeraWin`, persisted through `appStore` (`pv:spire:meta`). |
| `src/app/game/spire/index.ts` | Barrel for the four modules above. |
| `src/app/game/run/run-economy.ts` | Shared with the Odyssey: `coinsEarned`, `grantRelic` (duplicate refund), `equipFirstFree`. |
| `src/app/game/run/run-snapshot.ts` | Defensive parsing of the stored run (`parseSpireRun`, `parseRunCore`, `isBattlerLike`). |
| `src/app/features/spire/spire.service.ts` | Run orchestration: draft, floor map, battles, rewards, shop, recruit, resume, end of run. |
| `src/app/features/spire/spire.ts`, `spire.html`, `spire.scss` | Hub with meta, draft, run HUD with climb track and party HP, node map, reward and shop screens, win/loss finales. |

## How it works

- **Everything is seeded.** Floor layouts, foes, rewards and shops derive from `runSeed` plus the floor number, so a daily
  seed reproduces the same climb. New runs use `spire-<random>`.
- **Fights reuse `pv-tournament-match`** (`features/tournaments/tournament-match`) via a `PlayerMatchSetup`, so status,
  abilities, items, weather, terrain and hazards all apply. The player team is `applyRelicsToTeam(party, relics)`.
- **State is signals.** `SpireService` keeps `party` and `hpFraction` as signals next to `floor`, `coins`, `relics`,
  `phase`, `choices`, `rewards` and `shop`. Carried HP is stored as a fraction of the relic-boosted max HP, so it stays
  consistent when a relic changes stats; after a fight it is read back from `outcome.playerFinalHp`.
- **Difficulty curve.** Foe level is `28 + 3·floor (+6 boss) + 4·ascension`. The AI tier is basic up to floor 4, strong up
  to floor 9, elite from floor 10; bosses are always elite. Fight coins are `25 + 6·floor`, plus 30 for an elite and 80
  for a boss.
- **Run snapshot.** `persistRun()` writes `{ seed, floor, coins, relics, party, hpFraction, choices }` to the `spire:run`
  key of `SaveService` (stored as `pv:spire:run`) whenever a floor starts. `parseSpireRun` validates the stored blob field
  by field and returns `null` for anything unusable, so a damaged save simply hides the button. `resumeRun()` restores the
  floor with the same node choices.
- **Meta** is loaded and saved through the versioned `appStore`; the old raw `spire:meta` key is imported once through
  `LEGACY_SOURCES`. The Trainer Profile reads the same meta for its records row and the achievements.

## Key decisions

- **Seed per decision, not per run.** Each generator builds its own `SeededRng` from the seed plus a label and the floor,
  so adding a new random call in one place never shifts the rolls elsewhere.
- **Fractional HP.** A relic bought mid-run changes max HP; storing fractions avoids stale absolute values.
- **Pure game modules, thin service.** Generation, relics, economy and snapshot parsing live in `game/**` without Angular
  imports; the service only owns signals, toasts and storage calls.
- **Shared economy with the Odyssey.** Coin income, duplicate-relic refunds and item equipping live in
  `game/run/run-economy.ts` so both modes behave the same.
- **Resume at a floor boundary.** Snapshotting at the start of a floor means a reload can never land in the middle of a
  fight; the cost is that choices made after the snapshot (a shop purchase, a node pick) are replayed.
- **Defensive restore.** Stored runs are untrusted input, so `parseRunCore` checks every battler field the engine reads and
  clamps HP fractions to 0..1.

## Accessibility & mobile

- Every action is a real `<button>`; errors use `role="alert"`; the climb track has an `aria-label` ("Floor N of 15") and
  each party HP bar is a `role="progressbar"` with min, max and now values.
- Spinners announce a label while a draft or a challenger loads.
- Motion in the Spire styles is disabled under `prefers-reduced-motion`.
- The battle itself is the shared match component, so its keyboard and touch behaviour is documented in
  [battle.md](battle.md) and [tournaments.md](tournaments.md).

## Tests

- `src/app/game/spire/spire.spec.ts`: generation determinism, floor and level scaling, rewards, shops, chimera odds, meta.
- `src/app/game/spire/relics.spec.ts`: coin multiplier, reward bonus, team application.
- `src/app/game/run/run-economy.spec.ts`, `src/app/game/run/run-snapshot.spec.ts`: shared economy and defensive parsing.
- `src/app/features/spire/spire.service.spec.ts`, `spire.service.flow.spec.ts`: service state, battles, rewards, recruiting,
  non-battle nodes, abandoning and ending.
- `src/app/features/spire/run-resume.spec.ts`: snapshot write, restore and clearing.
- `src/app/features/spire/spire.spec.ts`: the component's phases and buttons.
