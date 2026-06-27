# Type Lab

A fully offline type-matchup workbench powered by the static Gen VI type chart.
No API calls — instant and deterministic.

## What it does

Three tools behind a tab switch:

1. **Chart** — an interactive 18×18 effectiveness matrix. Rows attack, columns
   defend. Cells are color-coded (super / neutral / resist / immune), headers are
   sticky, hovering cross-highlights the row + column, and the table scrolls
   horizontally on mobile.
2. **Calculator** — pick an attacking type + up to two defending types; shows the
   combined multiplier, a verdict label and (for dual types) the per-type
   breakdown.
3. **Coverage** — build a 1–2 type defender and see every weakness, resistance
   and immunity grouped into 4× / 2× / ½× / ¼× / 0× buckets.

## Files

| File | Responsibility |
| ---- | -------------- |
| `features/type-lab/type-lab.ts` / `.html` / `.scss` | Tabs, matrix, calculator, coverage; all state in signals. |
| `core/utils/type-chart.ts` | Provides `singleEffectiveness`, `effectiveness`, `effectivenessLabel`, `defensiveProfile`, `offensiveProfile`, `analyzeTeamTypes`. |

## Core additions

- `defensiveProfile(defenders)` → multiplier each attacking type deals to a 1–2
  type defender.
- `offensiveProfile(attacker)` → multiplier an attacking type deals to each type.
- `analyzeTeamTypes(team)` → aggregated weakness/resistance counts + uncovered
  "blind spot" types. (Also reused by the Team Builder.)

## Key decisions

- **Static data only.** Everything derives from the hard-coded chart, so the tool
  works offline and renders instantly.
- **Color + text.** Multipliers are shown numerically (`½×`, `¼×`) as well as by
  color, so meaning never depends on color alone.

## Mobile-first

The type-picker grid scales from 2 columns up to 6; the matrix is wrapped in a
horizontally scrollable region with sticky type labels.

## Type Lab v2

A complete pass adding analysis depth and interactivity.

- **Team coverage analyzer (new tab).** Assemble up to six typings and get a
  defensive **heatmap** (weak/resist tally per attacking type, unanswered
  weaknesses flagged red), an **offensive coverage** split (super-effective STAB
  vs gaps) and a graded coverage score. Reuses `analyzeTeamTypes` +
  `offensiveCoverage` (new, unit-tested in `type-chart`).
- **Interactive matrix.** Click any row/column/cell to **pin** the highlight; a
  big live **readout** shows the pinned/hovered matchup (multiplier + verdict),
  with a clear-pins control.
- **Calculator coverage strip.** The chosen attacking type now lists everything it
  hits ×2 / ×½ / ×0, and the result multiplier pops on change.
- Motion polish throughout; honours `prefers-reduced-motion`.
