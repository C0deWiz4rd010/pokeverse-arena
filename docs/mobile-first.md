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

| Token | Min width | Target |
| ----- | --------- | ------ |
| `sm`  | 480px     | large phones |
| `md`  | 768px     | tablets / split desktop |
| `lg`  | 1024px    | desktop |
| `xl`  | 1280px    | wide desktop |

Defined as SCSS mixins in `src/styles/_responsive.scss` — use
`@include up(md) { … }` instead of hand-writing media queries.

## Layout checklist (per component)

1. Looks complete at **320px** wide with no horizontal scroll.
2. Tap targets ≥ 40px; controls are full-width on mobile.
3. Fluid type via `clamp()` for headings.
4. Grids use `repeat(auto-fill, minmax(...))` or explicit `min-width` steps.
5. Sticky/side panels only kick in at `md`+; they stack on mobile.
6. Verified at 320 / 375 / 768 / 1024 / 1440px and at arbitrary in-between
   widths (no broken "in-between" states).
7. Respects `prefers-reduced-motion`.

## Desktop still matters

Mobile-first does **not** mean mobile-only. Every view must also look polished
on wide desktop: cap content width (`.container`), use multi-column layouts and
fill space deliberately rather than stretching mobile UI.
