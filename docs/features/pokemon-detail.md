# Pokémon Detail

A rich profile page for a single Pokémon.

## What it does

Aggregates Pokémon + species + evolution data into one view:

- **Hero card**: official artwork with a shiny toggle, cry playback, type badges
  and a type-tinted glow.
- **Base stats**: labelled bars plus a hexagonal SVG **stat radar**.
- **Abilities** (normal + hidden), **breeding & profile** (generation, egg
  groups, capture rate, happiness, habitat, color).
- **Evolution tree**: recursive display of the full chain with conditions.
- **Moves**: tabbed by learn method (level-up / TM-HM / egg / tutor).

## Files

| File | Responsibility |
| ---- | -------------- |
| `features/pokemon-detail/pokemon-detail.service.ts` | Aggregates pokemon + species + evolution; lazy ability/move loaders. |
| `features/pokemon-detail/pokemon-detail.ts` / `.html` / `.scss` | Page layout, shiny toggle, cry playback, move tabs. |
| `features/pokemon-detail/stat-radar.ts` | Hexagonal SVG radar from precomputed coordinates. |
| `features/pokemon-detail/evolution-tree.ts` | Recursive evolution-chain renderer. |

## How it works

- The route id is bound to a component input (component input binding) and drives
  the service, which loads the Pokémon, its species and the evolution chain
  (each cache-first).
- Abilities and move details are fetched lazily/on demand to keep the initial
  render fast.

## Key decisions

- **Radar geometry** uses precomputed vertex coords with `r = 70` and a label
  radius of `r + 20` so outer labels/values never clip the card edge.
- **Accessibility**: type is conveyed by badge text + icon (not color alone);
  the shiny toggle and cry button are real buttons.

## Mobile-first

Single-column baseline; the hero becomes sticky and the stats split into a
two-column layout only at `lg`/`md`. The evolution tree stacks vertically on
mobile and goes horizontal at `md`.
