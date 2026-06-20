# Tech & Library Decisions — PokéVerse Arena

This document records the technology choices for the project and the reasoning
behind them. It answers the question: *"Do libraries like PixiJS or Three.js
make sense here?"*

## Core framework

| Concern        | Choice                          | Why |
| -------------- | ------------------------------- | --- |
| Framework      | **Angular 22** (standalone)     | Latest stable, signals-first, zoneless-ready. |
| Language       | **TypeScript 6** (strict)       | Type safety across DTOs, models and battle math. |
| State          | **Angular Signals**             | Granular reactivity, no boilerplate stores. |
| Styling        | **SCSS** + CSS custom properties| Theming (type colors, glassmorphism), reduced-motion. |
| Tests          | **Vitest**                      | Ships with Angular 22, fast, ESM-native. |
| Storage        | **IndexedDB via `idb`**         | Promise-based wrapper, tiny, perfect for an API cache + savegame. |

## Rendering / animation libraries

### PixiJS 8 — ✅ YES (primary game renderer)
- Battle scenes, sprite animations, particle attack effects, screen shake,
  floating damage numbers.
- Chosen **over Phaser** (which the plan suggested) because:
  - Pixi is a *renderer*, not a full opinionated game framework, so it does not
    fight Angular for control of the loop or the DOM.
  - Much lighter bundle; we drive game state from Angular Signals and only use
    Pixi for GPU-accelerated drawing.
  - WebGL with automatic Canvas fallback → broad device support.
- Loaded **lazily** only inside the Battle/Arena feature routes so the Pokédex
  stays light.

### GSAP 3 — ✅ YES (UI + timeline animation)
- HP-bar tweening, card flips, evolution-tree line draw, tournament bracket
  reveals, damage-number pops.
- Works both on the DOM (Pokédex UI) and on Pixi display objects (battle).
- Honors `prefers-reduced-motion`: a global flag disables/instant-completes
  timelines.

### Three.js — ✅ YES, but scoped (creative "wow" factor)
- Used **only** for an optional 3D hero on the landing page: a rotating,
  holographic Poké Ball / energy core that reacts to pointer movement.
- Heavy (~600 kB), therefore **lazy-loaded** in its own standalone component and
  never part of the main/Pokédex bundle.
- Respects reduced-motion and falls back to a static SVG when WebGL is missing.
- Not used for actual gameplay (battles stay 2D via Pixi) — 3D Pokémon models
  are out of scope for performance and licensing reasons.

### Decision summary
> Use **PixiJS** for the game, **GSAP** for motion, **idb** for storage, and a
> **lazy Three.js** hero for flair. Skip Phaser. Keep every heavy dependency off
> the critical path via lazy-loaded routes.

## API strategy
- **PokéAPI REST v2** is the primary data source.
- Every response is cached in IndexedDB (cache-first, then network) to respect
  PokéAPI fair-use and to make the app offline-capable.
- GraphQL v1beta2 reserved for future complex joined queries only.

## Deployment
- **GitHub Pages** via GitHub Actions, building with a `--base-href` matching the
  repository name. Hash routing is used so deep links work on Pages.
