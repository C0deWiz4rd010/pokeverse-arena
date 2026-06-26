import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import {
  TERRAIN_INFO,
  WEATHER_INFO,
  type Terrain,
  type Weather,
} from '../../../game/engine';

interface Chip {
  readonly label: string;
  readonly turns: number;
  readonly kind: 'weather' | 'terrain';
}

/** A compact banner showing the active battle weather/terrain and turns left. */
@Component({
  selector: 'pv-field-banner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (chips().length) {
      <div class="field-banner" aria-live="polite">
        @for (c of chips(); track c.label) {
          <span class="chip" [class.weather]="c.kind === 'weather'" [class.terrain]="c.kind === 'terrain'">
            {{ c.label }}
            @if (c.turns > 0) { <small>{{ c.turns }}</small> }
          </span>
        }
      </div>
    }
  `,
  styles: [
    `
      .field-banner {
        display: flex;
        flex-wrap: wrap;
        gap: 0.4rem;
        justify-content: center;
      }
      .chip {
        display: inline-flex;
        align-items: center;
        gap: 0.3rem;
        padding: 0.18rem 0.6rem;
        border-radius: 999px;
        font-size: 0.72rem;
        font-weight: 700;
        color: #fff;
        backdrop-filter: blur(4px);
        border: 1px solid rgba(255, 255, 255, 0.18);
      }
      .chip.weather {
        background: rgba(80, 140, 220, 0.32);
      }
      .chip.terrain {
        background: rgba(120, 200, 120, 0.3);
      }
      .chip small {
        opacity: 0.75;
        font-weight: 600;
      }
    `,
  ],
})
export class FieldBannerComponent {
  readonly weather = input.required<Weather>();
  readonly terrain = input.required<Terrain>();
  readonly weatherTurns = input<number>(0);
  readonly terrainTurns = input<number>(0);

  protected readonly chips = computed<Chip[]>(() => {
    const out: Chip[] = [];
    const w = this.weather();
    if (w !== 'none') out.push({ label: WEATHER_INFO[w].label, turns: this.weatherTurns(), kind: 'weather' });
    const t = this.terrain();
    if (t !== 'none') out.push({ label: TERRAIN_INFO[t].label, turns: this.terrainTurns(), kind: 'terrain' });
    return out;
  });
}
