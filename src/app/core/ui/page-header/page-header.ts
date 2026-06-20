import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Compact page header used across feature pages. A centered column: an optional
 * glowing icon chip on top, the gradient title beneath it, and the subtitle
 * centered below — tight and consistent, saving vertical space.
 */
@Component({
  selector: 'pv-page-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="ph">
      @if (icon()) {
        <span class="chip" aria-hidden="true">{{ icon() }}</span>
      }
      <h1 class="gradient-text">{{ title() }}</h1>
      @if (subtitle()) {
        <p class="sub">{{ subtitle() }}</p>
      }
    </header>
  `,
  styles: [
    `
      :host {
        display: block;
        margin-bottom: 1.2rem;
      }
      .ph {
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        gap: 0.4rem;
      }
      .chip {
        display: grid;
        place-items: center;
        width: 2.7rem;
        height: 2.7rem;
        font-size: 1.4rem;
        border-radius: 0.9rem;
        background: linear-gradient(135deg, var(--accent), var(--accent-2));
        box-shadow:
          0 8px 22px -8px color-mix(in srgb, var(--accent) 70%, transparent),
          inset 0 0 0 1px rgba(255, 255, 255, 0.18);
        position: relative;
        overflow: hidden;
      }
      .chip::after {
        content: '';
        position: absolute;
        inset: 0;
        background: linear-gradient(120deg, transparent 30%, rgba(255, 255, 255, 0.45) 50%, transparent 70%);
        transform: translateX(-120%);
        animation: sheen 5s ease-in-out infinite;
      }
      h1 {
        margin: 0;
        font-size: 1.7rem;
        line-height: 1.1;
        letter-spacing: -0.01em;
      }
      .sub {
        margin: 0;
        max-width: 54ch;
        font-size: 0.86rem;
        color: var(--text-dim);
        line-height: 1.3;
      }
      @media (min-width: 768px) {
        h1 {
          font-size: 2.1rem;
        }
        .sub {
          font-size: 0.92rem;
        }
      }
      @keyframes sheen {
        0%,
        65% {
          transform: translateX(-120%);
        }
        85%,
        100% {
          transform: translateX(120%);
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .chip::after {
          animation: none;
          display: none;
        }
      }
    `,
  ],
})
export class PageHeaderComponent {
  readonly title = input.required<string>();
  readonly subtitle = input<string>();
  readonly icon = input<string>();
}
