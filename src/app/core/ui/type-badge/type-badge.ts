import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { titleCase, typeColorVar } from '../format';
import type { PokemonType } from '../../utils/type-chart';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';

const LIGHT_TEXT = new Set(['fighting', 'ghost', 'dragon', 'dark']);

/** Colored, labelled type pill. Conveys type by icon + text, not color alone. */
@Component({
    imports: [TranslatePipe],
selector: 'pv-type-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="badge" [class.light]="lightText()" [style.--c]="color()" [style.background]="bg()">
      <span class="dot" aria-hidden="true"></span>
      {{ label() | t }}
    </span>
  `,
  styles: [
    `
      .badge {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        padding: 0.22rem 0.7rem;
        border-radius: 999px;
        font-size: 0.78rem;
        font-weight: 700;
        letter-spacing: 0.02em;
        /* Dark ink on the light type colours, white on the dark ones — both ≥ 4.5:1 (WCAG AA). */
        color: #0b0a1f;
        border: 1px solid color-mix(in srgb, var(--c) 60%, transparent);
      }
      .badge.light {
        color: #fff;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
      }
      .dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: currentColor;
        opacity: 0.9;
      }
    `,
  ],
})
export class TypeBadgeComponent {
  readonly type = input.required<PokemonType | string>();

  label = () => titleCase(this.type());
  color = () => typeColorVar(this.type());
  /** Types whose colour is dark enough for white text. */
  lightText = () => LIGHT_TEXT.has(String(this.type()).toLowerCase());
  bg = () =>
    this.lightText()
      ? `linear-gradient(135deg, ${this.color()}, color-mix(in srgb, ${this.color()} 78%, #000))`
      : `linear-gradient(135deg, ${this.color()}, color-mix(in srgb, ${this.color()} 94%, #000))`;
}
