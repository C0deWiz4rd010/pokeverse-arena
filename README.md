<div align="center">

# ⚡ PokéVerse Arena

**A modular Pokémon platform & browser game built on the [PokéAPI](https://pokeapi.co/).**

Advanced interactive Pokédex · Type Lab · Team Builder · Turn-based Battles ·
Arena · Tournaments · World Explorer · Berry Garden · Contests

Built with **Angular 22** · **Signals** · **PixiJS** · **GSAP** · **Three.js** · **IndexedDB**

</div>

---

## ✨ Features

- **Interactive Pokédex** — search, filter, infinite scroll, shiny toggle, base-stat
  radar, abilities, moves, evolution tree, compare.
- **Type Lab** — interactive type chart, attacker/defender calculator, team
  weakness analyzer.
- **Team Builder** — build teams of 1–6, pick level/nature/ability/moves/item,
  move-legality validation, JSON export/import.
- **Battle Engine** — deterministic, seeded, turn-based 1v1 with STAB, type
  effectiveness, crits, accuracy, status — pure & unit-tested.
- **Battle Arena (PixiJS)** — animated sprites, HP bars, damage numbers, attack
  particles, screen shake.
- **Arena · Tournaments · World Explorer · Berry Garden · Contests** — a growing
  set of game modes powered by PokéAPI data.
- **Offline-first** — every API response cached in IndexedDB; PWA-ready.

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

## 🙏 Credits

Data from the wonderful free [PokéAPI](https://pokeapi.co/). Pokémon and Pokémon
character names are trademarks of Nintendo. This is a non-commercial fan project.
