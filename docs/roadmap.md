# Roadmap & Milestones — PokéVerse Arena

Each phase is shipped to `develop` as one or more focused commits. Status is
updated as work progresses. Detailed per-feature documentation lives in
[features/](features/README.md).

| Phase | Milestone | Status |
| ----- | --------- | ------ |
| 0 | Project scaffold (Angular 22, libs, docs) | ✅ done |
| 1 | Core foundation: API client, IndexedDB cache, models, utils | ✅ done |
| 2 | App shell: theme, layout, routing, navigation | ✅ done |
| 3 | Pokédex MVP: list + infinite scroll + search | ✅ done |
| 4 | Pokémon detail: stats, types, abilities, moves, evolution | ✅ done |
| 5 | Pokédex filters & compare | ✅ done |
| 6 | Type Lab: type chart + team weakness analyzer | ✅ done |
| 7 | Team Builder: build, validate, export/import | ✅ done |
| 8 | Battle engine (pure) + unit tests | ✅ done |
| 9 | Battle UI (Angular) | ✅ done |
| 10 | Battle scene (PixiJS) + effects | ✅ done |
| 11 | Random battle + Arena | ✅ done |
| 12 | Tournaments (brackets) | ✅ done |
| 13 | World Explorer (regions) | ✅ done |
| 14 | Contest Mode (Poffins, appeals) | ✅ done |
| 15 | Landing 3D hero (Three.js, lazy) | ✅ done |
| 16 | PWA, polish, a11y, mobile-first | ✅ done |
| 17 | GitHub Pages deployment | ✅ done |
| 18 | Deep Systems Overhaul: engine (status/stages/abilities/items/weather/terrain/hazards/switching), Arena ladder + Gauntlet, Tournament formats + standings, Ascension Spire (new), Profile backbone, Contest/World/Team deepening | ✅ done |

| 19 | The A–Z polish release (v2.1 → v3.0): robustness, performance, responsive system, accessibility & German/English, graphics, input/audio/haptics, acceptance suite | ✅ done |
| 20 | Quality plan v3.0.1 → v3.0.12 (see [improvement-plan.md](improvement-plan.md)): stricter types and lint, decoupled architecture, one persistence layer + resumable runs, one battle core with deeper mechanics, accessibility, honest coverage, CI | ✅ done |

The phase-by-phase breakdown of milestone 18 is archived in [archive/deep-systems-plan.md](archive/deep-systems-plan.md), the
mobile-first push of v2.1 in [archive/mobile-overhaul-plan.md](archive/mobile-overhaul-plan.md).

## Git workflow
- Default integration branch: **`develop`**.
- Every feature/point is committed and pushed to `develop` with a descriptive,
  multi-line commit message (what + why).
- Both `develop` and `main` publish the production build to GitHub Pages (after verify and e2e pass).

## Definition of done (per feature)
- Compiles with `strict` TypeScript, no lint errors.
- Loading / error / empty states handled.
- Reduced-motion respected where animated.
- Unit tests for any non-trivial pure logic.
