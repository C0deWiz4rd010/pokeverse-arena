import { describe, expect, it } from 'vitest';
import { buryFainted, consumeEncounter, freshNuzlocke } from './nuzlocke';
import type { PartyMon } from './rpg-types';

function mon(species: string, hp: number, level = 12): PartyMon {
  return {
    uid: species + '-1',
    species,
    dexId: 1,
    level,
    xp: 0,
    currentHp: hp,
    maxHp: 30,
    status: 'none',
  };
}

describe('consumeEncounter', () => {
  it('allows the catch on the first encounter of a map and spends it', () => {
    const first = consumeEncounter(freshNuzlocke(), 'route-1');
    expect(first.catchAllowed).toBe(true);
    expect(first.state.usedEncounters).toEqual(['route-1']);
  });

  it('blocks catches on later encounters of the same map', () => {
    const first = consumeEncounter(freshNuzlocke(), 'route-1');
    const second = consumeEncounter(first.state, 'route-1');
    expect(second.catchAllowed).toBe(false);
    expect(second.state.usedEncounters).toEqual(['route-1']);
  });

  it('tracks maps independently', () => {
    const first = consumeEncounter(freshNuzlocke(), 'route-1');
    const other = consumeEncounter(first.state, 'route-2');
    expect(other.catchAllowed).toBe(true);
    expect(other.state.usedEncounters).toEqual(['route-1', 'route-2']);
  });

  it('does not mutate the input state', () => {
    const state = freshNuzlocke();
    consumeEncounter(state, 'route-1');
    expect(state.usedEncounters).toEqual([]);
  });
});

describe('buryFainted', () => {
  it('keeps healthy members and buries the fainted', () => {
    const r = buryFainted(freshNuzlocke(), [mon('pikachu', 12), mon('rattata', 0)]);
    expect(r.survivors.map((m) => m.species)).toEqual(['pikachu']);
    expect(r.lost.map((m) => m.species)).toEqual(['rattata']);
    expect(r.state.fallen).toHaveLength(1);
    expect(r.state.fallen[0]).toMatchObject({ species: 'rattata', level: 12 });
  });

  it('accumulates the memorial across battles', () => {
    const a = buryFainted(freshNuzlocke(), [mon('rattata', 0)]);
    const b = buryFainted(a.state, [mon('pidgey', 0)]);
    expect(b.state.fallen.map((f) => f.species)).toEqual(['rattata', 'pidgey']);
  });

  it('returns the same state when nobody fainted', () => {
    const state = freshNuzlocke();
    const r = buryFainted(state, [mon('pikachu', 5)]);
    expect(r.state).toBe(state);
    expect(r.lost).toEqual([]);
  });

  it('can bury the entire party (whiteout case)', () => {
    const r = buryFainted(freshNuzlocke(), [mon('a', 0), mon('b', 0)]);
    expect(r.survivors).toEqual([]);
    expect(r.state.fallen).toHaveLength(2);
  });
});
