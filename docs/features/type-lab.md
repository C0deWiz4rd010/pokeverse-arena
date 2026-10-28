# Type Lab

A fully offline type-matchup workbench powered by the static type chart (18 types). No API calls: instant and deterministic.

## What it does

Four tools behind a tab bar (`Chart`, `Calculator`, `Defender`, `Team`):

1. **Chart**
   - On large screens (`lg` and up) an interactive 18x18 matrix: rows attack, columns defend. Cells are colour-coded (super-effective, resisted, immune) and carry a text multiplier; headers are sticky.
   - Hovering cross-highlights the row and column; clicking a row head, column head or cell **pins** it. A live **readout** shows the active attacker/defender pair with its multiplier and verdict, and a clear-pins button resets.
   - On smaller screens the matrix is replaced by a single-type **explorer**: pick one type and see what it hits (grouped by multiplier) and how it fares on defence.
2. **Calculator**: pick an attacking type and up to two defending types. It shows the combined multiplier with a verdict, the per-defender breakdown, and a coverage list of everything the attacker hits at 2x, 1/2x and 0x.
3. **Defender**: build a 1-2 type defender and see every attacking type bucketed into 4x, 2x, 1/2x, 1/4x and 0x.
4. **Team**: assemble up to six typings (starts with a fire / water / grass trio) and get a defensive heatmap (weak and resist tally per attacking type, unanswered weaknesses flagged), an offensive coverage split (super-effective STAB versus gaps) and a graded coverage score out of 100.

Type pickers replace the oldest selection when a third type is chosen, so a tap always does something.

## Files

| Path | Responsibility |
| ---- | -------------- |
| `src/app/features/type-lab/type-lab.ts` | Component; all state in signals (tab, hover/pinned type, calculator, defender, team). |
| `src/app/features/type-lab/type-lab.html`, `type-lab.scss` | Tabs, matrix and explorer, calculator, defender buckets, team analyzer. |
| `src/app/core/utils/type-chart.ts` | Chart data and helpers: `singleEffectiveness`, `effectiveness`, `effectivenessLabel`, `defensiveProfile`, `offensiveProfile`, `offensiveCoverage`, `analyzeTeamTypes`. |
| `src/app/core/ui/type-badge/type-badge.ts` | Type badge used throughout. |

## How it works

- `singleEffectiveness(attacker, defender)` reads the static table; `effectiveness` multiplies it across a 1-2 type defender.
- `defensiveProfile(defenders)` gives the multiplier each attacking type deals to a defender; `offensiveProfile(attacker)` gives the multiplier an attacker deals to each type. A private `bucketize` groups a profile by multiplier (skipping neutral), strongest first.
- The team tab calls `analyzeTeamTypes` (weakness and resistance counts plus "uncovered" types: weak with no resist) and `offensiveCoverage` (covered and gap types). The Team Builder reuses the same two helpers.
- The team score is `max(0, 100 - 9 x uncovered - 4 x gaps)`, graded S at 85, A at 70, B at 55, C at 40, otherwise D. This is a simpler formula than the Team Builder's rating (`game/team/team-rating.ts`).
- Hover and pin signals combine as `hover ?? pinned`, so hovering previews without discarding a pin.

## Key decisions

- **Static data only.** Everything derives from the hard-coded chart, so the tool works offline and renders instantly.
- **Colour plus text.** Multipliers are printed (`½×`, `¼×`) as well as coloured, so meaning never depends on colour alone.
- **Two chart presentations.** A wide matrix is only readable on large screens; below `lg` the explorer avoids sideways scrolling.
- **Team tab is standalone.** It works on bare typings and does not read the Team Builder roster.

## Accessibility & mobile

- The tab bar uses `role="tablist"` with `role="tab"` and `aria-selected` buttons; the matrix sits in a focusable scroll region with a label, uses real table markup with `scope` headers, and each cell has a title with the matchup.
- Pinning in the matrix is by mouse or touch on header and cell elements; the explorer (buttons) is the keyboard-friendly route on small screens, and the calculator, defender and team pickers are buttons.
- Below `lg` there is no horizontal page scroll from the chart; the matrix, when shown, scrolls inside its own region. Type pickers scale from 2 up to 6 columns. Hover effects apply only on hover-capable devices and motion is disabled under `prefers-reduced-motion`.

## Tests

- `src/app/features/type-lab/type-lab.spec.ts`: chart tab (explorer, 18x18 matrix, readout and pinning, cell classes), calculator, defender buckets, and the team tab (default trio, builder limits, removal, heatmap flags).
- `src/app/core/utils/type-chart.spec.ts` covers the chart helpers and team analysis.
