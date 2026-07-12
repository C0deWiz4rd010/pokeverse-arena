# Home & 3D Hero

The landing page — the first impression and the only place Three.js is used.

## What it does

- Presents the brand, a short pitch and entry points into the main modules.
- Renders a **holographic orb** built with Three.js as an eye-catching hero
  visual, loaded lazily so it never bloats other routes.

## Files

| File | Responsibility |
| ---- | -------------- |
| `features/home/home.ts` / `.html` / `.scss` | Landing layout + lazy hero bootstrap. |
| `features/home/hero-scene.ts` | `createHeroScene()` — builds the Three.js scene and returns a disposer. |

## Key decisions

- **Lazy Three.js.** `hero-scene.ts` is dynamically imported only after the home
  view renders, so the ~150 KB renderer is never in the critical path of the
  Pokédex or Battle routes.
- **Disposer pattern.** `createHeroScene()` returns a cleanup function that stops
  the animation loop and releases GPU resources on navigation away — no leaks.
- **Graceful fallback.** If WebGL is unavailable or the user prefers reduced
  motion, the scene is skipped and a static visual is shown instead.

## Mobile-first

On mobile the layout is a single centered column with the 3D visual ordered
first; at `lg` it becomes a two-column hero with copy beside the canvas.

## Home v2

- **Trainer dashboard** in the hero — live progress chips (rank, badges, cup wins,
  best Spire depth, achievements, coins) aggregated from every system via
  `ProfileService`.
- **Complete, refreshed feature grid** (now includes Ascension Spire & Trainer
  Profile) with **type-themed cards** that tilt to the cursor, sweep a sheen and
  stagger in.
- Animated gradient title + entrance motion; the 3D hero and reduced-motion
  fallback are unchanged.

## "Today" strip (v1.13)

Two compact cards between the hero and the feature grid put the day's seeded
content one tap away:

- **Daily Challenge** — state-aware copy (ready / cleared / attempt spent),
  the live streak + best, and both matchup sprites, linking to
  `/battle?daily=1`.
- **Today's Lab Special** — the seeded fusion pair of the day with both donor
  sprites, linking straight into the Fusion Lab.

Both cards read only local/seeded state (`DailyService`, `dailyFusionPair`)
and id-addressed sprite URLs — the landing page still makes no API calls.
