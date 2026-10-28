# Stat Showdown

A fast, tap-or-arrow-key "higher or lower" duel: two Pokémon appear, one base stat is highlighted, and you pick the winner.
Correct picks build a streak, one miss ends the run.

Route: `/showdown`.

## What it does

- **Duel rounds.** Each round shows two random Pokémon (ids 1-1025) with official artwork, name and types, plus a prompt
  such as "Which has the Fastest Speed?". The stat is chosen at random from seven: HP, Attack, Defense, Sp. Atk, Sp. Def,
  Speed and Base Stat Total.
- **Streak and best.** A correct pick grows the streak; a miss ends the run. The best streak is persisted and shown on the
  intro and the HUD; a "New personal best" line appears when a run beats it.
- **Ties always count for you.** When both values are equal, either pick is correct and both cards glow.
- **Reveal.** After a pick, both cards show their value; the winner is highlighted and the loser dimmed. A correct pick
  loads the next round after 1150 ms, a miss opens the "Run over" panel after 900 ms.
- **Play again and share.** The end panel offers "Play again" and "Share". Share uses the native share sheet when
  available, otherwise copies to the clipboard and shows a toast. The text is link-free and Wordle-style, for example a
  medal, "Streak: N (best M)" and a ten-cell green/white bar.
- **Keyboard.** Left and right arrow keys pick the left or right card while a round is in play.
- **Haptics.** `select` on start, `success` on a correct pick, `error` on a miss (see `HapticsService`).
- **Offline and error handling.** If nothing can be fetched, the page shows an error state with a "Try again" button instead
  of an endless spinner.

## Files

| Path | Responsibility |
| ---- | -------------- |
| `src/app/game/showdown/showdown-logic.ts` | Pure helpers: `SHOWDOWN_STATS`, `ShowdownMon`, `statValue`, `winnerSide`, `isCorrect`, `shareText`. |
| `src/app/features/showdown/showdown.ts` | Component with inline template: phases, round loading, picking, persistence, share, keyboard. |
| `src/app/features/showdown/showdown.scss` | Stacked cards on phones, side by side from `md`, reveal states, reduced-motion fallbacks. |

## How it works

- **Phases.** A `Phase` signal moves `intro`, `loading`, `playing`, `reveal`, `over`, `error`. `start()` resets the streak
  and loads a round; `pick()` is only honoured in `playing`; `reveal` is the short pause after a pick; `over` follows a miss.
- **Round loading.** `loadRound()` increments a token, clears both sides, picks a random stat and fetches two Pokémon with
  `PokeApiClient.get(endpoints.pokemon(id))` in parallel, so cached ids resolve from memory or IndexedDB. If the second
  id equals the first it re-rolls up to five times. `fetchMon` tries up to six random ids and finally falls back to
  Pikachu (#25) so a round can always start. If even that fails, the phase becomes `error`.
- **Retry state.** `retry()` simply calls `loadRound()` again, keeping the current streak. The error view replaces the
  duel UI with a `pv-state` (`kind="error"`, "Could not load the next round").
- **Stale-round guard.** The token also protects against a newer round or a destroyed component: a superseded load returns
  without touching state, and `DestroyRef` bumps the token and clears the pending timer.
- **Mapping.** `toMon` reads the six base stats from the DTO, sums the base stat total and uses `officialArtwork(id)`.
  `statValue(mon, key)` returns the total for the synthetic `bst` key.
- **Persistence.** The best streak is read once from `SaveService` key `showdown-best` (stored as `pv:showdown-best`) and
  written when a run ends with a streak above it. The current streak is not persisted.

## Key decisions

- **Pure logic, thin component.** Comparison, tie rules and share text are framework-free and unit-tested; the component
  owns only data fetching and UI state.
- **Reuse the shared client.** Rounds go through `PokeApiClient`, so repeated Pokémon are free and the app stays within
  PokéAPI's request limits; random ids avoid needing the Pokédex index.
- **Always playable.** Retried ids and the Pikachu fallback mean a flaky connection degrades to a retry button, never a
  hang.
- **Ties favour the player.** A rule that is easy to explain and avoids unfair misses on equal stats.
- **Share without a link.** The result text is self-contained, so it pastes cleanly anywhere.

## Accessibility & mobile

- Both choices are real `<button>`s, disabled outside the `playing` phase, with the Pokémon's name as the image `alt`.
- Arrow keys work on hardware keyboards; the document-level listener ignores keys outside `playing`.
- The error state uses `role="alert"` (via `pv-state`); the loading skeleton cards are decorative.
- The result of a round is conveyed visually (colour, value, "win" and "lose" states); there is no dedicated live region.
- Mobile-first layout: stacked cards on phones, side by side from the `md` breakpoint; tap targets are the whole card.
- Reveal and entrance motion are disabled under `prefers-reduced-motion`.

## Tests

- `src/app/game/showdown/showdown-logic.spec.ts`: stat list, `statValue`, `winnerSide`, `isCorrect`, `shareText`.
- `src/app/features/showdown/showdown.spec.ts`: intro and stored best, loading skeletons, correct and missed picks, new
  record handling, ties, arrow keys, error and retry, id retry and Pikachu fallback, share paths, teardown while loading.
