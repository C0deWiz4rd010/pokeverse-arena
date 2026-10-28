# Arena — Type-Themed Gym Leaders & Badges

The Arena is a single-player progression hub: beat eighteen gym leaders (one per Pokémon type) in 3-v-3 matches to earn their badges, then take on the Elite Four and the Champion.

## What it does

- **Gym ladder hub.** Eighteen leader cards in a recommended order, each tinted with its type colour: name, title, type badge, a scoutable thumbnail strip of the leader's signature team (ace flagged), a badge medallion (lit when earned) and a star ribbon. A glowing **badge case**, an `earned / 18` progress bar, total stars, the active badge-boost summary and an **Arena Champion** banner once crowned.
- **VS splash.** Before every fight: leader portrait, title and intro line, both team previews, the gym's battlefield, your badge boosts, an estimated **win-chance bar** with a verdict, **type-matchup chips** and a suggested **lead**. Pressing *Battle!* starts the match.
- **Designed leaders.** Each leader fields a signature team (specific species with thematic abilities and held items), fights at a level and AI tier that ramp with the ladder position, and has dialogue (including a taunt when the ace comes out). Elemental gyms open in a persistent weather or terrain.
- **Badge boosts.** Every earned badge permanently adds +4 % to one mapped stat for your team in Arena fights.
- **Stars and coins.** A win scores 3 stars for a flawless clear, 2 for one faint, 1 otherwise; the best rating per gym is kept. Coins pay out by ladder position, first clear, stars and rematch.
- **Reward screen.** Animated badge award (first clear), star pop, coin payout and a callout when the Champion Gauntlet has just unlocked.
- **Rematches.** A cleared leader can be fought again at higher level, with the ace sent out twice and elite AI, for more coins.
- **Champion Gauntlet.** Unlocks with 8 badges: four Elite trainers and the Champion back to back at level 75 with elite AI; your HP carries between fights. Each win pays coins, the full run crowns you Champion.
- **Reset.** The hub can reset badges, champion flag and stars (coins are kept).

## Files

| Path | Responsibility |
| ---- | -------------- |
| [game/arena/gym-leaders.ts](../../src/app/game/arena/gym-leaders.ts) | Pure data: 18 `GymLeader`s (flavour, signature `LeaderMon` teams, dialogue, `gymField`), `LEADER_LADDER`, `leaderLevel`, `leaderTier`. |
| [game/arena/elite-four.ts](../../src/app/game/arena/elite-four.ts) | `GAUNTLET` (four Elite trainers + Champion), `GAUNTLET_UNLOCK_BADGES`, `gauntletUnlocked`. |
| [game/arena/gym-progression.ts](../../src/app/game/arena/gym-progression.ts) | Pure ladder helpers: badge-stat map and multipliers, boost summary, `starsFor`, `buildLadder`, `arenaProgress`. |
| [game/arena/match-setup.ts](../../src/app/game/arena/match-setup.ts) | `playerTrainer` and `dummyMatch` builders for the synthetic bracket match. |
| [features/arena/arena.service.ts](../../src/app/features/arena/arena.service.ts) | `ArenaService` facade and screen state machine: `hub / loading / intro / battle / reward / gauntlet / error`. |
| [features/arena/arena-progress.store.ts](../../src/app/features/arena/arena-progress.store.ts) | `ArenaProgressStore`: persisted badges, champion flag, coins and best stars. |
| [features/arena/arena-teams.service.ts](../../src/app/features/arena/arena-teams.service.ts) | `ArenaTeams`: builds leader / Elite / player teams and applies badge boosts. |
| [features/arena/arena-gauntlet.service.ts](../../src/app/features/arena/arena-gauntlet.service.ts) | `ArenaGauntlet`: the Elite Four + Champion run with HP carry, coins and crowning. |
| [features/arena/arena.ts](../../src/app/features/arena/arena.ts) (+ `.html`, `.scss`) | `pv-arena`: hub, VS splash with intel, reward screen, embedded matches. |
| [features/tournaments/tournament-match/](../../src/app/features/tournaments/tournament-match/tournament-match.ts) | The shared interactive 3-v-3 match component the Arena embeds. |

## How it works

- **Challenge flow.** `ArenaService.challenge(leader, rematch)` builds the foe team and the player team in parallel at the leader's level, applies badge boosts to the player, then publishes a `PlayerMatchSetup` (a one-off `final` match from `dummyMatch`, `aiTier`, `field` = the gym's weather/terrain, an accent colour and the ace taunt) and shows the VS splash. `beginBattle()` switches to `pv-tournament-match`; `finish(outcome)` computes stars, coins, badge and the reward.
- **Difficulty ladder.** `leaderLevel(order) = 16 + 3 × order` (about Lv 19 to Lv 70); `leaderTier`: orders 1–4 `basic`, 5–12 `strong`, 13–18 `elite`. Rematches add 12 levels and use `elite`.
- **Teams.** Leader and Elite teams are built per species through `BattlerFactory` and then overridden with the designed ability and held item; species that fail to load are skipped. The player's team is the first three Team Builder members at the fight's level, or a random trio when the roster is empty. Gauntlet trainers are fixed (levels 70, 71, 72, 73 and 76 for the Champion), while the player's team is built at level 75.
- **Fields.** Fire → sun, Water → rain, Rock and Ground → sand, Ice → snow, Electric / Grass / Psychic / Fairy → their terrains; other types have none.
- **Badge boosts.** `BADGE_STAT` maps each type to a stat; `badgeStatMultipliers` adds `BADGE_BOOST_PER` = 0.04 per badge, applied as rounded stat multipliers in `ArenaTeams.applyBadgeBoosts`.
- **Coins.** Gym win: `order × 10`, +40 on first clear, +8 per star, +30 on a rematch. Gauntlet: 60 per cleared stage and 300 for the title.
- **Gauntlet.** `ArenaGauntlet` owns the run (`start`, `advance`, `loadMatch`, `end`); the facade only tracks the screen. `advance` carries `playerFinalHp` into the next match; a loss ends the run, finishing the Champion awards coins and calls `crown()`.
- **VS-splash intel.** Computed in `arena.ts` from the already-built teams using `game/tournament` (`winOdds`, `scoutMatchup`, `bestLead`) — no extra requests. Verdicts: Favoured (≥ 66 %), Slight edge (≥ 55), Even match, Underdog (> 34), Long shot.
- **Persistence.** `ArenaProgressStore` writes through `SaveService` (`EnvelopeStore`, `pv:` keys): `arena:badges`, `arena:champion`, `arena:coins`, `arena:stars`; legacy raw keys are imported once.

## Key decisions

- **Reuse the party match.** The Arena feeds a synthetic `PlayerMatchSetup` into `pv-tournament-match`, so weather, effectiveness badges, switching, Tera and the shared presenter come for free; optional `field`, `accent` and `foeAce` on the setup carry the gym theme.
- **Facade plus three collaborators.** Progress storage, team building and the gauntlet run are separate injectables; `ArenaService` only sequences screens and rewards, which keeps each piece testable.
- **Designed, not generated.** Leader teams are hand-authored data (species, ability, item) so each gym teaches a theme; difficulty scales through level and AI tier rather than random rosters.
- **Pure ladder maths.** Stars, boosts, progress and the next recommended gym are pure functions in `game/arena`.
- **Fair by default.** A player without a saved team can still jump in with a random trio.

## Accessibility & mobile

- The ladder is a single column on phones (mobile-first SCSS).
- Progress bar uses `role="progressbar"` with value/max; the win-chance bar is `role="img"` with a text label; star rows and the leader team strip carry `aria-label`s; decorative icons and bursts are `aria-hidden`.
- Badge-award, star-pop and hub animations are disabled under `prefers-reduced-motion`.
- Everything inside the match inherits the battle screen's behaviour (see [battle.md](battle.md)).

## Tests

- Pure data and logic: `game/arena/gym-leaders.spec.ts`, `elite-four.spec.ts`, `progression.spec.ts`; intel helpers in `game/tournament/odds.spec.ts` and `scouting.spec.ts`.
- Services: `features/arena/arena.service.spec.ts`, `arena-progress.store.spec.ts`, `arena-teams.service.spec.ts`, `arena-gauntlet.service.spec.ts`.
- Component: `features/arena/arena.spec.ts`.
