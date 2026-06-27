# Contest Hall — Berry Poffins & Contest Mode

Blend berries into a Poffin mix to raise a Pokémon's contest conditions, then
enter one of the five contests and dazzle the judges against a field of seeded
rivals.

## What it does

- **Berry pantry** — every flavoured berry is pulled from the PokéAPI and listed
  with its potency for the chosen contest. Selecting a contest category
  highlights the berries that feed it.
- **Poffin mix** — pick up to four berries. Their five flavours (spicy, dry,
  sweet, bitter, sour) accumulate into the five contest conditions (Cool, Beauty,
  Cute, Smart, Tough), shown as live bars.
- **Performer on stage** — defaults to Eevee; swap to any Pokémon by name or dex
  number to show off its official artwork.
- **Contest run** — entering a contest scores the performer's appeal in the chosen
  category, generates three seeded rivals, and ranks the whole field with a
  win/place banner. "Perform again" re-rolls with a fresh seed.

## Files

| File | Responsibility |
| ---- | -------------- |
| [game/contest/contest.ts](../../src/app/game/contest/contest.ts) | Pure logic: categories, flavour↔category mapping, `mixConditions`, `appealScore`, `runContest`. |
| [game/contest/contest.spec.ts](../../src/app/game/contest/contest.spec.ts) | Unit tests: mapping, mix totals, scoring monotonicity, deterministic contest. |
| [features/contest/contest.service.ts](../../src/app/features/contest/contest.service.ts) | State (loading / ready / error), pantry loading, mix selection, performer swap, contest run. |
| [features/contest/contest.ts](../../src/app/features/contest/contest.ts) / [.html](../../src/app/features/contest/contest.html) / [.scss](../../src/app/features/contest/contest.scss) | The component: performer, category picker, condition bars, berry pantry, result. |

## How it works

- **Five requests, full pantry.** Rather than fetching each berry individually,
  the service hits the five `berry-flavor/{flavor}` endpoints. Each returns every
  berry that carries that flavour with its potency, so merging the five lists
  reconstructs each berry's complete flavour profile cheaply (cache-first via the
  shared `PokeApiClient`).
- **Flavours feed conditions.** `mixConditions` maps spicy→Cool, dry→Beauty,
  sweet→Cute, bitter→Smart, sour→Tough and sums the selected berries.
- **Appeal & rivals are pure and seeded.** `appealScore` combines the chosen
  condition, a stage-presence base, a small smoothness bonus for a tidy mix and a
  seeded sparkle of showmanship. `runContest` adds three seeded rivals and ranks
  the field — fully deterministic for a given seed, so the same inputs reproduce
  the same result.

## Design notes

- Mobile-first: the two panels stack below `lg` and sit side-by-side above it;
  the berry grid uses `auto-fill`.
- The mix is capped at four berries; unpicked berries disable once the mix is
  full.
- All transitions are disabled under `prefers-reduced-motion`.

## Deep overhaul (v2)

Contests are now a **multi-round performance**: four appeal turns with a **combo**
carry (the previous round's top performer) and **jamming** (the leader takes a
comeback penalty), plus a **rank ladder** (Normal → Super → Hyper → Master) where
rivals scale and a win promotes you. Rank persists. See [../plan.md](../plan.md)
phase 8.

## Live performance (v2.1)

The contest is now an interactive, animated mini-game instead of an auto-run.

- **Two acts.** *Backstage* keeps the berry/Poffin prep (condition bars, theme);
  then **Take the stage** starts a live performance.
- **Turn-by-turn appeals.** Each of four rounds you pick one of five appeal moves
  (one per category). Scoring blends the move's base, your Poffin **conditions**,
  an on-theme bonus and a little seeded flair.
- **Combos & boredom.** Appeals form a cyclic chain (cool→beauty→cute→smart→
  tough→cool); playing the next link **doubles** the appeal (×2 combo, highlighted
  live), while repeating a category **bores the crowd** for a penalty — a real
  risk/reward each turn. The "tough" move **startles rivals**, cutting their
  appeal that round.
- **Animated stage.** A swaying performer, floating hearts, a pop-in heart gain
  with combo/jam/bored tags, and a live **judge meter** of your hearts vs the
  rivals'.
- **Ribbons & ranks.** Winning earns the category's **ribbon** (persisted, shown
  in a ribbon case) and promotes you up the rank ladder
  (Normal → Super → Hyper → Master); rivals scale with rank.

Pure, seeded, unit-tested logic in `game/contest/performance.ts` (appeal moves,
round resolution, combos/boredom/jam, ranking); the auto-run `runAppealContest`
remains for tests/headless use. All animations honour `prefers-reduced-motion`.
