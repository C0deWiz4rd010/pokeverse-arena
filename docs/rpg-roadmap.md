# Adventure (RPG) — Improvement Roadmap & Next Steps

Status after v1 (P0–P5): a complete, playable slice — overworld, starter, wild
battles, catching, XP/levels, bag, Center/Mart, dialogue, trainers, Route 1, the
Oakhaven Gym and the Hive Badge. Standalone save. 233 unit tests green; verified
end-to-end (desktop + mobile), 0 console errors.

This document plans where to take it next.

## Honest assessment of v1 (gaps & rough edges)
- **Movesets are not level-accurate.** `buildBattler` picks the 4 strongest
  *damaging* level-up moves regardless of level → a Lv5 starter can wield moves it
  shouldn't, and never has a status move. No "learn a move on level-up".
- **No evolutions** (deliberately deferred in v1).
- **The PC Box is write-only.** Catches past 6 go to `box` but there's no UI to
  view/withdraw/reorder → caught Pokémon can become inaccessible.
- **No nicknames / rename.**
- **Battle FX are lighter than the rest of the app.** rpg-battle has shake/flash +
  colour log, but lacks the floating damage numbers, send-out/faint animations and
  cries that Battle/Tournament already have.
- **Status doesn't carry into battle** (only HP does); **Revive** is field-only.
- **XP is generous/simple** (every surviving member gets the full yield), not
  participant-based; no EXP-Share, no held items.
- **Thin world**: one route, one gym, no rival, no cave, no gates/keys.
- **Trainers are talk-to-battle**, NPCs are static (no line-of-sight, no wandering).
- **Single save slot**, no delete/export; per-step position isn't autosaved (only on
  warp/pickup/battle/menu-save) — acceptable but worth a visible "saved" model.
- **Tech debt**: battle presentation (playEvents/log/HP/FX) is now duplicated across
  `battle.ts`, `tournament-match.ts`, `rpg-battle.ts`.

## Guiding principles
Keep pure logic in `game/rpg/**` (unit-tested), thin signal-driven components,
cache-first PokéAPI, reduced-motion gates, mobile parity, standalone `rpg:save`.
Reuse the engine — don't fork battle logic.

---

## Roadmap (prioritised)

### Tier 1 — make the core feel right  *(recommended next)*
1. **Battle FX parity + cries.** Port floating damage numbers, send-out & faint
   animations, and play cries (existing `CryService`) into `rpg-battle`. Best done
   by extracting a shared `battle-presentation` helper (see tech-debt) so all three
   battle UIs stay consistent. *Effort: M · Impact: high.*
2. **Level-accurate movesets + learn-on-level-up.** Use `level_learned_at` to pick
   moves known at the mon's level (incl. one status move when available); on
   level-up, offer to learn newly-available moves (replace a slot). New
   `game/rpg/learnset.ts` (pure, tested); `BattleService` gets a level-aware move
   picker. *Effort: M · Impact: high.*
3. **PC Box + party management.** A box/party screen to withdraw/deposit, reorder
   the party, and view summaries; nicknames on catch/rename. Pure ops in
   `game/rpg/party.ts` (+ tests); a `pc-box` UI component. *Effort: M.*
4. **Evolutions (level-up).** Fetch evolution-chain (cache-first), evolve eligible
   mons after battle with an animation; respect a per-mon "no-evolve" toggle.
   `game/rpg/evolution.ts` (pure threshold logic + tests). *Effort: M.*

### Tier 2 — content & depth
5. **More world**: Route 2 + a cave (distinct encounter tables, a badge-gated
   ledge/gate), a 2nd & 3rd gym (reuse `GymLeader` themes), a recurring **rival**,
   more trainers/items/signs. Mostly authored data in `game/rpg/maps/**`.
6. **Line-of-sight trainers + wandering NPCs** (the classic "!" spot + walk-up).
7. **Battle depth**: carry status into battle, allow Revive in battle on a fainted
   member, add an **EXP-Share** item and simple **held items** (Leftovers/Oran).
8. **Economy & replay**: balance prices/payouts, **trainer rematches**, **gym
   rematch**, sellable items in the Mart.

### Tier 3 — polish, systems & a11y
9. **Day/night + route weather** (cosmetic via the weather overlay; light
   mechanics like higher rates at night).
10. **Save UX**: multiple slots, delete, export/import JSON, an autosave indicator.
11. **Quests/objectives tracker** + a simple **town map / fly-lite** between
    visited Centers.
12. **Accessibility & mobile**: focus management entering battle/menus, ARIA-live
    battle text, larger touch targets, optional haptics; a "running shoes" toggle.
13. **Performance**: cache the static tile layer to an offscreen canvas so large
    maps only redraw moving entities.
14. **RPG Pokédex entry view**: reuse `mapPokemon`/`mapSpecies` to show a caught
    mon's stats/flavour from the dex tab.

## Tech debt to pay down alongside
- **Extract shared battle presentation.** A `core/battle-ui/` (or a base class /
  composable) for the event→log/HP/FX pipeline used by `battle.ts`,
  `tournament-match.ts`, `rpg-battle.ts`. Removes drift and makes Tier-1 #1 land
  everywhere at once.
- **More unit tests**: catch→party insertion, trainer XP summation, evolution
  thresholds, box deposit/withdraw, learnset selection.
- **Check in a Playwright e2e spec** for the adventure happy-path (currently
  verified via ad-hoc scripts) so regressions are caught in CI.

## Recommended next steps (the immediate slice)
A tight, high-value first increment ("v1.1"):
1. Extract shared **battle-presentation** → port **FX + cries** into rpg-battle.
2. **Level-accurate movesets + learn-on-level-up** (+ status moves).
3. **PC Box / party reorder / nicknames**.

That trio fixes the most-felt gaps (battle feel, move authenticity, the
inaccessible box) before expanding content. Then tackle **evolutions**, then the
**Tier-2 world expansion** (Route 2 + cave + gyms 2–3 + rival).

## Per-increment definition of done
`npx ng build` clean · `npx vitest run` green (new pure logic covered) · Playwright
smoke (desktop + mobile, 0 console errors) · reduced-motion respected · one commit
per increment on `develop`.
