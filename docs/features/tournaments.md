# Tournaments

A 16-trainer, single-elimination tournament with **ten formats**, a visual
bracket that converges to a centered final, and a "you play your matches, the
field auto-resolves" flow built on the seeded battle engine.

## What it does

- **Pick one of ten modes** from a card grid, each with its own rules:
  - **Classic Cup** — 16 power-balanced random teams.
  - **Mono-Type Cup** — a single type is drawn for the whole bracket (you included).
  - **Random Cup** — zero balancing, pure variance.
  - **Little Cup** — only low base-stat / unevolved Pokémon.
  - **Legendary Cup** — only high base-stat / legendary Pokémon.
  - **Draft Mode** — draft your three Pokémon from a shared pool first.
  - **Survival Gauntlet** — surviving Pokémon keep their HP between rounds.
  - **Inverse Cup** — the type chart is flipped for every match.
  - **Weather Wars** — each match rolls weather that boosts one move type ×1.5.
  - **Boss Ascent** — opponents' levels climb each round to a Final boss.
- **A visual bracket** seeds 16 trainers into the Round of 16 → Quarterfinals →
  Semifinals → Final. On desktop it renders as a **tree converging from both
  edges into a centered final and champion crown**; on phones it becomes a
  horizontally-scrollable round-by-round bracket. Winners highlight, losers dim,
  and the player's live match pulses.
- **You compete.** Your matches are played interactively as **3-v-3
  sequential-KO battles** (real moves, animated arena, HP bars, team trays). When
  you win, the bracket advances you and **every remaining CPU match auto-resolves**
  headlessly up to your next match — or to the champion.

## Files

| File | Responsibility |
| ---- | -------------- |
| `game/engine/rules.ts` | `BattleRules` + rule-aware effectiveness (`inverse` chart) and `weatherBoost`. |
| `game/tournament/types.ts` | `Trainer`, `Bracket` / `BracketMatch`, `RoundId`, `MatchResult` (carries final HP). |
| `game/tournament/modes.ts` | The ten `TournamentMode` configs, `modeById`, `levelForRound` (Boss Ascent ramp). |
| `game/tournament/simulate.ts` | Pure headless 3-v-3 `simulateMatch` (sequential KO, optional start HP). |
| `game/tournament/bracket.ts` | `buildBracket`, immutable `reportResult`, `nextReadyMatch`, `playerMatch`. |
| `game/tournament/index.ts` | Barrel export for the tournament domain. |
| `features/tournaments/tournaments.service.ts` | Generates balanced trainer teams from the API, runs the bracket, auto-simulates CPU matches, tracks the player match + Survival HP carry. |
| `features/tournaments/tournaments.ts` / `.html` / `.scss` | Mode select, draft, run bar, CTA / finale, and the desktop tree + mobile scroll bracket. |
| `features/tournaments/tournament-match/*` | The interactive 3-v-3 player match component. |
| `game/engine/rules.spec.ts`, `game/tournament/simulate.spec.ts`, `game/tournament/bracket.spec.ts` | Unit tests for rules, simulation and bracket progression. |

## How it works

- **Rule-aware engine.** `rules.ts` adds an optional `BattleRules` threaded
  through `resolveDamage` and the `Battle` class. `inverse` flips the type chart
  (resists/immunities become weaknesses); `weatherBoostType` multiplies a single
  move type by 1.5. Everything stays backward-compatible — the normal battle
  passes no rules.
- **Headless simulation.** `simulateMatch` reuses the deterministic `Battle`
  engine for each duel of a 3-v-3. The losing side sends in its next Pokémon while
  the winner **keeps the damage it took within the match**. Callers may seed
  starting HP (Survival carries HP across rounds) and read every Pokémon's final
  HP back from the result. A turn cap guarantees termination.
- **Bracket.** `buildBracket` pairs 16 seeded trainers into 8 opening matches;
  `reportResult` returns a **new** bracket with the winner advanced into the next
  round's correct slot (or crowns the champion at the final). `nextReadyMatch` and
  `playerMatch` drive the runner.
- **Team generation.** The service samples Pokémon from the API (cache-first),
  gates the candidate pool by **base-stat total** (Little = lowest, Legendary =
  highest) or by **type** (Mono-Type), then **snake-distributes** them across the
  16 teams sorted by BST so balanced modes stay fair. The **player's** Pokémon get
  real level-up moves; the ~45 CPU Pokémon get lightweight, type-accurate
  synthesized moves to keep generation to a single request each.
- **Mode rules at match time.** Inverse and Weather Wars produce `BattleRules`
  per match (Weather Wars seeds a random boost type from the match id). Boss
  Ascent scales every non-player team's stats by `levelForRound / baseLevel` so
  the field grows tougher each round while your team stays fixed.
- **Flow.** Winning a player match calls `recordPlayerOutcome`, which advances the
  bracket and then loops `simulateMatch` over every CPU match until the next
  player match (or the champion) — Survival HP carry is tracked per trainer.

## Key decisions

- **Reuse the pure engine.** Both the interactive match and the headless
  simulator run the exact same `Battle`/`computeDamage` code, so balance and rules
  behave identically whether you play or the CPU auto-resolves.
- **Player competes; CPU auto-resolves.** You only play your own matches; the rest
  of the field is simulated instantly, keeping a 16-trainer run fast.
- **Light CPU move sets.** Fetching real moves for ~45 Pokémon per tournament was
  far too many requests; synthesized STAB-accurate moves keep generation to one
  request per Pokémon while preserving meaningful type matchups. The human always
  gets real moves.
- **Snake draft for balance.** Sorting candidates by BST and snake-distributing
  them evens out total team strength across the bracket without a reject loop.
- **Two bracket layouts.** A converging two-sided tree is the desktop hero look;
  a horizontal-scroll bracket is the robust mobile equivalent — same card,
  different container.

## Mobile-first

The mode grid is one column on phones and scales to five across on `xl`. The
bracket is a horizontally-scrollable, snap-aligned set of round columns below
`lg` and a converging tree at `lg`+. The match arena stacks the fighters, uses a
2-column move grid on phones (4 from `md`), and all hit/pulse animations honor
`prefers-reduced-motion`.

## Tests

`rules.spec.ts` covers the inverse chart and weather boost; `simulate.spec.ts`
covers sweeps, determinism, intra-match HP persistence and seeded HP carry;
`bracket.spec.ts` covers seeding, immutable advancement, round-by-round
readiness, the player match and crowning a champion — 15 tests, part of the green
suite (59 total).

## Deep overhaul (v2)

Beyond the seeded knockout bracket, tournaments now run **league formats** —
**Round-Robin** and **Swiss** — decided on a live **standings table** (wins, KO
differential). Fields are **power-seeded**, runs award **prizes**, and a persisted
**history** records each result. The shared match component shows the full deep
HUD. See [../plan.md](../plan.md) phase 5.

## Tournaments v2 — polish

A visual/animation pass over the existing format engine.

- **Champion finale**: a confetti burst, a bobbing crown and a glowing champion
  portrait when you win the cup.
- **Bracket** matches pop in; the player's live match pulses; eliminated slots dim
  and the champion spot animates in.
- **Standings** rows stagger in with 🥇🥈🥉 podium highlighting and a player-row
  outline.
- Animated lobby cards and a pulsing "Battle ›" call-to-action.

All motion respects `prefers-reduced-motion`.
