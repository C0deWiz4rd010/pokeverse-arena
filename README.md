<div align="center">

# ⚡ PokéVerse Arena

**A modular Pokémon platform & browser game built on the [PokéAPI](https://pokeapi.co/).**

Advanced interactive Pokédex · Type Lab · Team Builder · Turn-based Battles ·
Arena · Tournaments · World Explorer · Fusion Lab · Berry Garden · Contests

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
- **Fusion Lab** — splice any two Pokémon into a brand-new species: spliced
  name, blended typing, head/body-weighted stats, a re-tinted palette and a
  two-voice chimera cry — deterministic, shareable via `?head=&body=` links and
  collectable in a persistent Fusion Dex.
- **Contest Hall** — blend berries into Poffins to raise contest conditions, then
  dazzle the judges against seeded rivals.
- **Adventure (RPG)** — a top-down tile-world story with four gyms, quests,
  fishing, one-way ledges, shiny wilds, day/night encounters, save slots and
  gamepad support.
- **Odyssey** — an endless seeded roguelike march through eight biomes:
  daze-catch every foe, level and evolve on the move, and permanently unlock
  every caught species as a starter.
- **Deutsch / English** — the whole UI in both languages, switchable any time (`DE | EN`), including NPC dialogue,
  battle log, items, quests and German Pokédex entries.
- **Sound & haptics** — synthesised sound effects (volume/mute in the profile) and vibration on hits, catches and level-ups.
- **Installable, offline-first PWA** — the app shell is precached on the first visit, PokéAPI data and sprites are cached,
  and the app starts without a network.
- **Responsive & accessible** — fluid layouts from 320 px phones (portrait and landscape) to ultrawide, safe areas,
  focus-trapped dialogs, WCAG-AA contrast, `prefers-reduced-motion` respected throughout.

## 🧱 Tech stack

| Layer | Tech |
| ----- | ---- |
| Framework | Angular 22 (standalone, signals) |
| Language | TypeScript 6 (strict) |
| 2D game | PixiJS 8 (lazy) |
| Motion | GSAP 3 |
| 3D hero | Three.js (lazy) |
| Storage | IndexedDB via `idb` |
| Tests | Vitest (+ coverage thresholds) · Playwright acceptance suite |

See [`docs/tech-decisions.md`](docs/tech-decisions.md) for the reasoning behind
every choice, and [`docs/architecture.md`](docs/architecture.md) for the layout.

## 🚀 Getting started

```bash
npm install
npm start          # dev server on http://localhost:4200
npm test           # unit tests (Vitest)
npm run verify     # typecheck + lint + translations + tests/coverage + production build
npm run build      # production build
npm run accept     # browser acceptance on the production build (routes × viewports, adventure, offline)
```

## 📚 Documentation

- [`docs/plan.md`](docs/plan.md) — the original master plan.
- [`docs/architecture.md`](docs/architecture.md) — folder structure & principles.
- [`docs/tech-decisions.md`](docs/tech-decisions.md) — library choices.
- [`docs/roadmap.md`](docs/roadmap.md) — phased milestones.
- [`docs/pwa.md`](docs/pwa.md) — PWA, accessibility & mobile.
- [`docs/deployment.md`](docs/deployment.md) — GitHub Pages via Actions.
- [`docs/mobile-first.md`](docs/mobile-first.md) — responsive tokens, breakpoints and mixins.
- [`docs/i18n.md`](docs/i18n.md) — the English/German translation layer.
- [`docs/acceptance.md`](docs/acceptance.md) — quality gates, acceptance suite, reference numbers.
- [`docs/changelog.md`](docs/changelog.md) — release notes.

## 🙏 Credits

Data from the wonderful free [PokéAPI](https://pokeapi.co/). Pokémon and Pokémon
character names are trademarks of Nintendo. This is a non-commercial fan project.
