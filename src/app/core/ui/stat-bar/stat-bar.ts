import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Animated horizontal stat bar with a color that reflects the value. */
@Component({
  selector: 'pv-stat-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="row">
      <span class="label">{{ label() }}</span>
      <span class="value">{{ value() }}</span>
      <div class="track">
        <div class="fill" [style.width.%]="pct()" [style.background]="color()"></div>
      </div>
    </div>
  `,
  styles: [
    `
      .row {
        display: grid;
        grid-template-columns: 7.5rem 2.5rem 1fr;
        align-items: center;
        gap: 0.5rem;
        margin: 0.3rem 0;
      }
      .label {
        color: var(--text-dim);
        font-size: 0.8rem;
        text-transform: capitalize;
      }
      .value {
        font-variant-numeric: tabular-nums;
        font-weight: 700;
        text-align: right;
      }
      .track {
        height: 8px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.08);
        overflow: hidden;
      }
      .fill {
        height: 100%;
        border-radius: 999px;
        transition: width 0.7s cubic-bezier(0.22, 1, 0.36, 1);
      }
    `,
  ],
})
export class StatBarComponent {
  readonly label = input.required<string>();
  readonly value = input.required<number>();
  /** Max for the percentage scale (255 is the in-game cap for a base stat). */
  readonly max = input(180);

  pct = computed(() => Math.min(100, (this.value() / this.max()) * 100));
  color = computed(() => {
    const v = this.value();
    if (v >= 120) return 'linear-gradient(90deg,#56e39f,#6ce0ff)';
    if (v >= 90) return 'linear-gradient(90deg,#9be36b,#56e39f)';
    if (v >= 60) return 'linear-gradient(90deg,#ffd166,#9be36b)';
    if (v >= 40) return 'linear-gradient(90deg,#ff9d55,#ffd166)';
    return 'linear-gradient(90deg,#ff5d73,#ff9d55)';
  });
}
