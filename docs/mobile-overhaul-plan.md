# Mobile-First Overhaul & Feature Expansion Plan

> Status: **shipped in v2.1.0** — 2026-07-29
> Goal: polish every view for mobile-first, overhaul RPG overworld touch controls,
> and add creative new features. One big coordinated push.

## Delivered (v2.1.0)
- ✅ Mobile bottom tab-bar + "More" sheet (`core/ui/bottom-nav/`), safe-area `--nav-h` system.
- ✅ `HapticsService` + swipe `gestures.ts` helper.
- ✅ RPG overworld: drag-to-move virtual joystick, tap-to-interact, 48px D-pad, haptics.
- ✅ Pokémon detail swipe prev/next.
- ✅ Stat Showdown minigame (`/showdown`, `game/showdown/`) + Home teaser + feature card.
- ✅ PWA install prompt (`core/ui/install-prompt/`).
- ✅ Profile "Feel" haptics toggle; Contest fluid image + overflow guard.
- ✅ Verification: build green, 393/393 tests, UI sweep 0 overflow @320/375px on all routes.

## Current state (audit summary)
- Angular 22 standalone, signals, PWA, 16 feature views, roadmap 0–18 shipped (v2.0.1).
- Mobile-first mixins exist (`src/styles/_responsive.scss`: `up(sm/md/lg/xl)` = 480/768/1024/1280).
- **Nav is a 13-item burger dropdown** (`app.scss` `.nav`) — weak mobile UX.
- `safe-area` insets only used in `pokedex.scss`.
- Audit verdict: 5 views mobile-ready, 10 partially responsive, 1 (RPG overworld) needs work.
- RPG overworld already has an on-screen pad (`overworld.ts` `press/release/held`, `.pad/.ab` ≈ 42px — borderline), plus a separate `pixi-overworld.ts` pad. No swipe movement, no haptics.

## Decisions (locked)
1. **Stat Showdown** ships as its own route `/showdown` + a Home teaser.
2. **Bottom-nav slots**: Home · Pokédex · (center) Battle · Adventure · More.
3. **Burger < md** is replaced by the bottom-nav; the burger/"More" opens a bottom-sheet with the remaining destinations.

## Phase A — Shell & foundation
1. **Mobile bottom tab-bar** — new `src/app/core/ui/bottom-nav/`, visible `< md`, "More" opens a sheet. Reuses `app.ts` `nav[]`.
2. **Safe-area system** — mixins in `_responsive.scss`, `--nav-h` token in `theme.scss`, applied to topbar, `.content` bottom padding, to-top, bottom-nav.
3. **Haptics service** — `src/app/core/haptics/haptics.service.ts` (`navigator.vibrate`, `enabled` signal persisted via `SaveService`, respects reduced-motion + setting). Patterns: `tap/success/error/impact/select`.
4. **Gesture helper** — `src/app/core/ui/gestures.ts` (pointer-based swipe detection with threshold + axis lock). Reusable.

## Phase B — Per-view mobile polish
5. **Pokémon detail** — swipe left/right = prev/next; compact sticky mini-header on scroll.
6. **Contest** — `.berries` overflow-x clip + scroll-snap; performer image fluid (`clamp`).
7. **Arena** — speed chip into toolbar `< md` (no overlay); fighter grid `min-width: 0`.
8. **Battle** — `.arena` fluid `min-height` (`clamp`); move buttons ≥ 44px.
9. **Odyssey / Spire / World / Fusion / Profile** — tap targets ≥ 44px, fluid images, dropdown clamped to viewport, landscape sanity check.
10. **Global** — all views get bottom padding for the nav; test @ 320/360/375px.

## Phase C — RPG overworld touch overhaul
11. **Swipe-to-move** on `.ow` wrap → sets `held` direction; tap = interact.
12. **Thumb D-pad** — `.pad/.ab` buttons ≥ 48px, only on `pointer: coarse`.
13. **Haptics** — vibrate on encounter start, catch success, menu confirm; mirror in `pixi-overworld.ts`.
14. **Run toggle** clearer; A/B larger + labelled.

## Phase D — New creative features
15. **Daily Hub** — swipeable card stack (Daily Challenge, Daily Fusion, Who's That, streak). Uses existing daily services + `rng.dailySeed`.
16. **Stat Showdown** — new swipe-based higher-or-lower minigame; guess which Pokémon has the higher stat. Streak + share. Route `/showdown`, logic in `game/showdown/`.
17. **PWA install prompt** — `core/ui/install-prompt/` catches `beforeinstallprompt`, dismissible banner + iOS hint.
18. **Settings** — haptics toggle in Profile; optional dismissible first-run tour.

## Phase E — Verification & polish
19. `npm test` (Vitest) green.
20. UI-shots / Playwright sweep @ 320/375/768/1024 across all routes incl. `/showdown` — 0 overflow, 0 console errors.
21. Update `docs/changelog.md`, `docs/mobile-first.md`, `docs/roadmap.md`, add feature docs.

## Key files
- `src/app/app.ts` / `app.html` / `app.scss` — `nav[]`, bottom-nav wiring, `.nav` dropdown, `.content` padding.
- `src/styles/_responsive.scss` — safe-area mixins; `src/styles/theme.scss` — `--nav-h`.
- New: `core/ui/bottom-nav/`, `core/haptics/`, `core/ui/gestures.ts`, `core/ui/install-prompt/`.
- `src/app/features/rpg/overworld/overworld.ts` + `.scss`, `overworld/pixi-overworld.ts`.
- Per-view SCSS/HTML under `src/app/features/*`.
- New: `src/app/features/showdown/` + `src/app/game/showdown/` + route in `app.routes.ts`.
- `tools/ui-shots.mjs`, `docs/changelog.md`, `docs/mobile-first.md`.
