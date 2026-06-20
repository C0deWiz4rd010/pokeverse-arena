import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { PokemonStats } from '../../core/models/pokemon.model';

interface RadarPoint {
  vx: number;
  vy: number;
  spokeX: number;
  spokeY: number;
  labelX: number;
  labelY: number;
  label: string;
  value: number;
}

const LABELS: { key: keyof PokemonStats; short: string }[] = [
  { key: 'hp', short: 'HP' },
  { key: 'attack', short: 'Atk' },
  { key: 'defense', short: 'Def' },
  { key: 'speed', short: 'Spe' },
  { key: 'special-defense', short: 'SpD' },
  { key: 'special-attack', short: 'SpA' },
];

/** Hexagonal base-stat radar chart drawn as inline SVG. */
@Component({
  selector: 'pv-stat-radar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg viewBox="0 0 220 220" role="img" aria-label="Base stat radar">
      @for (ring of rings; track ring) {
        <polygon class="grid" [attr.points]="gridPoints(ring)" />
      }
      @for (p of points(); track p.label) {
        <line class="spoke" x1="110" y1="110" [attr.x2]="p.spokeX" [attr.y2]="p.spokeY" />
      }
      <polygon class="area" [attr.points]="areaPoints()" />
      @for (p of points(); track p.label) {
        <circle class="dot" [attr.cx]="p.vx" [attr.cy]="p.vy" r="3" />
        <text class="lbl" [attr.x]="p.labelX" [attr.y]="p.labelY">{{ p.label }}</text>
        <text class="val" [attr.x]="p.labelX" [attr.y]="p.labelY + 12">{{ p.value }}</text>
      }
    </svg>
  `,
  styles: [
    `
      svg { width: 100%; max-width: 280px; height: auto; }
      .grid { fill: none; stroke: rgba(255, 255, 255, 0.08); }
      .spoke { stroke: rgba(255, 255, 255, 0.08); }
      .area {
        fill: rgba(108, 224, 255, 0.25);
        stroke: var(--accent);
        stroke-width: 2;
        transition: all 0.5s ease;
      }
      .dot { fill: var(--accent); }
      .lbl { fill: var(--text-dim); font-size: 10px; font-weight: 700; text-anchor: middle; }
      .val { fill: var(--text); font-size: 11px; font-weight: 800; text-anchor: middle; }
    `,
  ],
})
export class StatRadarComponent {
  readonly stats = input.required<PokemonStats>();
  /** Max stat value mapped to the outer ring. */
  readonly max = input(200);

  protected readonly rings = [0.25, 0.5, 0.75, 1];
  private readonly cx = 110;
  private readonly cy = 110;
  private readonly r = 80;

  readonly points = computed<RadarPoint[]>(() => {
    const s = this.stats();
    const max = this.max();
    return LABELS.map((entry, i) => {
      const angle = (Math.PI * 2 * i) / LABELS.length - Math.PI / 2;
      const ratio = Math.min(1, s[entry.key] / max);
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const labelR = this.r + 22;
      return {
        vx: this.cx + cos * this.r * ratio,
        vy: this.cy + sin * this.r * ratio,
        spokeX: this.cx + cos * this.r,
        spokeY: this.cy + sin * this.r,
        labelX: this.cx + cos * labelR,
        labelY: this.cy + sin * labelR,
        label: entry.short,
        value: s[entry.key],
      };
    });
  });

  protected gridPoints(scale: number): string {
    return LABELS.map((_, i) => {
      const angle = (Math.PI * 2 * i) / LABELS.length - Math.PI / 2;
      const x = this.cx + Math.cos(angle) * this.r * scale;
      const y = this.cy + Math.sin(angle) * this.r * scale;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
  }

  protected areaPoints(): string {
    return this.points().map((p) => `${p.vx.toFixed(1)},${p.vy.toFixed(1)}`).join(' ');
  }
}
