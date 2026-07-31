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

/** Precipitation drawn over the backdrop — carried in from the overworld weather. */
export type BattlePrecip = 'rain' | 'snow' | 'none';

export interface SceneContext {
  readonly scene: BattleScene;
  /** True at night — the view layers a dusk/night wash over the scene. */
  readonly night: boolean;
  /** Falling weather to animate over the fight (none underground/indoors). */
  readonly weather: BattlePrecip;
}

/** Pick just the biome token from the map + fishing context. */
function classify(
  map: Pick<MapDef, 'outdoor' | 'weather' | 'encounter'> | null | undefined,
  fishing: boolean,
): BattleScene {
  if (!map) return 'meadow';
  if (fishing) return 'water';
  if (!map.outdoor) return 'indoor';
  if (map.encounter?.everywhere) return 'cave';
  if (map.weather === 'sandstorm') return 'sand';
  if (map.weather === 'snow') return 'snow';
  return 'meadow';
}

/** Classify the current map + time into a battle scene token. */
export function battleScene(
  map: Pick<MapDef, 'outdoor' | 'weather' | 'encounter'> | null | undefined,
  band: TimeBand,
  fishing = false,
): SceneContext {
  const scene = classify(map, fishing);
  const covered = scene === 'indoor' || scene === 'cave'; // no sky ⇒ no weather/night
  const night = covered ? false : band === 'night';
  const weather: BattlePrecip =
    covered ? 'none' : map?.weather === 'rain' ? 'rain' : map?.weather === 'snow' ? 'snow' : 'none';
  return { scene, night, weather };
}
