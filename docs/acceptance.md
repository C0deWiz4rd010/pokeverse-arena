# Acceptance & quality gates

| Gate | Command | Where it runs |
| ---- | ------- | ------------- |
| Typecheck, lint, translations | `npm run verify` (first three steps) | CI `verify` job |
| Unit tests + coverage thresholds (statements 78, branches 68, functions 82, lines 80) | `npm run test:ci` | CI `verify` job |
| Production bundle budgets | `npm run build` | CI `verify`/`build` |
| Routes × 7 viewports: no console/page errors, no horizontal overflow | `node tools/ui-shots.mjs` | `npm run accept` |
| Adventure happy path (new game → starter → wild battle → save) | `npm run e2e` | `npm run accept` |
| Offline start through the service worker | `npm run e2e:offline` | `npm run accept` |
| Lighthouse (mobile): performance ≥ 90, accessibility/best-practices ≥ 95, SEO ≥ 90 | `npx @lhci/cli autorun` | CI `lighthouse` job (informational) |
| Adventure frame time under CPU throttling | `npm run perf:overworld` | manual |

## Running the browser acceptance suite

```bash
npm run build
PW_CHANNEL=chrome npm run accept     # omit PW_CHANNEL on CI (uses Playwright's Chromium)
```

`tools/accept.mjs` serves `dist/pokeverse-arena/browser` with `tools/serve-dist.mjs` (gzip, like GitHub
Pages) and runs the three browser checks. The offline check uses `pv.localhost` because the service worker
deliberately skips plain `localhost` during development.

CI runs the same suite in the `e2e` job. It is informational (`continue-on-error`) until it has been green
on a few runs; remove that line to make it a required gate.

## Reference numbers (production build, local Chrome, mobile Lighthouse preset)

* Lighthouse: performance 93–94, accessibility 100, best-practices 100, SEO 91; FCP 1.8 s, LCP 2.8–2.9 s,
  TBT ≈ 110 ms, CLS 0.
* Adventure overworld at 16× CPU throttle: ≈ 33–37 fps in Verdant Town (unthrottled and up to 10×: 58–60 fps).
