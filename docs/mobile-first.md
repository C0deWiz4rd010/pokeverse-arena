# Mobile-First Guidelines — PokéVerse Arena

From this milestone on, **every component is authored mobile-first**. The phone
layout is the baseline; larger screens are progressive enhancements.

## The rule

- **Base (no media query) = mobile.** Write the smallest-screen layout first:
  single column, stacked, full-width controls, comfortable tap targets.
- **Enhance upward with `min-width`.** Add columns, sidebars and larger type via
  `@media (min-width: …)` — never shrink down with `max-width`.

```scss
/* ✅ mobile-first */
.grid { grid-template-columns: 1fr; }
@media (min-width: 640px)  { .grid { grid-template-columns: repeat(2, 1fr); } }
@media (min-width: 1024px) { .grid { grid-template-columns: repeat(4, 1fr); } }

/* ❌ desktop-first (avoid) */
.grid { grid-template-columns: repeat(4, 1fr); }
@media (max-width: 640px) { .grid { grid-template-columns: 1fr; } }
```

## Shared breakpoints

| Token | Width | Target |
| ----- | ----- | ------ |
| `xs`  | below 361px | small phones (`below(xs)`) |
| `sm`  | 480px | large phones |
| `md`  | 768px | tablets / split desktop |
| `lg`  | 1024px | desktop |
| `xl`  | 1280px | wide desktop |
| `xxl` | 1600px | ultrawide |

Defined in `src/styles/_responsive.scss`. Never write a raw `@media (min-width…)` in a component — use the mixins:

| Mixin | Use |
| ----- | --- |
| `up(bp)` / `below(bp)` | width breakpoints |
| `short` | landscape phones (`max-height: 480px`) |
| `hover-capable` | hover effects only where a real hover exists |
| `touch` / `touch-target` | coarse pointers; 44 px minimum tap size |
| `glass-card`, `pill`, `section-title`, `state-block` | shared surfaces and blocks |

## Design tokens (`src/styles/theme.scss`)

- `--dvh` (dynamic viewport height — always use it instead of `vh`), `--gutter` (fluid page gutter), `--content-max`.
- Spacing scale `--space-1…8`, type scale `--fs-xs…2xl` (never below 0.75rem), `--tap` (44 px).
- Safe-area tokens `--safe-top/right/bottom/left` — apply to anything fixed to an edge (toasts, pads, sheets, overlays).
- Container queries (`cqi`) size the battle sprites fluidly.

## Layout checklist (per component)

1. Looks complete at **320px** wide with no horizontal scroll.
2. Tap targets ≥ 44px (the adventure pad is 56px); controls are full-width on mobile.
3. Fluid type via `clamp()` for headings.
4. Grids use `repeat(auto-fill, minmax(...))` or explicit `min-width` steps.
5. Sticky/side panels only kick in at `md`+; they stack on mobile.
6. Verified by `tools/ui-shots.mjs` at 320×640, 375×780, 844×390 (landscape), 768×1024, 1280×800, 1920×1080 and 2560×1080:
   no console errors, no horizontal overflow.
7. Respects `prefers-reduced-motion`.

## Desktop still matters

Mobile-first does **not** mean mobile-only. Every view must also look polished
on wide desktop: cap content width (`.container`), use multi-column layouts and
fill space deliberately rather than stretching mobile UI.
