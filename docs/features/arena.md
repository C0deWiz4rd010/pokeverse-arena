# Arena — Type-Themed Gym Leaders & Badges

The Arena is a single-player progression hub: challenge eighteen gym leaders —
one per Pokémon type — and earn their badge by winning a 3-v-3 match. Collect
all eighteen to become **Arena Champion**. Badge progress is saved locally, so
it survives reloads.

## What it does

- **Hub** ([arena.html](../../src/app/features/arena/arena.html)) — a responsive
  grid of leader cards, each tinted with its type colour, showing the leader's
  name, title, type badge, a short taunt, and a locked/lit badge medallion.
  A progress bar tracks `earned / 18`; collecting them all swaps the header to a
  Champion banner.
- **Challenge** — launches a 3-v-3 match against the leader's themed team using
  the shared [`pv-tournament-match`](tournaments.md) component (so it inherits
  weather, the versus header, and the polished move buttons).
- **Badges** — winning awards the leader's badge (lit medallion + `✓`).
  A rematch is always available. Progress can be reset from the hub.
- **Result toast** — after a match the hub shows a win/loss message.

## Files

| File | Role |
| ---- | ---- |
| [game/arena/gym-leaders.ts](../../src/app/game/arena/gym-leaders.ts) | Pure data: one `GymLeader` per type (name, title, badge, icon, blurb). |
| [features/arena/arena.service.ts](../../src/app/features/arena/arena.service.ts) | State machine (hub / loading / battle / error), team building, badge persistence. |
| [features/arena/arena.ts](../../src/app/features/arena/arena.ts) | Standalone `pv-arena` component. |
| [features/arena/arena.html](../../src/app/features/arena/arena.html) | Hub grid, progress, and the embedded match. |
| [features/arena/arena.scss](../../src/app/features/arena/arena.scss) | Type-tinted cards, badge medallions, mobile-first grid. |

## Design decisions

- **Reuses the tournament match.** Rather than a second battle UI, the Arena
  feeds a synthetic `PlayerMatchSetup` (a one-off `BracketMatch` in the `final`
  round) into `pv-tournament-match`. Weather, effectiveness badges and the
  versus header all come for free.
- **Leader teams are themed and tough.** A leader's team is the three highest-BST
  Pokémon from a deterministic sample of their type's roster
  (`SeededRng('gym-<type>')`), so each gym always fields the same line-up. CPU
  Pokémon use synthetic, type-accurate moves to keep generation to one request
  each.
- **The player brings their roster.** If the Team Builder roster has members,
  the first three are sent into battle with their real level-up movesets;
  otherwise a fair random trio is used so anyone can jump straight in.
- **Local persistence.** Earned badges are stored under `arena:badges` in
  `localStorage`, mirroring the Team Builder roster persistence pattern.

## Conventions followed

- Standalone component, `OnPush`, signals throughout.
- Loading / error states for the async team build; mobile-first SCSS with
  `@include up(...)`; reduced-motion respected.
- Pure leader data in `game/arena`; feature logic in `features/arena`.

## Deep overhaul (v2)

Each of the 18 leaders now fields a **designed signature team** (specific species
with thematic abilities + held items + roles), sits on a **difficulty ladder**
(scaling level + AI tier), and has dialogue. A **Champion Gauntlet** (Elite Four +
Champion) unlocks at 8 badges and is fought back-to-back with no healing between
matches. Wins award coins + badges + the Champion title, all surfaced in the
Trainer Profile. See [../plan.md](../plan.md) phase 4.
