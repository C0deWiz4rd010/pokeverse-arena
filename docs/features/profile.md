# Trainer Profile (progression backbone)

The connective layer that unifies progress from every system into one identity, plus the app's settings and save backup.

## What it does

- **Identity**: an editable trainer name (max 20 characters) and title (max 28), persisted; blanks fall back to "Trainer" / "Rising Challenger".
- **Rank**: Rookie, Adept, Veteran, Elite, Legend, derived from a weighted progression score, with a progress bar toward the next tier (or a max-rank message).
- **Achievement ring and wall**: 29 achievements evaluated by pure predicates over the aggregate state, unlocked ones listed first with a check, locked ones with a lock; the ring shows the completion percentage.
- **Mastery bars**: gym badges, Spire depth, Ascension tier, cup win rate, World dex (of 1025) and Contest ribbons (of 5).
- **Records**: a grid of 21 figures (gym badges, Arena Champion, tournament wins and runs, Spire depth/clears/Ascension, coins, Adventure badges and catches, World dex, shiny catches, ribbons, daily streak and best, Odyssey wave and starters, rivalry W-L, crystal-ball hits, fusions registered, Nuzlocke badges, chimeras slain).
- **Settings**: accent palette (Aurora, Ember, Verdant, Sakura, Solar), language (English, Deutsch), sound on/off with volume, and a haptics switch shown only on devices that support vibration.
- **Share Trainer Card**: renders a 1200x630 PNG with the accent border, name, title, rank, completion bar, six record chips, up to three favourite Pokémon artworks (a drawn orb when there are none) and a "LAB SPECIAL" seal with the day's seeded donor sprites. It is shared through the Web Share API when files are supported, otherwise downloaded as `trainer-card.png` with a confirming toast.
- **Your data**: export every save to `pokeverse-save-<date>.json`, or import one (after a confirmation, entries overwrite matching local saves and the page reloads).
- **Achievement toasts**: unlocks anywhere in the app trigger a global toast.

## Files

| Path | Responsibility |
| ---- | -------------- |
| `src/app/features/profile/profile.ts`, `profile.html`, `profile.scss` | Page: identity card, rank, settings, mastery, records, achievements, trainer card, backup/restore. |
| `src/app/features/profile/profile.service.ts` | `ProfileService`: aggregates every system into `ProfileState`, derives achievements, rank and completion, persists identity. |
| `src/app/core/models/profile.ts` | `ProfileState`, `ACHIEVEMENTS`, `evaluateAchievements`, `RANK_TIERS`, `progressScore`, `rankFor`, `rankProgress`. |
| `src/app/features/profile/achievement-watcher.service.ts` | Unlock detection (navigation, poll, tab focus), seen-set persistence, toast dispatch. |
| `src/app/features/profile/achievement-diff.ts` | Pure `diffUnlocked`. |
| `src/app/features/profile/trainer-card.ts` | `renderTrainerCard`: pure DOM/canvas PNG renderer, no Angular. |
| `src/app/core/storage/save.service.ts`, `envelope-store.ts`, `migrations.ts` | The persistence seam: versioned `{ v, data }` envelopes under `pv:` keys, migration ladder, one-time import of old raw keys (`LEGACY_SOURCES`), corrupt-blob backup. |
| `src/app/core/storage/backup.ts`, `safe-storage.ts` | `buildBackup` / `parseBackup` / `isOwnedKey` and guarded raw `localStorage` access. |
| `src/app/core/theme/theme.service.ts` | Accent palettes (`theme:accent`), overrides the `--accent*` tokens on `<html>`. |
| `src/app/core/ui/toast/` | `ToastService` and the `pv-toasts` stack (with a polite live region) rendered by the shell. |
| `src/app/game/spire`, `game/tournament`, `game/odyssey`, `game/daily`, `game/arena` | Per-system loaders and data the profile reads (`loadMeta`, `loadHistory`, `loadRival`, `loadOdysseyMeta`, `currentStreak`, `LEADER_LADDER`). |

## How it works

- `ProfileService.readState()` folds progress from every system into one `ProfileState`. Everything is read through the versioned store: `SaveService.read` for `arena:*`, `rpg:save` (plus slots 2 and 3 for the best Nuzlocke), `world:caught`, `world:shiny`, `contest:ribbons`, `daily:record`, `fusion:dex`, and the game modules' `loadMeta` / `loadHistory` / `loadRival` / `loadOdysseyMeta`, which use the shared `appStore`. Old raw keys are imported once by the envelope store.
- Coins are arena coins plus banked Spire coins plus tournament prizes.
- Achievements are pure `(state) => boolean` predicates, so they are always in sync with live progress. The rank score is badges, plus 2 per tournament win, 3 per Spire clear, 5 for Champion, 2 per Adventure badge, ribbons, crystal-ball hits and one point per 10 Odyssey waves; tiers start at 0, 3, 8, 16 and 25.
- `refresh()` re-reads state; the page calls it on entry and so does the Home page.
- `AchievementWatcherService.start()` (called by the shell) re-aggregates on every `NavigationEnd`, on a 30 s poll that runs only while the tab is visible, and when the tab becomes visible again. It diffs unlocked ids against the persisted `achievements:seen` set: the first run baselines silently, and because the seen set mirrors the current unlocked set, a progress reset re-arms the toasts. Its subscription, interval and `visibilitychange` listener are cleaned up through `DestroyRef`.
- Backup includes keys with the prefixes `pv:`, `arena:`, `cry:`, `odyssey:`, `spire:` and `tournaments:` (not `:corrupt` copies). The IndexedDB API cache and team roster are not part of it, and neither are raw keys such as `sfx:muted`. `parseBackup` validates the file (app id, format, JSON values, size caps); import writes entries with `safeSet` and reloads only if all writes succeeded.

## Key decisions

- **One read-side.** Other pages (Home dashboard, "What's next", the achievement toasts) all read the same `ProfileService` instead of each re-reading stores.
- **Pure predicates and diff.** Achievements, rank and unlock detection are pure functions with direct unit tests.
- **Persistence seam.** All progress goes through one versioned, defensive store, so a stored shape can change through migrations and failed writes are surfaced once with a toast.
- **Trainer card without Angular.** Rendering is a plain canvas function; sprites load with `crossOrigin` so the canvas stays exportable.

## Accessibility & mobile

- Accent and language pickers are labelled groups of `aria-pressed` buttons; the sound and haptics switches use `role="switch"` with `aria-checked`; the volume slider is labelled; the rank bar and the completion ring carry text alternatives.
- Unlock toasts are announced through the toast stack's polite live region.
- Layout is a single column that widens on larger screens; the file import is a labelled control, with confirmation before overwriting local saves.

## Tests

- `src/app/features/profile/profile.spec.ts`: identity, rank, records, mastery and achievements, edit and persist identity, theme and language, sound and haptics, trainer card (share, download, failure), backup export/import.
- `src/app/features/profile/profile.service.spec.ts`: aggregation from the stores.
- `src/app/features/profile/achievement-watcher.service.spec.ts` and `achievement-watcher.spec.ts` (the pure `diffUnlocked`).
- `src/app/core/models/profile.spec.ts`: achievements and rank thresholds.
- `src/app/core/storage/*.spec.ts`: `SaveService`, envelope store, migrations, legacy import, backup and safe storage.
- `src/app/core/theme/theme.service.spec.ts`.
