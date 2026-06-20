import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { titleCase, typeColorVar } from '../format';
import type { PokemonType } from '../../utils/type-chart';

/** Colored, labelled type pill. Conveys type by icon + text, not color alone. */
@Component({
  selector: 'pv-type-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="badge" [style.--c]="color()" [style.background]="bg()">
      <span class="dot" aria-hidden="true"></span>
      {{ label() }}
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
        color: #fff;
        border: 1px solid color-mix(in srgb, var(--c) 60%, transparent);
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
      }
      .dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #fff;
        opacity: 0.9;
      }
    `,
  ],
})
export class TypeBadgeComponent {
  readonly type = input.required<PokemonType | string>();

  label = () => titleCase(this.type());
  color = () => typeColorVar(this.type());
  bg = () =>
    `linear-gradient(135deg, color-mix(in srgb, ${this.color()} 85%, #000 0%), color-mix(in srgb, ${this.color()} 55%, #000 30%))`;
}
