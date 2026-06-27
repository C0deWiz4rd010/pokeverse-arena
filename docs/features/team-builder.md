# Team Builder

Assemble, tune, analyze and persist a squad of up to six Pokémon.

## What it does

- **Add** Pokémon by name or dex number, with datalist autocomplete sourced from
  the Pokédex index (capped at 6 members).
- **Tune** each member: editable nickname, level slider (1–100), nature (all 25),
  ability, and a move picker (max 4) drawn from the species' full move pool.
- **Live stats** are computed at the chosen level + nature via `quickStats()`;
  nature-boosted stats are green, lowered stats red.
- **Defensive analysis** across the whole roster:
  - **Blind spots** — attacking types no member resists.
  - **Shared weaknesses** — a ranked bar chart of how many members are weak to
    each attacking type.
- **Export / import**: download JSON, copy to clipboard, import a file or paste
  JSON. The roster **persists** to IndexedDB and is restored on load.

## Files

| File | Responsibility |
| ---- | -------------- |
| `features/team-builder/team-builder.service.ts` | Roster state, add/remove/patch/move-toggle, import/export, persistence, `analyzeTeamTypes` + `quickStats` derived signals. |
| `features/team-builder/team-builder.ts` / `.html` / `.scss` | UI: add bar, member cards, analysis panel, toolbar, import box. |
| `core/utils/natures.ts` | The 25 natures + `natureByName`, `natureSummary`. |

## How it works

- `add(name)` fetches the Pokémon (cache-first) and maps the DTO into a
  `TeamMember` with sensible defaults (level 50, Hardy, first ability, first
  level-up moves).
- `memberStats` is a `computed` map of `uid → stats`, recomputed reactively when
  any member's level or nature changes.
- `analysis` runs `analyzeTeamTypes` over the roster's typings.
- An `effect` persists the roster (serialized to a minimal `StoredMember[]`) to
  the `savegame` store whenever it changes; `restore()` rehydrates on startup by
  re-fetching each id (cached) and re-applying the saved config.

## Key decisions

- **Minimal persisted shape.** Only id + user choices are stored; everything else
  is re-derived from the (cached) API, keeping save data tiny and forward-compatible.
- **`[selected]` on options.** Native `<select>` `[value]` binding doesn't
  reliably reflect a value set during async restore, so each option also binds
  `[selected]` — restored nature/ability now display correctly.
- **Reuses core math.** Stats, natures and type analysis all come from the tested
  `core/utils` layer — the feature is mostly wiring.

## Mobile-first

The roster grid is 1 column on mobile, 2 at `md`, 3 at `xl`. Per-member config
fields stack then split into two columns at `sm`; the move grid scales 2→3
columns.

## Tests

`natures.spec.ts` covers the nature table + helpers; `type-chart.spec.ts` covers
`analyzeTeamTypes`. 27 tests passing overall.

## Deep overhaul (v2)

The team rater now explains *why*: it surfaces **stacked shared weaknesses** (and
whether anything resists them), **offensive coverage gaps**, and concrete
**suggestions** — shown under the power meters. See [../plan.md](../plan.md) phase 8.
