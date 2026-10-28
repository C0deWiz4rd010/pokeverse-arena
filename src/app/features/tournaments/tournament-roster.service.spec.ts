import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { PokeApiClient } from '../../core/api/pokeapi.client';
import { BattlerFactory } from '../../core/battle/battler-factory';
import type { PokemonDto, TypeDto } from '../../core/dto/pokeapi.dto';
import type { Battler } from '../../game/engine';
import { modeById } from '../../game/tournament';
import { TournamentRoster } from './tournament-roster.service';

/** A minimal PokéAPI Pokémon whose base-stat total is exactly `bst`. */
function dto(id: number, bst = 300, types = ['fire']): PokemonDto {
  const each = Math.round(bst / 6);
  const names = ['hp', 'attack', 'defense', 'special-attack', 'special-defense', 'speed'];
  return {
    id,
    name: `mon-${id}`,
    types: types.map((name, i) => ({ slot: i + 1, type: { name, url: '' } })),
    stats: names.map((name) => ({ base_stat: each, effort: 0, stat: { name, url: '' } })),
    sprites: {},
  } as unknown as PokemonDto;
}

const battler = (d: PokemonDto, level: number): Battler => ({
  id: d.id,
  name: d.name,
  level,
  types: ['normal'],
  stats: { hp: 1, attack: 1, defense: 1, 'special-attack': 1, 'special-defense': 1, speed: 1 },
  moves: [],
});

describe('TournamentRoster', () => {
  let pokemon: Mock<(id: number) => Promise<PokemonDto>>;
  let type: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
    // Strength is derived from the id so sorting is predictable.
    pokemon = vi.fn((id: number) => Promise.resolve(dto(id, 100 + (id % 500))));
    type = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        { provide: PokeApiClient, useValue: { pokemon, type } },
        {
          provide: BattlerFactory,
          useValue: {
            totalBaseStats: (d: PokemonDto) => d.stats.reduce((s, x) => s + x.base_stat, 0),
            buildBattlerFromDto: (d: PokemonDto, level: number) =>
              Promise.resolve(battler(d, level)),
            battleSprite: () => 'sprite.png',
          },
        },
      ],
    });
  });

  const roster = () => TestBed.inject(TournamentRoster);

  it('selects exactly `count` DTOs', async () => {
    const dtos = await roster().selectDtos(modeById('classic'), 12, null);
    expect(dtos).toHaveLength(12);
  });

  it('tops the pool up when some fetches fail', async () => {
    let calls = 0;
    pokemon.mockImplementation((id: number) =>
      ++calls % 2 === 0 ? Promise.reject(new Error('404')) : Promise.resolve(dto(id)),
    );
    const dtos = await roster().selectDtos(modeById('classic'), 10, null);
    expect(dtos).toHaveLength(10);
  });

  it('sorts weakest-first for the little pool and strongest-first for legendary', async () => {
    const little = await roster().selectDtos(modeById('little'), 6, null);
    const bstLittle = little.map((d) => d.stats.reduce((s, x) => s + x.base_stat, 0));
    expect(bstLittle).toEqual([...bstLittle].sort((a, b) => a - b));

    const legendary = await roster().selectDtos(modeById('legendary'), 6, null);
    const bstLegend = legendary.map((d) => d.stats.reduce((s, x) => s + x.base_stat, 0));
    expect(bstLegend).toEqual([...bstLegend].sort((a, b) => b - a));
  });

  it('samples a mono-type pool from the type endpoint, ignoring forms beyond the dex', async () => {
    const typeDto = {
      pokemon: [
        { slot: 1, pokemon: { name: 'a', url: 'https://x/api/v2/pokemon/4/' } },
        { slot: 1, pokemon: { name: 'form', url: 'https://x/api/v2/pokemon/10001/' } },
        { slot: 1, pokemon: { name: 'bad', url: 'https://x/api/v2/species/5/' } },
      ],
    } as unknown as TypeDto;
    type.mockResolvedValue(typeDto);
    const dtos = await roster().selectDtos(modeById('monotype'), 5, 'fire');
    expect(type).toHaveBeenCalledWith('fire');
    expect(dtos).toHaveLength(5);
    expect(new Set(pokemon.mock.calls.map((c) => c[0] as number))).toEqual(new Set([4]));
  });

  it('falls back to random ids when the type has no usable members', async () => {
    type.mockResolvedValue({ pokemon: [] } as unknown as TypeDto);
    const dtos = await roster().selectDtos(modeById('monotype'), 4, 'water');
    expect(dtos).toHaveLength(4);
  });

  it('snake-distributes DTOs so total strength stays balanced', () => {
    const dtos = [900, 800, 700, 600, 500, 400].map((bst, i) => dto(i + 1, bst));
    const teams = roster().distribute(dtos, 2, 3, true);
    expect(teams.map((t) => t.map((d) => d.id))).toEqual([
      [1, 4, 5],
      [2, 3, 6],
    ]);
  });

  it('distributes shuffled DTOs without losing or duplicating any', () => {
    const dtos = Array.from({ length: 12 }, (_, i) => dto(i + 1));
    const teams = roster().distribute(dtos, 4, 3, false);
    expect(teams).toHaveLength(4);
    expect(teams.every((t) => t.length === 3)).toBe(true);
    expect(new Set(teams.flat().map((d) => d.id)).size).toBe(12);
  });

  it('leaves later slots empty when there are too few DTOs', () => {
    const teams = roster().distribute([dto(1), dto(2)], 3, 1, false);
    expect(teams.map((t) => t.length).sort()).toEqual([0, 1, 1]);
  });

  it('builds the draft pool as fully built battlers at the mode level', async () => {
    const pool = await roster().draftPool(modeById('draft'), 9, null);
    expect(pool).toHaveLength(9);
    expect(pool.every((b) => b.level === modeById('draft').baseLevel)).toBe(true);
  });

  it('builds trainers: full battlers for the player, light synthetic ones for the CPU', async () => {
    const mode = modeById('classic');
    const teams = [[dto(1), dto(2)], [dto(3, 300, ['water', 'bogus'])], [dto(4, 300, [])]];
    const trainers = await roster().buildTrainers(teams, mode, 0);
    expect(trainers.map((t) => t.isPlayer ?? false)).toEqual([true, false, false]);
    expect(trainers[0]!.team[0]!.moves).toEqual([]); // from the factory stub

    const water = trainers[1]!.team[0]!;
    expect(water.types).toEqual(['water']); // unknown types are dropped
    expect(water.level).toBe(mode.baseLevel);
    expect(water.moves.length).toBeGreaterThan(0);
    expect(water.sprite).toBe('sprite.png');

    expect(trainers[2]!.team[0]!.types).toEqual(['normal']); // fallback typing
  });

  it('numbers CPU trainers from 1 when the player was drafted', () => {
    const cpu = roster().buildCpuTrainers([[dto(1)], [dto(2)]], modeById('draft'));
    expect(cpu.map((t) => t.id)).toEqual(['cpu-1', 'cpu-2']);
    expect(cpu.every((t) => !t.isPlayer)).toBe(true);
  });
});
