/**
 * Nuzlocke challenge rules — pure state transitions over {@link NuzlockeState}.
 *
 * The classic three rules, adapted to the demo world:
 *  1. **One catch per route** — only the first wild encounter on each map may
 *     be caught; the chance is spent the moment that battle starts, win, lose,
 *     flee or catch.
 *  2. **Permadeath** — a party member that faints is buried in the memorial
 *     and leaves the party forever.
 *  3. **Whiteout ends the run** — with no survivors the save is erased
 *     (enforced by the service, not here).
 */
import type { FallenMon, NuzlockeState, PartyMon } from './rpg-types';

export function freshNuzlocke(): NuzlockeState {
  return { usedEncounters: [], fallen: [] };
}

/**
 * A wild battle is starting on `mapId`: report whether this battle may throw
 * balls (it is the map's first encounter) and mark the chance as spent.
 */
export function consumeEncounter(
  state: NuzlockeState,
  mapId: string,
): { state: NuzlockeState; catchAllowed: boolean } {
  if (state.usedEncounters.includes(mapId)) return { state, catchAllowed: false };
  return {
    state: { ...state, usedEncounters: [...state.usedEncounters, mapId] },
    catchAllowed: true,
  };
}

/**
 * Post-battle permadeath: split the written-back party into survivors and
 * the fallen, and append the fallen to the memorial.
 */
export function buryFainted(
  state: NuzlockeState,
  party: readonly PartyMon[],
): { state: NuzlockeState; survivors: PartyMon[]; lost: FallenMon[] } {
  const survivors: PartyMon[] = [];
  const lost: FallenMon[] = [];
  for (const mon of party) {
    if (mon.currentHp > 0) survivors.push(mon);
    else lost.push({ species: mon.species, nickname: mon.nickname, dexId: mon.dexId, level: mon.level });
  }
  if (!lost.length) return { state, survivors, lost };
  return { state: { ...state, fallen: [...state.fallen, ...lost] }, survivors, lost };
}
