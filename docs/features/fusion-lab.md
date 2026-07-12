# ⚗️ Fusion Lab

Splice any two Pokémon into a brand-new species. The **head donor** shapes the
mind — the name's opening syllables, the primary type, the mental stats and the
color palette. The **body donor** shapes the build — the name's ending, the
physique stats, the silhouette and the speed. The result is deterministic:
the same pair always produces the same fusion, which makes every fusion
shareable as a link and collectable in a persistent **Fusion Dex**.

## What it does

- **Two donor pickers** — search by name or `#id` over the in-memory Pokédex
  index (instant, offline-capable), with sprite-thumbnail suggestions, a
  random-dice button per slot, **Swap** (order matters — head↔body is a
  different creature) and **Surprise fusion** (randomize both).
- **Deterministic splicing** (`game/fusion/fusion.ts`, pure + unit-tested):
  - **Name** — syllable-boundary splicing: the head keeps its opening
    syllables, the body contributes its ending, doubled letters at the seam
    collapse (`bulbasaur` + `charizard` → *Bulbizard*, `gengar` + `snorlax` →
    *Gengorlax*).
  - **Typing** — head's primary type + the first differing body type (max 2).
  - **Stats** — the Infinite-Fusion-style 2:1 weighting: HP / Sp. Atk / Sp. Def
    lean toward the head, Atk / Def / Speed toward the body
    (`floor((2·head + body) / 3)` and mirrored).
  - **Ability & epithet** — seeded on `fusion-<headId>-<bodyId>` via the
    shared `SeededRng`, so they never change for a given pair.
  - **Height / weight** — the average of both donors.
- **Fused visual** — the body's official artwork re-tinted toward the head's
  palette with a CSS `hue-rotate` computed from the two primary types' theme
  hues (`fusionHueShift`, shortest rotation, −180°…180°). A conic-gradient
  **halo ring** in both fusion types spins behind the artwork.
- **DNA-merge staging** — on every new pair the parents slide toward a
  pulsing energy beam (`merging` phase, ~950 ms), then the fusion pops in with
  a spring scale and a six-spark burst (`done` phase). Honors
  `prefers-reduced-motion` (no staging, instant reveal).
- **Chimera cry** — plays the head's cry, answered 420 ms later by the body's
  cry pitched up (`playbackRate 1.18`). Respects the global cry mute.
- **Fusion Dex** — register keepers to a persisted gallery (`SaveService`,
  key `fusion:dex`); cards re-render the tinted sprite from the stored hue,
  load back into the lab on click, and can be removed inline. Registering
  fires the shared toast system.
- **Shareable deep links** — the pair is mirrored into the URL
  (`#/fusion?head=6&body=150`, `replaceUrl` so history stays clean); **Share**
  copies a summary + link to the clipboard. A lone `?head=` pre-fills just
  that slot — that powers the detail page's **Fuse** button.
- **Achievements** — *Mad Scientist* (first registered fusion) and
  *Gene Weaver* (10 registered), evaluated from `ProfileState.fusionsRegistered`
  and celebrated by the global achievement watcher like every other unlock.

## Files

| File | Responsibility |
| ---- | -------------- |
| `app/game/fusion/fusion.ts` | Pure fusion engine: `spliceName`, `fuseTypes`, `fuseStats`, `fusionHueShift`, `fusePokemon`. |
| `app/game/fusion/fusion.spec.ts` | 17 unit tests: determinism, order-sensitivity, seam collapsing, stat weighting, hue bounds. |
| `app/features/fusion/fusion.service.ts` | State container: donor slots (stale-response-safe loading), derived fusion, persisted Fusion Dex. |
| `app/features/fusion/fusion.ts` | Component: pickers/suggestions, merge phases, chimera cry, share, deep-link + URL sync. |
| `app/features/fusion/fusion.html` | Pickers, stage (parents/beam/halo/sparks), identity, fact sheet + stat bars, Fusion Dex grid. |
| `app/features/fusion/fusion.scss` | Merge/beam/spark keyframes, halo mask, suggestion dropdown, dex cards, reduced-motion fallbacks. |

## Integration across the app

- **Pokémon detail** — a **Fuse** quick action (`#/fusion?head=<id>`) sends the
  current Pokémon into the lab as the head donor.
- **⌘K Command Palette** — "Fusion Lab" page entry (keywords: fuse, splice,
  dna, hybrid, chimera) + a "Fuse two random Pokémon" action.
- **Home** — a feature card in the grid; **shell nav** — its own entry.
- **Trainer Profile** — `fusionsRegistered` joins the aggregate `ProfileState`;
  two new achievements ride the existing watcher/toasts.

## Key decisions

- **Determinism over novelty.** Seeding everything on the pair of ids means a
  shared link shows *exactly* the same creature, and the Fusion Dex can rebuild
  visuals from four stored numbers instead of caching images.
- **Type-hue palette shift, not pixel compositing.** True sprite splicing
  needs hand-drawn art; canvas pixel work needs CORS and is fragile. A
  `hue-rotate` derived from the two primary types' theme hues gives an
  instantly readable "this body, that soul" look with zero network or canvas
  cost — and it composes with any future artwork source.
- **Head/body stat weighting** mirrors the well-known Infinite Fusion formula,
  so min-maxers get a real reason to try both orders of the same pair.
- **Reuses the Pokédex index** for suggestions (like the command palette) —
  no per-keystroke API calls, works offline once the index is cached.
- **Slot loading is stale-safe**: each request checks the slot's current id
  before committing, so rapid re-picks can't race an older response over a
  newer one.
