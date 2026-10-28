# Tournaments

Ten themed modes on three formats (single elimination, round robin, Swiss): you play your own matches as interactive 3-v-3 party battles, and the rest of the field auto-resolves on the seeded engine.

## What it does

- **Pick a format and a mode.** Formats: **Single Elimination** (16 trainers, seeded bracket), **Round Robin** (8 trainers, everyone plays everyone) and **Swiss** (16 trainers, `ceil(log2 n)` rounds paired by record). Modes:
  - **Classic Cup** — 16 power-balanced random teams.
  - **Mono-Type Cup** — one type drawn for the whole field, you included.
  - **Random Cup** — no balancing.
  - **Little Cup** — lowest base-stat Pokémon, level 30.
  - **Legendary Cup** — highest base-stat Pokémon, level 70.
  - **Draft Mode** — draft three from a pool of nine (knockout format only).
  - **Survival Gauntlet** — your surviving Pokémon keep their HP between rounds (level 55).
  - **Inverse Cup** — the type chart is flipped.
  - **Weather Wars** — every match rolls a type that is boosted 1.5×.
  - **Boss Ascent** — opponents gain +6 levels per round from level 45.
- **Interactive matches.** Your match is a 3-v-3 on the party engine: choose a move or a switch each turn, Terastallize once per team, answer forced switches and pivots. Every CPU match up to your next one (or to the champion) is resolved instantly.
- **Visual bracket.** Round of 16 → Quarterfinals → Semifinals → Final. A converging two-sided tree with a centred final and crown on large screens, a horizontally scrolling round-by-round bracket on phones. Cards show power seeds and a projected odds bar; your live match pulses, losers dim.
- **League standings.** Round-robin and Swiss show a table ranked by 3 points per win, then KO differential, then KOs dealt, then name.
- **Pre-match intel.** Win-chance estimate (5–95 %) with a verdict, type-matchup scout chips and a suggested lead.
- **Persistent rival.** One generated nemesis per profile takes over the strongest CPU entry of every run, keeps a head-to-head record, taunts you before the match and gains +1 level per past meeting (max +6).
- **Crystal-ball pick'em.** Before your first match, call the champion from an avatar strip. A correct call adds 20 ₽ × a ×2–×25 multiplier (from the pick's implied win probability) to the prize; you may back yourself.
- **Prizes, history and career.** Each finished run is logged (mode, format, placement, champion, prize, pick bonus); the lobby shows a career strip and the last 30 runs. The finale has confetti and a champion crown.

## Files

| Path | Responsibility |
| ---- | -------------- |
| [game/tournament/types.ts](../../src/app/game/tournament/types.ts) | `Trainer`, `Bracket` / `BracketMatch`, `RoundId`, `MatchResult`, `PlayerMatchSetup`, `MatchOutcome`. |
| [game/tournament/modes.ts](../../src/app/game/tournament/modes.ts) | The ten `TournamentMode` configs, `modeById`, `levelForRound`. |
| [game/tournament/format.ts](../../src/app/game/tournament/format.ts) | `BracketFormat` infos and power-seeding (`seedSlots`, `seedTrainers`). |
| [game/tournament/bracket.ts](../../src/app/game/tournament/bracket.ts) | `buildBracket`, immutable `reportResult`, `nextReadyMatch`, `playerMatch`. |
| [game/tournament/match-runner.ts](../../src/app/game/tournament/match-runner.ts) | `rulesForMode`, `teamForRound`, `bracketMatchSetup`, `runAiMatches`. |
| [game/tournament/simulate.ts](../../src/app/game/tournament/simulate.ts) | Headless 3-v-3 `simulateMatch` on `TeamBattle`. |
| [game/tournament/league.ts](../../src/app/game/tournament/league.ts), `round-robin.ts`, `standings.ts` | `League` state machine, schedules / Swiss pairings, standings and ranking. |
| [game/tournament/trainers.ts](../../src/app/game/tournament/trainers.ts) | CPU identities, DiceBear avatars, `synthMoves`, `scaleStats`, `teamStrength`, `makeTrainer`. |
| `game/tournament/odds.ts`, `scouting.ts`, `pickem.ts`, `rival.ts`, `history.ts` | Win odds, scout chips and lead, pick'em maths, rival state and taunts, history and `prizeFor`. |
| [game/engine/rules.ts](../../src/app/game/engine/rules.ts) | `BattleRules` (inverse chart, weather-boosted type). |
| [features/tournaments/tournaments.service.ts](../../src/app/features/tournaments/tournaments.service.ts) | `TournamentService` facade: screen signals, sequencing of run, league, draft, pick'em. |
| [features/tournaments/tournament-roster.service.ts](../../src/app/features/tournaments/tournament-roster.service.ts) | `TournamentRoster`: candidate selection, snake distribution, player and CPU trainer building. |
| [features/tournaments/tournament-records.service.ts](../../src/app/features/tournaments/tournament-records.service.ts) | `TournamentRecords`: history, last run, rival injection and head-to-head. |
| [features/tournaments/tournaments.ts](../../src/app/features/tournaments/tournaments.ts) (+ `.html`, `.scss`) | Lobby, draft, run bar, CTA / intel / pick'em, finale, bracket tree and scroll view, standings. |
| [features/tournaments/tournament-match/](../../src/app/features/tournaments/tournament-match/tournament-match.ts) | `pv-tournament-match`: the interactive party match, also used by Arena, Spire and Odyssey. |

## How it works

- **Start.** `TournamentService.startMode(mode, format)` selects candidate Pokémon (`TournamentRoster.selectDtos`), snake-distributes them into teams, builds trainers, injects the rival and either builds a power-seeded bracket (`buildBracket(seed(...))`) or starts a `League`. Draft mode pauses in the `draft` status until `confirmDraft(picks)`.
- **Teams.** Candidates are over-fetched (×1.4, or ×2.4 for the restricted pools), sorted by base-stat total for Little / Legendary, or sampled from the type endpoint for Mono-Type. Balanced modes sort by BST and snake-distribute for even strength. The player gets fully built battlers (real moves, ability); CPU trainers get `synthMoves` (one STAB move per type at power 85 plus Tackle), keeping generation to one request per Pokémon.
- **Match rules.** `rulesForMode` returns `{ inverse: true }` or a seeded `weatherBoostType` per match; `teamForRound` scales opponent stats by `levelForRound / baseLevel` in Boss Ascent. Rules are passed through `PlayerMatchSetup` and `simulateMatch` so interactive and simulated matches agree.
- **Simulation.** `simulateMatch` runs a `TeamBattle` (AI tier `strong`, AI may switch), handles forced switches, caps at 600 turns and falls back to survivors, then HP fraction. It returns winner, survivors and final HP of both teams.
- **Progression.** `recordPlayerOutcome` reports the player match (carrying HP in Survival), then `runAiMatches` resolves every CPU match up to the next player match or the champion. Leagues use `League.advance` / `recordPlayerOutcome`; a finished run is logged once with `prizeFor(placement, field)` — 200 + 10 × field for the title, 100 + 4 × field for second, 40 for the top half, 15 otherwise — plus any pick bonus.
- **Intel.** `winOdds` is a logistic over the team-power ratio (BST × average level / 50), clamped to 5–95; `scoutMatchup` and `bestLead` supply chips and the lead suggestion.
- **Persistence.** Through `EnvelopeStore` (`pv:` keys): `tournaments:history` (30 records) and `tournaments:rival`. Both survive `reset()`.

## Key decisions

- **One engine for play and simulation.** The interactive match and the headless simulator both run `TeamBattle`, so rules and balance are identical whether you play or the CPU auto-resolves.
- **You play, the CPU resolves.** Only your matches are interactive; a 16-trainer run stays fast.
- **Pure game modules, thin services.** Bracket, league, match running, odds, pick'em, rival and trainers are framework-free modules; `TournamentService` only holds signals and sequences them, with roster building and record keeping in their own injectables.
- **Light CPU move sets.** Fetching real moves for dozens of Pokémon per run was too many requests; synthesised STAB moves keep matchups meaningful.
- **Snake distribution for balance.** Sorting by BST and snake-dealing evens out team strength without a reject loop.
- **Two bracket layouts.** A converging tree for desktop and a scroll-snap bracket for phones render the same card in different containers.
- **Rival keeps the host's team.** The rival replaces the strongest CPU trainer's identity and gets a level edge, so mode rules still apply.

## Accessibility & mobile

- The mode grid is one column on phones and widens up to `xl`; the bracket scrolls horizontally with snap on small screens and becomes a tree at `lg`.
- The format picker is a `role="radiogroup"` of `role="radio"` items; errors use `role="alert"`; the bracket, standings, career strip, scout chips and pick'em carry `aria-label`s; the win-chance bar is `role="img"` with text.
- The match screen follows the battle screen: `role="progressbar"` HP bars, hotkeys 1–4 for moves, **S** for the switch tray, **T** for Terastallize, `role="status"` for the ace quip, a 2-column move grid on phones.
- Confetti, pulses and standings animations respect `prefers-reduced-motion`.

## Tests

- Pure modules: `game/tournament/bracket.spec.ts`, `simulate.spec.ts`, `formats.spec.ts`, `league.spec.ts`, `odds.spec.ts`, `scouting.spec.ts`, `pickem.spec.ts`, `rival.spec.ts`; rules in `game/engine/rules.spec.ts`.
- Services: `features/tournaments/tournaments.service.spec.ts` (including the crystal-ball pick), `tournament-roster.service.spec.ts`, `tournament-records.service.spec.ts`.
- Components: `features/tournaments/tournaments.spec.ts`, `tournament-match/tournament-match.spec.ts`.
