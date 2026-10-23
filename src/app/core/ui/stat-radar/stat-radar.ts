import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { PokemonStats } from '../../models/pokemon.model';
import { TranslatePipe } from '../../i18n/translate.pipe';
import {
  RADAR_MAX,
  RADAR_RINGS,
  RADAR_STATS,
  labelPoint,
  radarPoint,
  shapePoints,
} from './radar-geometry';

interface RadarAxis {
  readonly label: string;
  readonly value: number;
  readonly tip: { x: number; y: number };
  readonly dot: { x: number; y: number };
  readonly text: { x: number; y: number };
}

/** Hexagonal base-stat radar drawn as inline SVG, built on the shared radar geometry. */
@Component({
  selector: 'pv-stat-radar',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg viewBox="0 0 180 186" role="img" [attr.aria-label]="'Base stat radar' | t">
      @for (ring of rings; track $index) {
        <polygon class="grid" [attr.points]="ring" />
      }
      @for (a of axes(); track a.label) {
        <line class="spoke" x1="90" y1="86" [attr.x2]="a.tip.x" [attr.y2]="a.tip.y" />
      }
      <polygon class="area" [attr.points]="area()" />
      @for (a of axes(); track a.label) {
        <circle class="dot" [attr.cx]="a.dot.x" [attr.cy]="a.dot.y" r="2.6" />
        <text class="lbl" [attr.x]="a.text.x" [attr.y]="a.text.y">{{ a.label }}</text>
        <text class="val" [attr.x]="a.text.x" [attr.y]="a.text.y + 10">{{ a.value }}</text>
      }
    </svg>
  `,
  styles: [
    `
      svg {
        width: 100%;
        max-width: 280px;
        height: auto;
      }
      .grid {
        fill: none;
        stroke: rgba(255, 255, 255, 0.08);
      }
      .spoke {
        stroke: rgba(255, 255, 255, 0.08);
      }
      .area {
        fill: rgba(108, 224, 255, 0.25);
        stroke: var(--accent);
        stroke-width: 2;
        transition: all 0.5s ease;
      }
      .dot {
        fill: var(--accent);
      }
      .lbl {
        fill: var(--text-dim);
        font-size: 9px;
        font-weight: 700;
        text-anchor: middle;
      }
      .val {
        fill: var(--text);
        font-size: 10px;
        font-weight: 800;
        text-anchor: middle;
      }
    `,
  ],
})
export class StatRadarComponent {
  readonly stats = input.required<PokemonStats>();
  /** Max stat value mapped to the outer ring. */
  readonly max = input(RADAR_MAX);

  protected readonly rings = RADAR_RINGS;

  protected readonly axes = computed<RadarAxis[]>(() => {
    const s = this.stats();
    const max = this.max();
    return RADAR_STATS.map((r, i) => ({
      label: r.label,
      value: s[r.key],
      tip: radarPoint(i, 1),
      dot: radarPoint(i, Math.min(1, s[r.key] / max)),
      text: labelPoint(i),
    }));
  });

  protected readonly area = computed(() => shapePoints(this.stats()));
}
