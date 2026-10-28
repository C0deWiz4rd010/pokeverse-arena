# Team Builder

Assemble, tune, analyze and persist a squad of up to six Pokémon.

## What it does

- **Add** a Pokémon by name or dex number, with datalist autocomplete from the Pokédex index. The roster is capped at 6 (a counter shows `n / 6`).
- **Discover**: filter the random pool by type and/or generation, then add one **Random** Pokémon or **Fill team** to complete every free slot. Pokémon already on the team are excluded; an empty pool shows an error.
- **Tune** each member: nickname, level slider (1-100), nature (all 25, with the boosted/lowered stat shown in the option), ability, and a collapsible move picker (up to 4 from the species' full move pool).
- **Live stats** are calculated at the chosen level and nature (31 IVs, 0 EVs). Each stat is an animated bar with a value colour and a ▲/▼ marker for the nature-boosted/lowered stat.
- **Member cards** are type-themed (dual-type gradient) and swap the still artwork for the animated sprite on hover.
- **Team profile**: average computed stats across the roster and a speed-tier list ordering members fastest-first.
- **Team Power Rating**: a 0-100 score with an S/A/B/C/D grade that counts up, a verdict, Offense and Defense meters (each out of 18 types) and concrete suggestions that name stacked weaknesses and coverage gaps.
- **Defensive analysis**: **blind spots** (attacking types nobody resists) or an all-clear message, and a ranked **shared weaknesses** list with member counts (rows with 2 or more are emphasised).
- **Offensive coverage**: types the roster hits super-effectively with its STAB types, and the remaining gaps.
- **Export / import**: download `pokeverse-team.json`, copy the JSON, import a file or paste JSON. Errors (invalid JSON, empty team, unknown Pokémon) are shown in an alert line.
- The roster persists across reloads. Other features read it: the Arena uses it as the player's saved team and the detail page's "Add to team" writes to it.

## Files

| Path | Responsibility |
| ---- | -------------- |
| `src/app/features/team-builder/team-builder.ts`, `team-builder.html`, `team-builder.scss` | Page component: add form, discovery filters, member cards, profile, rating and analysis panels, toolbar, import box. |
| `src/app/features/team-builder/team-builder.service.ts` | Roster state (`team`, `full`, `analysis`, `rating`, `memberStats`), add/remove/patch/toggleMove, random and fill, import/export, persistence. |
| `src/app/game/team/team-rating.ts` | Pure `rateTeam`: score, grade, offense/defense counts, verdict, stacked weaknesses, coverage gaps, suggestions. |
| `src/app/core/utils/type-chart.ts` | `analyzeTeamTypes`, `offensiveCoverage` and the type chart. |
| `src/app/core/utils/stat-calculator.ts` | `quickStats` / `calcStat`. |
| `src/app/core/utils/natures.ts` | The 25 natures plus `natureByName` and `natureSummary`. |
| `src/app/core/cache/cache.service.ts` | `saveState` / `loadState` over the IndexedDB `savegame` store. |
| `src/app/features/pokedex/pokedex.service.ts` | Supplies the name list and index used for autocomplete and random picks. |

## How it works

- `add(name)` fetches the Pokémon through the cache-first API client and maps it to a `TeamMember` with defaults: level 50, Hardy, first ability, and the first four level-up moves. Each member gets a generated `uid`.
- `memberStats` is a `computed` map of `uid` to stats; `analysis` and `rating` are computed over the roster's typings, so every edit updates the panels.
- Random picks start from the Pokédex name list, intersect it with the type and generation name sets (fetched once and memoized), and drop names already on the team.
- Persistence: the constructor calls `restore()`, then an `effect` saves the roster once restored. Only a minimal shape is stored per member (id, nickname, ability, moves, level, nature) under `team-builder:roster` in the IndexedDB `savegame` store (not in the `pv:` localStorage envelope). `restore()` and `importJson()` re-fetch each id (cached) and re-apply the saved choices; the level is clamped to 1-100 and abilities/moves not valid for the species are dropped.
- If a save fails, a one-time toast tells the player to use Export.
- The export format is `{ "version": 1, "team": [...] }` using the same minimal shape; import accepts at most 6 members.
- The rating score eases toward its target with `requestAnimationFrame` (about 500 ms) whenever the roster changes.

## Key decisions

- **Minimal persisted shape.** Only the id and the user's choices are stored; everything else is re-derived from the cached API, so saves stay tiny and survive data changes.
- **Roster in IndexedDB.** It uses the cache service's `savegame` store rather than `SaveService`, so it is not part of the Profile page's localStorage backup; the JSON export is the way to move a team.
- **`[selected]` on options.** A native `<select>` `[value]` binding does not reliably show a value set during async restore, so each option also binds `[selected]`.
- **Pure rating and type logic.** Scoring, coverage and stat math live in tested `core/utils` and `game/team` modules; the feature is mostly wiring.

## Accessibility & mobile

- The name input has an `aria-label`, the nickname input is labelled per member, the remove button has a label, and level, nature, ability and the type/generation filters sit inside `<label>` elements. Errors use `role="alert"`; the empty state uses `pv-state`.
- Move choices are real buttons that disable at 4 moves; nature direction is shown by ▲/▼ glyphs and colour, and types by text badges.
- The roster is one column on phones, two at `md` and three at `xl`; per-member fields stack and split into columns at `sm`. Hover sprite swaps, count-ups and entrance animation are disabled under `prefers-reduced-motion`.

## Tests

- `team-builder.service.spec.ts`: adding and editing, random generation, import/export, persistence.
- `team-builder.spec.ts`: component behaviour including discovery and import/export.
- `game/team/team-rating.spec.ts`: rating, grades, suggestions.
- `core/utils/natures.spec.ts`, `core/utils/stat-calculator.spec.ts` and `core/utils/type-chart.spec.ts` cover natures, stats and the type analysis helpers.
