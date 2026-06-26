import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { STATUS_INFO, type StatusCondition } from '../../../game/engine';

/** A small coloured tag for a Pokémon's non-volatile status (BRN, PAR, …). */
@Component({
  selector: 'pv-status-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (info(); as i) {
      <span class="status" [style.--c]="i.color" [title]="i.label">{{ i.tag }}</span>
    }
  `,
  styles: [
    `
      .status {
        display: inline-flex;
        align-items: center;
        padding: 0.1rem 0.42rem;
        border-radius: 6px;
        font-size: 0.66rem;
        font-weight: 800;
        letter-spacing: 0.06em;
        color: #fff;
        background: color-mix(in srgb, var(--c) 80%, #000 10%);
        border: 1px solid color-mix(in srgb, var(--c) 60%, transparent);
        text-shadow: 0 1px 1px rgba(0, 0, 0, 0.45);
      }
    `,
  ],
})
export class StatusBadgeComponent {
  readonly status = input.required<StatusCondition>();
  protected readonly info = computed(() => {
    const s = this.status();
    return s === 'none' ? null : STATUS_INFO[s];
  });
}
