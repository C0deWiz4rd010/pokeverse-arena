<div align="center">

# ⚡ PokéVerse Arena

**A modular Pokémon platform & browser game built on the [PokéAPI](https://pokeapi.co/).**

Advanced interactive Pokédex · Type Lab · Team Builder · Turn-based Battles ·
Arena · Tournaments · World Explorer · Berry Garden · Contests

Built with **Angular 22** · **Signals** · **PixiJS** · **GSAP** · **Three.js** · **IndexedDB**

</div>

---

## ✨ Features

- **⌘K Command Palette** — press `Ctrl+K` anywhere to jump to
  any page, run quick actions, revisit recent Pokémon or fuzzy-find any Pokémon
  by name/number — fully keyboard-driven.
- **Accent themes** — five curated color palettes (Aurora, Ember, Verdant,
  Sakura, Solar), switchable on the Trainer Profile and persisted.
- **Achievement toasts** — unlocking any milestone pops a celebratory
  notification, no matter which mode earned it.
- **Daily Challenge** — one seeded battle per day, identical for every trainer;
  win to build a day streak (first attempt counts, retries are for fun) and
  share a Wordle-style emoji recap of your run.
- **Interactive Pokédex** — search, filter, infinite scroll, shiny toggle, base-stat
  radar, abilities, moves, evolution tree, compare — with shimmer skeleton loading.
- **Type Lab** — interactive type chart, attacker/defender calculator, team
  weakness analyzer.
- **Team Builder** — build teams of 1–6, pick level/nature/ability/moves/item,
  move-legality validation, JSON export/import.
- **Battle Engine** — deterministic, seeded, turn-based 1v1 with STAB, type
  effectiveness, crits, accuracy, status — pure & unit-tested.
- **Battle Arena (PixiJS)** — animated sprites, HP bars, damage numbers, attack
  particles, screen shake.
- **Arena** — challenge eighteen type-themed gym leaders, earn badges and become
  Champion (progress saved locally).
- **Tournaments** — single-elimination brackets across ten modes; auto-sim or play
  each 3-v-3 match yourself.
- **World Explorer** — roam the nine regions, browse each one's native Pokédex and
  find where any Pokémon first appeared.
- **Contest Hall** — blend berries into Poffins to raise contest conditions, then
  dazzle the judges against seeded rivals.
- **Adventure (RPG)** — a top-down tile-world story with three gyms, quests,
  fishing, one-way ledges, shiny wilds, save slots and gamepad support.
- **Odyssey** — an endless seeded roguelike march through eight biomes:
  daze-catch every foe, level and evolve on the move, and permanently unlock
  every caught species as a starter.
- **Installable PWA** — web manifest, app icon and a service worker that caches the
  app shell, PokéAPI data and sprites for offline play.
- **Offline-first** — every API response cached in IndexedDB; accessible skip link
  and `prefers-reduced-motion` respected throughout.

## 🧱 Tech stack

| Layer | Tech |
| ----- | ---- |
| Framework | Angular 22 (standalone, signals) |
| Language | TypeScript 6 (strict) |
| 2D game | PixiJS 8 (lazy) |
| Motion | GSAP 3 |
| 3D hero | Three.js (lazy) |
| Storage | IndexedDB via `idb` |
| Tests | Vitest |

See [`docs/tech-decisions.md`](docs/tech-decisions.md) for the reasoning behind
every choice, and [`docs/architecture.md`](docs/architecture.md) for the layout.

## 🚀 Getting started

```bash
npm install
npm start          # dev server on http://localhost:4200
npm test           # unit tests (Vitest)
npm run build      # production build
```

## 📚 Documentation

- [`docs/plan.md`](docs/plan.md) — the original master plan.
- [`docs/architecture.md`](docs/architecture.md) — folder structure & principles.
- [`docs/tech-decisions.md`](docs/tech-decisions.md) — library choices.
- [`docs/roadmap.md`](docs/roadmap.md) — phased milestones.
- [`docs/pwa.md`](docs/pwa.md) — PWA, accessibility & mobile.
- [`docs/deployment.md`](docs/deployment.md) — GitHub Pages via Actions.

## 🙏 Credits

Data from the wonderful free [PokéAPI](https://pokeapi.co/). Pokémon and Pokémon
character names are trademarks of Nintendo. This is a non-commercial fan project.
