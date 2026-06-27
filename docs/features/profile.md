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

## Files

| File | Responsibility |
| ---- | -------------- |
| `core/storage/save.service.ts` | Typed, namespaced, versioned localStorage wrapper — the single persistence seam (with a legacy reader for older keys). |
| `core/models/profile.ts` | `ProfileState`, the achievements catalogue + evaluator, rank thresholds. |
| `features/profile/profile.service.ts` | Aggregates arena/spire/tournament state into one snapshot; persists identity. |
| `features/profile/profile.ts/.html/.scss` | Identity card, rank, records grid, achievements wall. |
| `core/models/profile.spec.ts` | Achievement evaluation + rank thresholds. |

## How it works

`ProfileService` reads the existing per-system stores (arena badges/champion/coins,
`loadMeta()` from the Spire, `loadHistory()` from Tournaments) and folds them into
a single `ProfileState`. Achievements are pure `(state) => boolean` predicates, so
they're trivially testable and always in sync with live progress. `SaveService`
is the seam future migrations route through.
