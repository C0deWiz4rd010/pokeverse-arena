# PokéVerse Arena – Verbesserungsplan (v3.0.1 → v3.0.12) (ohne RPG/Adventure)

> **Abgeschlossen** — alle zwölf Phasen sind umgesetzt; Details und Abweichungen stehen im [Changelog](changelog.md).

## Context

Das Repo (Angular 22, zoneless, Signals, Vitest, Pixi/Three, PWA, v3.0.0) ist funktional weit, aber die Analyse aller
Docs + des Codes zeigt strukturelle Schulden: große Feature-Services mit Mehrfachverantwortung, doppelte Logik
(zwei Engines, zwei Stat-Radars, doppelte Run-Ökonomie), uneinheitliche Persistenz, kaum Feature-Tests (14 von 16
Features ohne Spec), lockere TS/Lint-Regeln, CI-Fehlkonfiguration und Docs, die nicht mehr zum Code passen
(GSAP „verwendet“, aber nicht importiert; Showdown undokumentiert; Feature-Docs als v1/v2/v3-Schichten).

**Ziel:** jede Schicht außer dem RPG-Teil verbessern – Technik, Qualität, Gameplay-Tiefe der bestehenden Features, Docs.
**Ablage:** dieses Dokument (`docs/improvement-plan.md`); Status-Spalte wird pro Phase abgehakt.

**Ausgeschlossen:** `src/app/features/rpg/**`, `src/app/game/rpg/**`, `docs/rpg-*.md`, `docs/features/rpg.md`.
Einzige Berührung: ein Re-Export, wenn Evolution-Helfer aus `game/rpg` herausgezogen werden (Phase 3).

**Konventionen (wie bisher):** ein fokussierter Commit pro Phase auf `develop`, Patch-Versionsbump (3.0.1, 3.0.2 …) in `package.json` +
`src/app/core/version.ts`, Changelog-Eintrag, `npm run verify` grün vor jedem Commit.

## Status

| Phase | Inhalt | Version | Status |
| ----- | ------ | ------- | ------ |
| 1 | Quick Wins & Bugfixes | v3.0.1 | ✅ |
| 2 | Strengere Typen & Lint | v3.0.2 | ✅ |
| 3 | Architektur entkoppeln | v3.0.3 | ✅ |
| 4 | Große Services aufteilen | v3.0.4 | ✅ |
| 5 | Einheitliche Persistenz + Run-Resume | v3.0.5 | ✅ |
| 6 | Battle-Engine vereinheitlichen & vertiefen | v3.0.6 | ✅ |
| 7 | Battle-UI entdoppeln | v3.0.7 | ✅ |
| 8 | Lade-/Fehler-/Leerzustände & Barrierefreiheit | v3.0.8 | ✅ |
| 9 | Testabdeckung Features + Core | v3.0.9 | ✅ |
| 10 | Performance, Bundle, i18n-Struktur | v3.0.10 | ✅ |
| 11 | CI/CD härten | v3.0.11 | ✅ |
| 12 | Dokumentation neu aufsetzen | v3.0.12 | ✅ |

---

## Phase 1 – Quick Wins & Bugfixes

1. **CI:** `.github/workflows/deploy.yml:20-22` – `concurrency: pages` + `cancel-in-progress` gilt auch für PRs → PR kann
   Produktions-Deploy abbrechen. Concurrency nur auf den `deploy`-Job bzw. `group: pages-${{ github.ref }}`.
2. **GSAP entfernen:** in `src/` nirgends importiert → aus `package.json` raus; `README.md`, `docs/tech-decisions.md` korrigieren.
3. **CSP:** `import 'pixi.js/unsafe-eval'` in `features/battle/pixi/battle-fx.ts` (dyn. Import-Stelle ~:250) → `'unsafe-eval'` aus
   `src/index.html` streichen; `base-uri 'self'` ergänzen; wirkungsloses `frame-ancestors` im Meta-Tag entfernen.
   Prüfen, dass RPG-Pixi (eigener Import) weiterhin läuft – sonst dort ebenfalls nur den Side-Effect-Import ergänzen.
4. **Stat-Radar-Achsen:** `features/pokemon-detail/stat-radar.ts:16-23` hat andere Reihenfolge als
   `features/pokedex/stat-radar.ts:10-17` (gleiches Pokémon = andere Form). Auf `RADAR_STATS` umstellen.
5. **Showdown:** `features/showdown/showdown.ts:211-241` – `loadRound` ohne try/catch (bleibt offline in `'loading'` hängen);
   Fehlerzustand + Retry; Gegner über seeded RNG (`core/utils/rng.ts`) statt `Math.random()`.
6. **Leaks:** `pokemon-detail.ts:198-212` (Count-up/`setTimeout` nach Destroy abbrechen via `DestroyRef`);
   `profile/achievement-watcher.service.ts:33-41` (Subscription/Interval/Listener mit `DestroyRef` aufräumen).
7. **API-Client:** `core/api/pokeapi.client.ts:44-53` – In-flight-Dedupe *vor* dem Cache-Lookup registrieren; `cache.set`
   nicht awaiten (`void`); 404 negativ cachen (kurze TTL); `byUrl` auf `https://pokeapi.co/` beschränken. Specs ergänzen.
8. **Bootstrap-Fallback:** `src/main.ts` – bei Fehler statt nur `console.error` eine sichtbare Meldung rendern.

## Phase 2 – Strengere Typen & Lint

1. `tsconfig.json`: `strictTemplates: true` (+ `extendedDiagnostics` als Error) → Template-Fehler beheben.
2. `noUncheckedIndexedAccess: true` – Fehler featureweise fixen (viele Record-Zugriffe: i18n, `TYPE_WEATHER`, Type-Chart).
   RPG-Dateien: falls betroffen, minimale `!`/Guard-Fixes ohne Verhaltensänderung oder Override per eigenem tsconfig-Include.
3. `eslint.config.js`: umgesetzt als `recommendedTypeChecked` (strictTypeChecked wäre ~300 Befunde; `no-unnecessary-condition` bewusst aus), `no-floating-promises`,
   `no-explicit-any`/`no-unused-vars` als Error; `tools/**` mitlinten; `lint` mit `--max-warnings 0`.
4. Prettier: `format:check`-Script, in `verify` und CI aufnehmen; einmalig formatieren (eigener Commit).

## Phase 3 – Architektur entkoppeln

1. **Geteilte Typen:** `PlayerMatchSetup` (aus `tournaments.service`) und `MatchOutcome` (aus der `tournament-match`-Komponente)
   nach `game/tournament/types.ts`; Importe in `arena.service.ts:24-25`, `spire.service.ts:26-27`, `odyssey.service.ts:9-10` umstellen.
2. **`buildBattler`** (`features/battle/battle.service.ts:45`) + `baseStats` (dupliziert in `tournaments.service.ts:674`)
   in einen Core-Service `core/battle/battler-factory.ts` verschieben; alle Nutzer umstellen.
3. **Run-Ökonomie:** `addCoins/addRelic/equipItem` (spire :312-326, odyssey :329-346) → `game/run/run-economy.ts` (pur, mit Spec).
4. **Evolution-Helfer:** `evolutionAt`, `levelUpEvolutions` nach `game/evolution/` verschieben; `game/rpg/evolution.ts`
   re-exportiert nur (einzige RPG-Berührung). Odyssey importiert dann nicht mehr aus `game/rpg`.
5. **Namenskonflikte:** UI-`Weather` (`core/ui/weather-overlay/weather.ts`) → `Ambience`; `features/battle/battle-weather.ts`-Shim löschen.
6. **Stat-Radar** als eine Komponente nach `core/ui/stat-radar/`; Geometrie aus `pokedex/stat-radar.ts`, Detail-Komponente darauf aufbauen.

## Phase 4 – Große Services aufteilen

1. `tournaments.service.ts` (765 Z.) → `TournamentRosterService` (Roster/Team-Bau :656-:738), `TournamentRunner`
   (Bracket-Sim :571), `LeagueService` (:360-:525), `PickemStore` (:170-:352), `RivalHistoryStore`. Fassade bleibt für Komponenten.
2. `arena.service.ts` (453) → Gym-Flow, `EliteFourGauntlet` (:243-:335), `ArenaProgressStore` (:337-:453).
3. Spire/Odyssey: `party` als `signal` statt Feld + `version`-Zähler-Workaround (`odyssey.service.ts:343`).
4. Ziel: keine Service-Datei > ~300 Zeilen; Komponenten-API unverändert. (Umgesetzt für Tournaments/Arena; Spire/Odyssey bleiben bei ~400 Zeilen, Aufteilung wäre rein kosmetisch.)

## Phase 5 – Einheitliche Persistenz + Run-Resume

1. Alle `safe-storage`-Direktzugriffe auf `SaveService` (versioniert, Migrationen): `arena.service.ts` (:104, :274, :342-:447),
   `game/spire/meta.ts:7`, `game/tournament/history.ts:5`, `game/tournament/rival.ts:8` (pure Module bekommen Storage-Adapter injiziert).
   Migrationen in `core/storage/migrations.ts` für alte Keys (mit Specs).
2. Backup: deckt `pv:`-Keys und die alten Rohkeys bereits ab (Präfixliste); alte Backups werden beim ersten Lesen migriert – kein weiterer Umbau nötig.
3. **Spire- und Odyssey-Runs persistieren** → nach Reload „Run fortsetzen“.
4. Fehlgeschlagene Saves (`save.service.ts`, `cache.service.ts` leere `catch`) als Toast/Log melden statt schlucken.

## Phase 6 – Battle-Engine vereinheitlichen & vertiefen

1. **Gemeinsamer Turn-Kern:** End-of-Turn/Residuals/Move-Ausführung aus `game/engine/battle.ts` und `team-battle.ts` in
   einen gemeinsamen `BattleCore` (`game/engine/battle-core.ts`), den beide Engines hosten. Bekannte Divergenz beheben: Leech Seed fehlt in `team-battle.ts:505-531`.
2. **Confusion** verdrahten (`confusionTurns` in `battle-types.ts:102` wird nie gelesen).
3. Neue Mechaniken in Paketen, je mit Specs: (a) Reflect/Light Screen/Aurora Veil, Tailwind, Trick Room;
   (b) Substitute, Taunt, Encore; (c) U-turn/Volt Switch (Pivot erst am Rundenende), Recharge- & Zwei-Runden-Moves (ohne Fly/Dig), Fixschaden (Seismic Toss), Knock Off,
   Struggle/PP-Erschöpfung; (d) Terastallisieren als echter Turn-Schritt (bisher nur in `rules.ts`).
4. `abilities.ts` (34) und `items.ts` (21) erweitern: Intimidate, Mold Breaker, Sheer Force, Prankster, Moxie, Clear Body,
   Download, Tough Claws; Weakness Policy, Air Balloon, Heavy-Duty Boots, Typ-Platten, Choice-Lock-Randfälle. Direkte Specs.
5. Generation festlegen: Hail vs. Snow (`weather.ts:22-23`) – auf Gen-9-Snow vereinheitlichen.
6. `move-convert.ts` an neue Effekte anbinden; Specs für `game/arena/elite-four.ts`, `game/spire/relics.ts`.

## Phase 7 – Battle-UI entdoppeln

1. Keydown-Handling, `useMove`, Side-Sync aus `battle.ts:244-323` und `tournament-match.ts:190-364` in
   `battle-presenter.ts`; leeres `syncSide()` (`battle.ts:316`) durch passenden Vertrag ersetzen.
2. UI für neue Mechaniken (Screens, Trick Room, Substitute-Sprite, Tera-Button, Confusion-Badge) über `status-badge`/`field-banner`.

## Phase 8 – Lade-/Fehler-/Leerzustände & Barrierefreiheit

1. (Audit-Befund war größtenteils veraltet: Spire/World/Contest/Palette haben Fehler- und Leerzustände schon; Type-Lab/Profil/Match haben keine asynchrone Fehlerquelle.) Ursprünglich geplant: `profile.html`, `type-lab.html`, `spire.html`, `tournament-match.html`,
   `command-palette.html` (`@empty`); `error`-Signal in `spire.service`, `world.service`, `contest.service` (wie `odyssey.service.ts:64`).
2. `core/ui/modal/modal.ts`: Hintergrund `inert` + Scroll-Lock, Opener früher erfassen.
3. `stat-bar` → `role="meter"` + aria-Werte; `toasts.ts` Live-Region nur um Text; `move-button` `aria-describedby` für Tooltip;
   `bottom-nav` `aria-controls`; `pokemon-detail.html:10` Prev/Next `aria-label`; Esc für Backdrops in
   `pokemon-compare.ts`, `pokemon-quickview.ts`, `whos-that.ts`; dekorative Bilder `alt=""`; Showdown-Karten als fokussierbare Buttons.

## Phase 9 – Testabdeckung

1. Coverage ehrlich messen: in `angular.json` Coverage-`include` auf `src/app/**/*.ts` setzen (derzeit nur geladene Dateien) –
   Baseline messen, Schwellen danach realistisch festlegen und je Phase anheben.
2. Service-Specs: tournaments (aufgeteilte Services), arena, spire, odyssey, team-builder, battle.service, battle-presenter,
   world, contest, fusion, command-palette (Suche/Ranking).
3. Core-Specs: theme, translate.pipe, translated-title.strategy, cry, haptics, gestures, format, Ambience; Komponenten
   bottom-nav, install-prompt, move-button, toasts, stat-bar, state; `app.spec.ts` (Shell, Ctrl+K).
4. Browser-Akzeptanz um Nicht-RPG-Flows erweitern (`tools/accept.mjs`): Pokédex-Suche → Detail, Battle bis Sieg, Turnier-Match,
   Team-Builder Export/Import.

## Phase 10 – Performance, Bundle, i18n-Struktur

1. Reale Bundle-Größen messen, Budgets in `angular.json:36-50` straffen (Ziel initial ~300/400 kB).
2. Prüfen, dass `preload: true` auf `battle` (`app.routes.ts`) Pixi nicht vorlädt (BattleFx nur per `@defer`).
3. `de.data.ts` (1275 Z.) nach Domänen splitten (umgesetzt als rest / game / rpg / patterns – nach Fundort des Textes); Duplicate-Key-Check in
   `tools/i18n-check.mjs` (Spread in `de.ts:5` überschreibt still).
4. Lighthouse-Basislinie halten (Perf ≥ 90, A11y 100).

## Phase 11 – CI/CD härten

1. Build einmal, als Artefakt an lighthouse/e2e/deploy weitergeben (statt 3× `npm ci && build`).
2. `e2e` zur Pflicht machen (`continue-on-error` raus), `deploy` hängt an `e2e`; Lighthouse-Accessibility als `error`.
3. Format-Check + strenger Lint in `verify`; Dependabot/Renovate für npm + Actions; `npm audit` für high blockierend.
4. **Entscheidung (getroffen):** Deploy bleibt bei `develop` + `main`; die Doku wird angeglichen statt des Workflows.

## Phase 12 – Dokumentation neu aufsetzen

1. Feature-Docs (nicht-RPG) auf Ist-Zustand umschreiben statt v1/v2/v3-Schichten (z. B. `docs/features/battle.md` beschreibt noch
   „simple expected-damage AI, Lv 50“); einheitliches Schema: Was/Dateien/Ablauf/Entscheidungen/Tests.
2. Neu: `docs/features/showdown.md`; Index `docs/features/README.md` ergänzen.
3. `README.md`: „Berry Garden“ (existiert nur im RPG), Turnier-Beschreibung („single-elimination“ → Formate), GSAP korrigieren.
4. Abgeschlossene Pläne (`plan.md`, `mobile-overhaul-plan.md`) nach `docs/archive/`; `roadmap.md` um diese Phasen fortschreiben;
   `architecture.md` um neue Ordner (`core/battle`, `game/run`, `game/evolution`) ergänzen; Changelog v3.0.12.

---

## Verifikation (pro Phase)

- `npm run verify` (typecheck, lint, i18n, Tests + Coverage, Build) grün.
- `npm run build && npm run accept` (Routen × 7 Viewports, Offline-Start; RPG-Happy-Path muss weiter grün sein = Regressionstest).
- Phase 1: CSP ohne `unsafe-eval` → Battle-Effekte und Adventure im Prod-Build ohne Konsolenfehler prüfen.
- Phase 5: alter Save im `localStorage` → App starten → Migration korrekt, Backup-Export/Import-Roundtrip.
- Phase 6: Engine-Specs + deterministische Replays (gleicher Seed ⇒ gleiches Ergebnis) für Battle und TeamBattle.
- Phase 10/11: Lighthouse CI (`npx @lhci/cli autorun`) und CI-Lauf auf PR prüfen.
