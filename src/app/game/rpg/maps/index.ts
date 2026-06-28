/** Map registry — id → MapDef. */
import type { MapDef } from '../rpg-types';
import { PLAYER_HOME } from './player-home';
import { HOME_TOWN } from './home-town';
import { CENTER } from './center';
import { MART } from './mart';

export const MAPS: Record<string, MapDef> = {
  [PLAYER_HOME.id]: PLAYER_HOME,
  [HOME_TOWN.id]: HOME_TOWN,
  [CENTER.id]: CENTER,
  [MART.id]: MART,
};

export function getMap(id: string): MapDef | undefined {
  return MAPS[id];
}
