import { describe, expect, it } from 'vitest';
import {
  RADAR_CX,
  RADAR_CY,
  RADAR_MAX,
  RADAR_R,
  RADAR_STATS,
  radarPoint,
  shapePoints,
} from './radar-geometry';

describe('radar geometry', () => {
  it("puts HP at 12 o'clock and keeps six axes", () => {
    expect(RADAR_STATS).toHaveLength(6);
    const hp = radarPoint(0, 1);
    expect(hp.x).toBeCloseTo(RADAR_CX);
    expect(hp.y).toBeCloseTo(RADAR_CY - RADAR_R);
  });

  it('walks Atk/Def/SpA/SpD/Spe clockwise after HP (same order everywhere)', () => {
    expect(RADAR_STATS.map((s) => s.label)).toEqual(['HP', 'Atk', 'Def', 'SpA', 'SpD', 'Spe']);
  });

  it('draws a full block on the outer ring and caps overflow', () => {
    const full = {
      hp: RADAR_MAX,
      attack: RADAR_MAX,
      defense: RADAR_MAX,
      'special-attack': RADAR_MAX,
      'special-defense': RADAR_MAX,
      speed: RADAR_MAX,
    };
    const over = Object.fromEntries(
      Object.entries(full).map(([k, v]) => [k, v * 2]),
    ) as typeof full;
    expect(shapePoints(over)).toBe(shapePoints(full));
  });
});
