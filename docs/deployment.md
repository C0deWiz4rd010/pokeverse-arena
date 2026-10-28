# Deployment — GitHub Pages

PokéVerse Arena ships to GitHub Pages from a GitHub Actions workflow.

## How it works

[`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml) runs on every
push to `develop` or `main` (and on manual dispatch):

1. **Build** (`pages-build`) — `npm ci` then
   `npm run build -- --base-href=/pokeverse-arena/`, so every asset resolves under
   the repository sub-path.
2. **SPA + Pages housekeeping** — copies `index.html` to `404.html` (so any
   non-hash deep link still loads the app) and adds `.nojekyll` (so Pages serves
   every file untouched).
3. **Upload + deploy** — publishes `dist/pokeverse-arena/browser` with the
   official `upload-pages-artifact` / `deploy-pages` actions.

Because routing uses `withHashLocation()`, in-app deep links (`/#/pokedex/...`)
work on Pages without any server rewrites, and the relative manifest / icon /
`sw.js` references resolve correctly under the sub-path.

## One-time repository setup

In the GitHub repository: **Settings → Pages → Build and deployment → Source:
GitHub Actions**. After that, each push to `develop` (or `main`) redeploys the
live site automatically.

## Live URL

```
https://<owner>.github.io/pokeverse-arena/
```

> If the repository is ever renamed, update the `--base-href` value in the
> workflow to match the new sub-path.

## CI jobs

```
verify ─┬─ build-app ─┬─ e2e ──────────┐
        │             └─ lighthouse    ├─ deploy   (push to develop / main only)
        └─ pages-build ────────────────┘
```

| Job | What it enforces |
| --- | ---------------- |
| `verify` | Typecheck (app + specs), ESLint (`--max-warnings 0`), Prettier, translations + duplicate-key check, unit tests with the coverage thresholds, `npm audit` (critical findings block; high ones are reported) |
| `build-app` | One production build (root base href) shared with `e2e` and `lighthouse` as an artifact |
| `e2e` | The browser acceptance suite ([acceptance.md](acceptance.md)) — **required**; one automatic retry absorbs a PokéAPI blip |
| `lighthouse` | Mobile audit, median of 3 runs; accessibility ≥ 0.95 is an error, performance / best practices / SEO are warnings. The report is kept as a workflow artifact (not published anywhere) |
| `pages-build` | The `/pokeverse-arena/` build that GitHub Pages serves |
| `deploy` | Needs `pages-build` **and** `e2e`; pushes to `develop` and `main` both publish the site |

Dependabot (`.github/dependabot.yml`) proposes npm and Actions updates weekly; Angular and TypeScript majors are left to a deliberate upgrade.
