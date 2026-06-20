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
