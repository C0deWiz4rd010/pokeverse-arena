# Fusion Lab

Splice any two Pokémon into a brand-new species. The **head donor** shapes the mind — the name's opening syllables, the
primary type, the mental stats and the colour palette. The **body donor** shapes the build — the name's ending, the physique
stats and the silhouette. The result is deterministic: the same pair always produces the same fusion, so every fusion is
shareable as a link and collectable in a persistent **Fusion Dex**.

Route: `/fusion` (query: `?head=<id>&body=<id>`).

## What it does

- **Today's Lab Special.** A seeded daily pair (`dailyFusionPair(dailySeed('fusion'))`, head and body always differ) shown as
  a banner. Its spliced name and both donor names come from the in-memory Pokédex index, so the preview needs no fetches;
  clicking loads the pair. The command palette offers the same pair as an action.
- **Two donor pickers.** Search by name or `#id` over the Pokédex index (up to eight suggestions, prefix matches first), a
  random button per slot, **Swap** (order matters: head and body swapped is a different creature) and **Surprise fusion**.
- **Deterministic splicing** (`game/fusion/fusion.ts`):
  - **Name.** Syllable-boundary splicing: the head keeps its opening syllables, the body contributes its ending, doubled
    letters at the seam collapse.
  - **Typing.** The head's primary type plus the first differing body type (at most two).
  - **Stats.** HP, Sp. Atk and Sp. Def lean toward the head (`floor((2·head + body) / 3)`); Atk, Def and Speed toward the body
    (`floor((head + 2·body) / 3)`).
  - **Ability and epithet.** Picked with `SeededRng` seeded on `fusion-<headId>-<bodyId>`; the ability comes from the
    non-hidden abilities of both donors.
  - **Height and weight.** The average of both donors, rounded to one decimal.
- **Fused visual.** The body's official artwork is re-tinted toward the head's palette with a CSS `hue-rotate` computed from
  the two primary types' theme hues (`fusionHueShift`, shortest rotation). A conic-gradient halo in both fusion types sits
  behind it.
- **DNA-merge staging.** For every new pair the stage runs `merging` for 950 ms (parents slide toward an energy beam), then
  `done` (pop-in and spark burst). Under `prefers-reduced-motion` the reveal is instant.
- **Chimera cry.** `CryService.playPair` plays the head's cry, then the body's 420 ms later at `playbackRate` 1.18. It
  respects the global cry mute.
- **Fusion Dex.** Register keepers to a persisted gallery (`SaveService` key `fusion:dex`, stored as `pv:fusion:dex`). Cards
  re-render the tinted sprite from the stored hue shift, load the pair back on click and can be removed inline.
  Registering shows an achievement-style toast.
- **Shareable deep links.** The pair is mirrored into the URL with `replaceUrl`, so history stays clean. **Share** copies a
  summary and link to the clipboard (a failed copy shows the text in a toast). A lone `?head=` pre-fills only that slot.
- **Achievements.** Mad Scientist (first registered fusion) and Gene Weaver (ten), evaluated from
  `ProfileState.fusionsRegistered`.

## Files

| Path | Responsibility |
| ---- | -------------- |
| `src/app/game/fusion/fusion.ts` | Pure engine: `spliceName`, `fuseTypes`, `fuseStats`, `fusionHueShift`, `dailyFusionPair`, `fusePokemon`, and `fuseBattlers` for battle-ready chimeras. |
| `src/app/features/fusion/fusion.service.ts` | State: donor slots with stale-response-safe loading, the derived `fusion` computed, the persisted Fusion Dex. |
| `src/app/features/fusion/fusion.ts` | Component: pickers and suggestions, merge phases, chimera cry, share, deep-link read and URL sync. |
| `src/app/features/fusion/fusion.html` | Pickers, stage (parents, beam, halo, sparks), identity, fact sheet with stat bars, Fusion Dex grid. |
| `src/app/features/fusion/fusion.scss` | Merge, beam and spark keyframes, halo mask, suggestion dropdown, dex cards, reduced-motion fallbacks. |
| `src/app/core/audio/cry.service.ts` | `playPair` for the chimera cry (shared service). |

## How it works

- **Loading.** `FusionService.setSlot` sets the slot id, fetches `PokeApiClient.pokemon(id)`, maps it with `mapPokemon` and
  commits only if the slot still holds that id. A failure clears the slot and sets an error message. `loading` is a
  counter-backed computed, so two parallel slots work.
- **Derived fusion.** `fusion` is a `computed` over both loaded Pokémon, so swapping, deep links and gallery loads all use
  one path. An effect in the component stages the merge and updates the URL whenever a *new* fusion code appears.
- **Picker text** mirrors whatever is loaded unless the user is typing in that box, so deep links and swaps keep the inputs
  in sync.
- **Battle chimeras.** `fuseBattlers(head, body)` applies the same head/body split to two engine `Battler`s: spliced name,
  fused types and stats, moves interleaved head-first and deduplicated to four, the head's ability, the body's sprite and a
  UI-only `hue`. Its synthetic id is `head.id * 10000 + body.id`, which keeps it out of the real dex range. The Ascension
  Spire uses it for its secret Chimera Keeper bosses (see [spire.md](spire.md)).
- **Entry points.** The Pokémon detail page and the Pokédex quick view link to `#/fusion?head=<id>`; the command palette has
  a "Fusion Lab" page entry plus the daily special and a "Fuse two random Pokémon" action; Home has a card and a coach
  suggestion for the first splice.

## Key decisions

- **Determinism over novelty.** Everything is seeded on the pair of ids, so a shared link shows exactly the same creature and
  the Fusion Dex can rebuild visuals from stored ids and a hue number instead of caching images.
- **Hue shift, not pixel compositing.** True sprite splicing needs hand-drawn art and canvas work needs CORS. A `hue-rotate`
  derived from the primary types gives a readable "this body, that soul" look at no network or canvas cost.
- **Head/body stat weighting** gives a reason to try both orders of the same pair.
- **Reuses the Pokédex index** for suggestions, so typing makes no API calls and works offline once the index is cached.
- **Stale-safe slot loading** keeps rapid re-picks from racing an older response over a newer one.

## Accessibility & mobile

- Each picker input has a `<label>`; the donor section and the Fusion Dex are labelled regions; the stage is
  `aria-live="polite"` so a new fusion is announced.
- Decorative sprites, sparks and halo are `aria-hidden`.
- Suggestions are pointer-driven (`mousedown` on `role="option"` items); there is no arrow-key navigation inside the list.
- Gallery cards are buttons; the inline remove control is focusable and answers Enter.
- Motion (merge, sparks, halo) is disabled under `prefers-reduced-motion`, and gallery loads scroll instantly in that mode.

## Tests

- `src/app/game/fusion/fusion.spec.ts`: determinism, order sensitivity, seam collapsing, stat weighting, hue bounds, daily
  pair, `fuseBattlers`.
- `src/app/features/fusion/fusion.service.spec.ts`: slot loading, stale responses, swap, Fusion Dex persistence.
- `src/app/features/fusion/fusion.spec.ts`: component pickers, merge phases, share, deep links.
