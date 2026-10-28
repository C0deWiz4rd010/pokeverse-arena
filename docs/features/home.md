# Home & 3D Hero

The landing page: the brand, a progress dashboard, today's seeded challenges and a launcher into every module. It is also the only place Three.js is used.

## What it does

- **Hero copy** with the title, pitch, two calls to action (Open the Pokédex, Start a Battle) and a progress-aware **"What's next"** link that points at the next unfinished goal (gym badge, Champion Gauntlet, first Spire clear, first cup, first fusion, next achievement, otherwise the World dex).
- **Trainer dashboard**: the trainer rank plus chips for badges, daily streak, cups, best Spire depth, achievements and coins, all read from `ProfileService`.
- **Holographic orb**: a Three.js scene (icosahedron core, wireframe shell, particle field) that reacts to the pointer. Desktop only, with a static gradient poster underneath.
- **Today strip** with four cards:
  - **Daily Challenge**: state-aware copy (ready, cleared, attempt spent), live streak and best, both matchup sprites, links to `/battle?daily=1`.
  - **Who's that Pokémon?**: a seeded daily silhouette; the first tap reveals it, the second opens its detail page.
  - **Today's Lab Special**: the seeded fusion pair of the day, linking into the Fusion Lab with both donors pre-filled.
  - **Stat Showdown**: a teaser with two seeded faces (cosmetic) linking to `/showdown`.
- **Feature grid** ("Everything inside"): 14 cards (Pokédex, Type Lab, Team Builder, Battle Engine, Arena, Tournaments, Ascension Spire, Odyssey, World Explorer, Fusion Lab, Contest Hall, Stat Showdown, Adventure, Trainer Profile), each type-themed, staggered in, with a cursor-following sheen and tilt.

## Files

| Path | Responsibility |
| ---- | -------------- |
| `src/app/features/home/home.ts`, `home.html`, `home.scss` | Page component: hero, dashboard, Today strip, feature grid, lazy hero bootstrap and teardown. |
| `src/app/features/home/hero-scene.ts` | `createHeroScene(canvas)`: builds the Three.js scene and returns a disposer. |
| `src/app/features/profile/profile.service.ts` | Progress state (`state`, `rank`, `unlocked`, `totalAchievements`, `refresh()`) behind the dashboard and "What's next". |
| `src/app/features/battle/daily.service.ts` | Daily challenge state (played/won today, streak, best, matchup). |
| `src/app/game/fusion/fusion.ts` | `dailyFusionPair` for the lab special. |
| `src/app/core/utils/rng.ts` | `SeededRng` and `dailySeed` for the day's silhouette and showdown faces. |

## How it works

- The component calls `profile.refresh()` on creation so the chips and the next step reflect current saves.
- The Today strip uses only local state and seeded values (`dailySeed('whos-that')`, `dailySeed('fusion')`, `dailySeed('showdown')`) plus id-addressed sprite URLs, so the landing page makes no API calls.
- After first render, `initHero` loads `./hero-scene` with a dynamic `import()`. It is skipped when the viewport is below 1024 px, when the user prefers reduced motion, when Data Saver is on, or when `navigator.deviceMemory` is under 4. If the user leaves before the chunk arrives, nothing is started.
- `createHeroScene` returns a disposer called from `ngOnDestroy`. It stops the animation loop, disconnects the observers and listeners, and disposes geometries, materials and the renderer.
- The render loop only runs while the canvas is on screen, the tab is visible and the WebGL context is alive; it handles context loss and restoration, uses a lower pixel ratio and no antialiasing on low-end devices, and drops to a pixel ratio of 1 after sustained slow frames.

## Key decisions

- **Lazy Three.js.** The renderer ships as a separate chunk that is only fetched when the orb will actually show, so no other route pays for it.
- **Disposer pattern.** Teardown is explicit, so navigating away leaks no GPU resources or listeners.
- **Graceful fallback.** The gradient poster is always present and the canvas fades in over it only once the scene is ready.
- **Everything seeded or local.** Daily content is the same for every trainer and needs no network.

## Accessibility & mobile

- The orb, poster and decorative sprites are `aria-hidden`; the dashboard and Today strip carry labels, and the feature cards are plain links with a heading each. The Who's-that card is a real button.
- Below `lg` the orb is hidden and never started. The Today strip becomes a horizontal scroll-snap row (2 columns from `lg`, auto-fit at `xxl`), the dashboard chips scroll in a single row, and below `md` the feature grid is a dense two-column icon-and-title launcher; descriptions and "Explore" return at `md`.
- Card tilt and sheen apply on hover-capable pointers and are skipped under `prefers-reduced-motion`.

## Tests

- `src/app/features/home/home.spec.ts`: dashboard chips and refresh, next-step suggestions, the daily challenge states, Who's-that reveal and open, lab special link, feature cards and tilt. The spec forces a narrow viewport so the three.js hero is never loaded in tests; `hero-scene.ts` itself has no spec.
