import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Compact page header used across feature pages. The glowing icon chip sits
 * inline next to the gradient title (one tight row) with the subtitle centered
 * beneath — minimizing vertical space while staying centered and consistent.
 */
@Component({
  selector: 'pv-page-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="ph">
      <div class="lead">
        @if (icon()) {
          <span class="chip" aria-hidden="true">{{ icon() }}</span>
        }
        <h1 class="gradient-text">{{ title() }}</h1>
      </div>
      @if (subtitle()) {
        <p class="sub">{{ subtitle() }}</p>
      }
    </header>
  `,
  styles: [
    `
      :host {
        display: block;
        margin-bottom: 0.9rem;
      }
      .ph {
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        gap: 0.25rem;
      }
      .lead {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.55rem;
      }
      .chip {
        flex: none;
        display: grid;
        place-items: center;
        width: 2.1rem;
        height: 2.1rem;
        font-size: 1.1rem;
        border-radius: 0.7rem;
        background: linear-gradient(135deg, var(--accent), var(--accent-2));
        box-shadow:
          0 6px 16px -8px color-mix(in srgb, var(--accent) 70%, transparent),
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
        font-size: 1.45rem;
        line-height: 1.1;
        letter-spacing: -0.01em;
      }
      .sub {
        margin: 0;
        max-width: 56ch;
        font-size: 0.82rem;
        color: var(--text-dim);
        line-height: 1.3;
      }
      @media (min-width: 768px) {
        .chip {
          width: 2.4rem;
          height: 2.4rem;
          font-size: 1.25rem;
        }
        h1 {
          font-size: 1.85rem;
        }
        .sub {
          font-size: 0.88rem;
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
