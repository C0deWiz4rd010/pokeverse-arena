# Trainer Profile (progression backbone)

The connective layer that unifies progress from every system into one identity.

## What it does

- **One aggregate snapshot** of the trainer drawn from all systems: gym badges,
  Arena Champion status, tournament wins/runs/prizes, best Spire depth, clears,
  ascension tier, and total coins banked across modes.
- **Editable identity** (name + title), persisted.
- **A rank** (Rookie → Adept → Veteran → Elite → Legend) derived from overall
  progression.
- **An achievements wall** — 10 milestones evaluated by pure predicates over the
  aggregate state, shown locked/unlocked.
- **Appearance picker** (v1.2.0) — five accent palettes (Aurora, Ember,
  Verdant, Sakura, Solar) applied app-wide via `ThemeService` and persisted;
  see [app-shell.md](app-shell.md#theme).

## Files

| File | Responsibility |
| ---- | -------------- |
| `core/storage/save.service.ts` | Typed, namespaced, versioned localStorage wrapper — the single persistence seam (with a legacy reader for older keys). |
| `core/models/profile.ts` | `ProfileState`, the achievements catalogue + evaluator, rank thresholds. |
| `features/profile/profile.service.ts` | Aggregates arena/spire/tournament state into one snapshot; persists identity. |
| `features/profile/profile.ts/.html/.scss` | Identity card, rank, appearance picker, records grid, achievements wall. |
| `core/theme/theme.service.ts` | Accent palettes + persistence; overrides `--accent*` tokens on `<html>`. |
| `core/models/profile.spec.ts` | Achievement evaluation + rank thresholds. |

## How it works

`ProfileService` reads the existing per-system stores (arena badges/champion/coins,
`loadMeta()` from the Spire, `loadHistory()` from Tournaments) and folds them into
a single `ProfileState`. Achievements are pure `(state) => boolean` predicates, so
they're trivially testable and always in sync with live progress. `SaveService`
is the seam future migrations route through.

## Full-app aggregation (v2)

The snapshot now also folds in the **Adventure** (gym badges, catches), the
**World Explorer dex** (registered species + shinies), **Contest ribbons**, the
tournament **rival head-to-head** and **crystal-ball hits** — 18 achievements
total (Trail Blazer, Field Researcher, Registrar, Shiny Hunter, Stage Debut,
Ribbon Royalty, Rival Slayer, Crystal Oracle join the original ten), with the
rank score counting adventure badges, ribbons and oracle hits.
