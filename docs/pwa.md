# PWA, Accessibility & Mobile — PokéVerse Arena

PokéVerse Arena is an installable, offline-capable progressive web app, built
mobile-first and keyboard-accessible throughout.

## Installable PWA

| File | Responsibility |
| ---- | -------------- |
| [public/manifest.webmanifest](../public/manifest.webmanifest) | App metadata: name, theme/background colours, `standalone` display, categories and the SVG icon. |
| [public/icon.svg](../public/icon.svg) | Scalable maskable app icon (gradient Poké-orb) used for the manifest, favicon, Apple touch icon and mask icon. |
| [public/sw.js](../public/sw.js) | Hand-written service worker — no build-time manifest needed. |
| [src/index.html](../src/index.html) | Links the manifest + icons and the Apple PWA meta tags. |
| [src/main.ts](../src/main.ts) | Registers `sw.js` on load — but never on the local dev server, so HMR is untouched. |

The manifest deliberately sets **no `orientation` member** (v1.12): an
explicit value like `"any"` lets an installed PWA rotate even when the user
has the OS auto-rotate lock enabled (the manifest wins over the sensor
setting on Android). Omitting it means the installed app follows the system
rotation lock exactly like the browser does.

### Caching strategy

The service worker avoids depending on hashed build filenames and instead uses
runtime strategies:

- **Navigations** → network-first, falling back to the cached app shell so the
  app boots offline.
- **Same-origin assets** (hashed JS/CSS) → stale-while-revalidate.
- **PokéAPI data, sprite CDNs and avatars** → cache-first, since those resources
  are effectively immutable; revisited Pokémon load instantly offline.

Caches are versioned (`pv-shell`, `pv-assets`, `pv-data`) and old versions are
purged on activate. The service worker registers only off `localhost`, so it
activates on GitHub Pages but never interferes with development.

## Accessibility

- A keyboard **skip link** (visible on focus) jumps straight to `#main-content`.
- The navigation toggle exposes `aria-expanded` and an `aria-label`; decorative
  icons are `aria-hidden`.
- Interactive controls are real `<button>`/`<a>` elements with visible focus.
- Every animation is gated behind `prefers-reduced-motion`, including the PixiJS
  battle effects and the Three.js hero (which never initialise when reduced
  motion is requested).

## Mobile-first

All feature styles start from the single-column mobile layout and progressively
enhance with the shared `@include up(sm|md|lg|xl)` breakpoints — see
[mobile-first.md](mobile-first.md) for the breakpoint scale and checklist.
