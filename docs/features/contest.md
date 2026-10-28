# Contest Hall — Berry Poffins & Contest Mode

Blend berries into a Poffin mix to raise a Pokémon's contest conditions, then take the stage in a live four-round appeal performance against three seeded rivals.

## What it does

- **Two acts.** *Backstage* is the prep bench (performer, contest category, berry mix, condition bars); **Take the stage** starts the live performance; a result screen follows.
- **Berry pantry.** Every flavoured berry from the PokéAPI, ordered by total potency. Choosing a contest category highlights the berries that feed it.
- **Poffin mix.** Pick up to four berries (`MAX_MIX`); the other berries disable once the mix is full. Their flavours add up into five conditions — spicy → Cool, dry → Beauty, sweet → Cute, bitter → Smart, sour → Tough — shown as live bars.
- **Performer.** Defaults to Eevee; swap to any Pokémon by name or dex number (official artwork). A failed search shows a message and keeps the current performer.
- **Live appeals.** Four rounds; each round you play one of five appeal moves (one per category). Chaining the next link of the cycle cool → beauty → cute → smart → tough → cool **doubles the move's base** (combo, hinted live); repeating a category **bores the crowd** (−8 per previous use); the *tough* move **startles** the rivals (−8 to −16 on each rival's appeal that round); appealing in the contest's own category earns a +10 theme bonus.
- **Animated stage.** Swaying performer, floating hearts, per-round outcome with combo / jam / bored tags and a judge meter of your hearts against the best rival.
- **Ranks and ribbons.** Winning earns the category ribbon (ribbon case) and promotes you Normal → Super → Hyper → Master; rivals get stronger with rank. Both persist.

## Files

| Path | Responsibility |
| ---- | -------------- |
| [game/contest/contest.ts](../../src/app/game/contest/contest.ts) | Pure model: categories and flavours, `mixConditions`, `MAX_MIX`, ranks (`CONTEST_RANKS`, `rankInfo`, `nextRank`) with rival appeal bands, plus the headless `runContest` / `runAppealContest`. |
| [game/contest/performance.ts](../../src/app/game/contest/performance.ts) | Pure live performance: `APPEAL_MOVES`, `startPerformance`, `appeal`, `performanceRanking`, `wouldCombo`. |
| [features/contest/contest.service.ts](../../src/app/features/contest/contest.service.ts) | `ContestService`: pantry loading, mix, performer, phase (`prep / stage / result`), rank and ribbons, finalisation. |
| [features/contest/contest.ts](../../src/app/features/contest/contest.ts) (+ `.html`, `.scss`) | `pv-contest`: performer, category picker, condition bars, pantry, stage, result. |

## How it works

- **Five requests, full pantry.** `loadPantry` calls the five `berry-flavor/{flavor}` endpoints and merges them into one profile per berry, so no per-berry fetch is needed (cache-first via `PokeApiClient`).
- **Round scoring.** `appeal()` computes `base 24 + round(0.6 × condition) + theme (10) + combo (24) − boredom (8 × earlier uses) + showmanship (0–10, seeded)`, floored at 1. Rivals each roll an appeal in the rank's band (Normal 30–66, Super 42–80, Hyper 56–92, Master 70–104), reduced when the player plays the jam move. State is returned immutably, so the service just sets a signal.
- **Determinism.** Each performance seed combines performer, category, rank, mix and an attempt counter; each round derives its RNG from `seed-r<round>`, so a given seed always replays identically while "Perform again" re-rolls.
- **Finish.** After round four `performanceRanking` ranks the four entrants by total hearts. A win records the ribbon (`contest:ribbons`) and, below Master, the next rank (`contest:rank`), both through `SaveService` (`pv:` envelope keys).
- **Headless runs.** `runContest` (single appeal) and `runAppealContest` (four rounds with combo carry and leader jamming) are pure helpers exercised by the specs; the UI uses `performance.ts`.

## Key decisions

- **Pure, seeded rules; thin service.** All scoring lives in `game/contest`, framework-free and unit-tested; the service handles loading, selection and persistence.
- **Risk and reward per turn.** The combo cycle and boredom penalty make the move choice matter, while conditions from the Poffin mix scale appeal so prep has a visible payoff.
- **Rank as difficulty.** Rivals scale through a per-rank appeal band instead of separate content; promotion on win gives a clear progression loop.
- **Cheap pantry.** Five flavour endpoints instead of one request per berry.

## Accessibility & mobile

- The prep panels stack below `lg` and sit side by side above it; the berry grid uses `auto-fill`.
- Berry buttons are real buttons that disable when the mix is full; the Take-the-stage button is disabled until a berry and a performer exist; the ribbon case has an `aria-label`; decorative icons and hearts are `aria-hidden`.
- Stage animations and transitions are disabled under `prefers-reduced-motion`.

## Tests

- `game/contest/contest.spec.ts` (flavour mapping, mix totals, seeded contest, multi-round appeals and ranks) and `game/contest/performance.spec.ts` (appeal moves, combos, boredom, jam, ranking).
- `features/contest/contest.service.spec.ts` (pantry, mix cap, performer, performance flow, ribbons and rank persistence) and `contest.spec.ts` (component).
