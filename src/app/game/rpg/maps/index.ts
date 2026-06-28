/** Map registry — id → MapDef. */
import type { MapDef } from '../rpg-types';
import { PLAYER_HOME } from './player-home';
import { HOME_TOWN } from './home-town';
import { CENTER } from './center';
import { MART } from './mart';
import { LAB } from './lab';
import { ROUTE_1 } from './route-1';
import { GYM_TOWN } from './gym-town';
import { GYM } from './gym';

export const MAPS: Record<string, MapDef> = {
  [PLAYER_HOME.id]: PLAYER_HOME,
  [HOME_TOWN.id]: HOME_TOWN,
  [CENTER.id]: CENTER,
  [MART.id]: MART,
  [LAB.id]: LAB,
  [ROUTE_1.id]: ROUTE_1,
  [GYM_TOWN.id]: GYM_TOWN,
  [GYM.id]: GYM,
};

export function getMap(id: string): MapDef | undefined {
  return MAPS[id];
}
