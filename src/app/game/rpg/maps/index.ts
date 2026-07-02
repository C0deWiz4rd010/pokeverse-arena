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
import { ROUTE_2 } from './route-2';
import { CAVE } from './cave';
import { STONEHOLLOW } from './stonehollow';
import { GYM2 } from './gym2';
import { ROUTE_3 } from './route-3';
import { SUNREACH } from './sunreach';
import { GYM3 } from './gym3';

export const MAPS: Record<string, MapDef> = {
  [PLAYER_HOME.id]: PLAYER_HOME,
  [HOME_TOWN.id]: HOME_TOWN,
  [CENTER.id]: CENTER,
  [MART.id]: MART,
  [LAB.id]: LAB,
  [ROUTE_1.id]: ROUTE_1,
  [GYM_TOWN.id]: GYM_TOWN,
  [GYM.id]: GYM,
  [ROUTE_2.id]: ROUTE_2,
  [CAVE.id]: CAVE,
  [STONEHOLLOW.id]: STONEHOLLOW,
  [GYM2.id]: GYM2,
  [ROUTE_3.id]: ROUTE_3,
  [SUNREACH.id]: SUNREACH,
  [GYM3.id]: GYM3,
};

export function getMap(id: string): MapDef | undefined {
  return MAPS[id];
}
