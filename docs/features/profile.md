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
- **Achievement unlock toasts** (v1.3.0) — `AchievementWatcherService`
  re-aggregates progression on every navigation (plus a 30 s poll), diffs the
  unlocked ids against a persisted "seen" set and celebrates the delta with a
  global toast. First run baselines silently; a reset re-arms the toasts.
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
| `features/profile/achievement-watcher.service.ts` | Unlock detection: navigation + poll triggers, seen-set persistence, toast dispatch. |
| `features/profile/achievement-diff.ts` (+ spec) | Pure unlocked-vs-seen diff (`diffUnlocked`). |
| `core/ui/toast/` | Global `ToastService` + `pv-toasts` stack rendered by the shell. |
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

Later versions added the **Daily Challenge** streaks (v1.4), **Odyssey** depth +
starter roster (v1.8) and the **Fusion Lab** (v1.10/1.11): `fusionsRegistered`
counts the persisted Fusion Dex, drives the *Mad Scientist* / *Gene Weaver*
achievements, a *Fusions registered* Records row, and the Home "What's next"
suggestion to splice your first fusion.

## Trainer Card (v1.13)

*Share Trainer Card* renders a 1200×630 PNG on an offscreen canvas
(`trainer-card.ts` — pure DOM/canvas, no Angular): accent-palette border and
corner glows, name/title, rank pill, achievement completion bar, six record
chips, and up to three favourite Pokémon artworks (loaded `crossOrigin` so
the canvas stays exportable; a drawn Poké-orb stands in when there are no
favourites). Shared via the Web Share API when the platform offers it,
otherwise downloaded as `trainer-card.png` with a confirming toast.
