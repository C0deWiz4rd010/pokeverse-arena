# Ascension Spire (roguelike)

A seeded, run-based climb that consumes the full depth of the battle engine.

## What it does

- **Draft a starting trio** from a seeded offering, then climb **15 floors**.
- Each floor offers a **choice of nodes** — Battle, Elite, Boss, Rest, Treasure,
  Event or Shop — so every run branches differently.
- **HP carries between fights** (no free healing). Rest nodes and potions are your
  only recovery, which makes every battle a resource decision.
- **Reward drafts** after each win: recruit a Pokémon, equip a held item, take a
  **relic** (a run-long modifier), heal, or bank coins.
- **Relics** bend the whole run: economy (Lucky Coin), reward count (Type Lens),
  stat auras (Vitamin Boost / Swift Feather / Guardian Shell), or item grants
  (Leftovers Aura, Focus/Sand/Mega charms).
- **Shops** spend coins on items, relics and a Full Restore.
- **Boss floors** (5, 10, 15) field tougher, larger teams at the elite AI tier.
- **Secret chimera bosses (v1.17)** — floors 10 (25 %) and 15 (40 %) may swap
  the guardian for a **Chimera Keeper** whose ace is a genuine Fusion-Lab
  splice (`fuseBattlers`): spliced name, fused types/stats, an interleaved
  four-move set and hue-shifted artwork, two levels above the team. The boss
  door only *hints* ("…sounds stitched together"). Beating one pays bonus
  coins and offers a unique **Tame** reward — the chimera joins your party.
- **Meta-progression** persists: best depth, clears, banked coins, chimeras
  slain and an **ascension tier** that rises on each clear and makes the next
  climb harder.
- **Daily run** option (a stable per-day seed) for a shared challenge —
  including the same chimera roll for everyone.

## Files

| File | Responsibility |
| ---- | -------------- |
| `game/spire/spire-types.ts` | Nodes, foe specs, rewards, shop entries, phases, meta. |
| `game/spire/relics.ts` | Relic registry + appliers (economy / reward / team build). |
| `game/spire/spire.ts` | Seeded generators: floor choices, foes, reward drafts, shops. |
| `game/spire/meta.ts` | Persisted meta-progression (best depth, clears, ascension). |
| `features/spire/spire.service.ts` | Run orchestration — draft, path, battles, rewards, shop, recovery. |
| `features/spire/spire.ts/.html/.scss` | Intro/meta, draft, run HUD, node map, reward & shop screens, finales. |
| `game/spire/spire.spec.ts` | Generation determinism, scaling, relics, meta. |

## How it works

- **Everything is seeded.** Floor layouts, foes, rewards and shops all derive
  from `runSeed + floor`, so a daily seed reproduces the exact climb.
- **Fights** reuse the shared `pv-tournament-match` component and the deepened
  engine, so status, abilities, items, weather, terrain and hazards all apply.
- **Carried HP** is tracked as a fraction of (relic-boosted) max HP, so it stays
  consistent even when a relic later changes a Pokémon's stats.
- **Difficulty curve**: foe level and AI tier scale with depth and ascension;
  bosses always fight at the elite tier.

## Reuse

`SeededRng`, the battle engine + `TeamBattle`, `BattleService.buildBattler`,
`pv-tournament-match`, the held-item registry, and the Fusion Lab core
(`game/fusion` `fuseBattlers`) for chimera bosses. Meta surfaces in the
Trainer Profile (records row + **Chimera Slayer** / **Myth Hunter**
achievements).
