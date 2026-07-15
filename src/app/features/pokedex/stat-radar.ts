/**
 * Shared stat-radar geometry: a hexagon with HP at 12 o'clock, walked
 * clockwise through Atk/Def/SpA/SpD/Spe. One pure point function feeds the
 * grid rings, the axes, the labels and every stat polygon, so shapes can
 * never drift from their axes. Used by the quickview back face and the
 * compare overlay.
 */
import type { StatKey } from '../../core/utils/stat-calculator';

export const RADAR_STATS: readonly { key: StatKey; label: string }[] = [
  { key: 'hp', label: 'HP' },
  { key: 'attack', label: 'Atk' },
  { key: 'defense', label: 'Def' },
  { key: 'special-attack', label: 'SpA' },
  { key: 'special-defense', label: 'SpD' },
  { key: 'speed', label: 'Spe' },
];

export const RADAR_CX = 90;
export const RADAR_CY = 86;
export const RADAR_R = 64;
/** Stat value that reaches the outer ring (Blissey HP aside, few exceed it). */
export const RADAR_MAX = 180;
/** viewBox that fits the hexagon plus its outboard labels. */
export const RADAR_VIEWBOX = '0 0 180 176';

export function radarPoint(i: number, frac: number): { x: number; y: number } {
  const a = -Math.PI / 2 + (i * Math.PI) / 3;
  return { x: RADAR_CX + Math.cos(a) * RADAR_R * frac, y: RADAR_CY + Math.sin(a) * RADAR_R * frac };
}

export function ringPoints(frac: number): string {
  return RADAR_STATS.map((_, i) => {
    const p = radarPoint(i, frac);
    return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
  }).join(' ');
}

/** The four grid rings at 25/50/75/100 %. */
export const RADAR_RINGS: readonly string[] = [0.25, 0.5, 0.75, 1].map(ringPoints);

/** Polygon points for a full stat block (values capped at {@link RADAR_MAX}). */
export function shapePoints(stats: Record<StatKey, number>): string {
  return RADAR_STATS.map((r, i) => {
    const p = radarPoint(i, Math.min(1, stats[r.key] / RADAR_MAX));
    return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
  }).join(' ');
}

/** Label anchor just outside an axis tip. */
export function labelPoint(i: number): { x: number; y: number } {
  const p = radarPoint(i, 1.22);
  return { x: p.x, y: p.y + 3 };
}
