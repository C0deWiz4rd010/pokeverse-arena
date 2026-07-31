/**
 * Battle backdrop selection — maps the overworld context (the map the encounter
 * fired on, the time of day and whether it was a fishing bite) onto a small set
 * of scene tokens the battle view styles into layered, biome-aware backgrounds.
 * Pure + unit-tested; the Angular battle component just binds the result.
 */
import type { MapDef } from './rpg-types';
import type { TimeBand } from './time';

/** Visual biome of a battle backdrop (drives the `.rb-field` gradient/scenery). */
export type BattleScene = 'meadow' | 'cave' | 'water' | 'sand' | 'snow' | 'indoor';

export interface SceneContext {
  readonly scene: BattleScene;
  /** True at night — the view layers a dusk/night wash over the scene. */
  readonly night: boolean;
}

/** Classify the current map + time into a battle scene token. */
export function battleScene(
  map: Pick<MapDef, 'outdoor' | 'weather' | 'encounter'> | null | undefined,
  band: TimeBand,
  fishing = false,
): SceneContext {
  const night = band === 'night';
  if (!map) return { scene: 'meadow', night };
  if (fishing) return { scene: 'water', night };
  if (!map.outdoor) return { scene: 'indoor', night: false };
  if (map.encounter?.everywhere) return { scene: 'cave', night: false };
  if (map.weather === 'sandstorm') return { scene: 'sand', night };
  if (map.weather === 'snow') return { scene: 'snow', night };
  return { scene: 'meadow', night };
}
