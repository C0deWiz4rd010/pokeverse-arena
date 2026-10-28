import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PokeApiClient } from '../api/pokeapi.client';
import { officialArtwork } from '../api/pokeapi-endpoints';
import type { MoveDto, PokemonDto } from '../dto/pokeapi.dto';
import { quickStats } from '../utils/stat-calculator';
import { BattlerFactory, baseStatsOf } from './battler-factory';

const named = (name: string) => ({ name, url: '' });

function moveDto(
  name: string,
  power: number | null,
  over: Partial<MoveDto> = {},
  cls: 'physical' | 'special' | 'status' = 'physical',
): MoveDto {
  return {
    id: 1,
    name,
    accuracy: 100,
    power,
    pp: 10,
    priority: 0,
    type: named('normal'),
    damage_class: named(cls),
    effect_chance: null,
    effect_entries: [],
    flavor_text_entries: [],
    meta: null,
    ...over,
  };
}

const levelUp = (level: number) => ({
  level_learned_at: level,
  move_learn_method: named('level-up'),
  version_group: named('x'),
});
const machine = {
  level_learned_at: 0,
  move_learn_method: named('machine'),
  version_group: named('x'),
};

interface DtoOver {
  id?: number;
  name?: string;
  types?: string[];
  abilities?: { name: string; hidden?: boolean; slot: number }[];
  moves?: PokemonDto['moves'];
  sprites?: PokemonDto['sprites'];
}

function pokemonDto(o: DtoOver = {}): PokemonDto {
  const stats = ['hp', 'attack', 'defense', 'special-attack', 'special-defense', 'speed'];
  return {
    id: o.id ?? 25,
    name: o.name ?? 'pikachu',
    height: 4,
    weight: 60,
    base_experience: 112,
    order: 1,
    is_default: true,
    sprites: o.sprites ?? {
      front_default: null,
      front_shiny: null,
      back_default: null,
      back_shiny: null,
    },
    types: (o.types ?? ['electric']).map((t, i) => ({ slot: i + 1, type: named(t) })),
    abilities: (o.abilities ?? []).map((a) => ({
      ability: named(a.name),
      is_hidden: a.hidden ?? false,
      slot: a.slot,
    })),
    stats: stats.map((s, i) => ({ base_stat: 40 + i * 10, effort: 0, stat: named(s) })),
    moves: o.moves ?? [],
    species: named(o.name ?? 'pikachu'),
  };
}

describe('BattlerFactory', () => {
  let factory: BattlerFactory;
  let api: { pokemon: ReturnType<typeof vi.fn>; move: ReturnType<typeof vi.fn> };
  let moves: Record<string, MoveDto>;

  beforeEach(() => {
    moves = {};
    api = {
      pokemon: vi.fn(),
      move: vi.fn((n: string) =>
        moves[n] ? Promise.resolve(moves[n]) : Promise.reject(new Error(n)),
      ),
    };
    TestBed.configureTestingModule({ providers: [{ provide: PokeApiClient, useValue: api }] });
    factory = TestBed.inject(BattlerFactory);
  });
  afterEach(() => vi.restoreAllMocks());

  /** Register move DTOs and return the matching `moves` entries for a Pokémon. */
  const learn = (defs: [MoveDto, number][]): PokemonDto['moves'] => {
    for (const [m] of defs) moves[m.name] = m;
    return defs.map(([m, lvl]) => ({ move: named(m.name), version_group_details: [levelUp(lvl)] }));
  };

  describe('baseStatsOf / totalBaseStats', () => {
    it('keys the base stats by stat name', () => {
      expect(baseStatsOf(pokemonDto())).toEqual({
        hp: 40,
        attack: 50,
        defense: 60,
        'special-attack': 70,
        'special-defense': 80,
        speed: 90,
      });
    });

    it('sums the base-stat total', () => {
      expect(factory.totalBaseStats(pokemonDto())).toBe(390);
    });
  });

  describe('randomId', () => {
    it('stays inside the dex', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0);
      expect(factory.randomId()).toBe(1);
      vi.spyOn(Math, 'random').mockReturnValue(0.99999);
      expect(factory.randomId()).toBe(1025);
    });

    it('never returns the excluded id', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.99999);
      expect(factory.randomId(1025)).toBe(1);
      vi.spyOn(Math, 'random').mockReturnValue(0);
      expect(factory.randomId(1)).toBe(2);
    });
  });

  describe('battleSprite', () => {
    const sprites = (art: string | null, sdFront: string | null, sdBack: string | null) =>
      ({
        front_default: null,
        front_shiny: null,
        back_default: null,
        back_shiny: null,
        other: {
          'official-artwork': { front_default: art, front_shiny: null },
          showdown: {
            front_default: sdFront,
            back_default: sdBack,
            front_shiny: null,
            back_shiny: null,
          },
        },
      }) as PokemonDto['sprites'];

    it('prefers the official artwork', () => {
      const dto = pokemonDto({ sprites: sprites('art.png', 'f.gif', 'b.gif') });
      expect(factory.battleSprite(dto, 'front')).toBe('art.png');
      expect(factory.battleSprite(dto, 'back')).toBe('art.png');
    });

    it('falls back to the facing-specific showdown sprite', () => {
      const dto = pokemonDto({ sprites: sprites(null, 'f.gif', 'b.gif') });
      expect(factory.battleSprite(dto, 'front')).toBe('f.gif');
      expect(factory.battleSprite(dto, 'back')).toBe('b.gif');
    });

    it('finally falls back to the artwork CDN by id', () => {
      const dto = pokemonDto({ id: 6, sprites: sprites(null, null, null) });
      expect(factory.battleSprite(dto, 'front')).toBe(officialArtwork(6));
      expect(factory.battleSprite(pokemonDto({ id: 7 }), 'back')).toBe(officialArtwork(7));
    });
  });

  describe('buildBattlerFromDto', () => {
    it('computes level-scaled stats and carries identity over', async () => {
      const dto = pokemonDto({ moves: learn([[moveDto('tackle', 40), 1]]) });
      const b = await factory.buildBattlerFromDto(dto, 30);
      expect(b).toMatchObject({ id: 25, name: 'pikachu', level: 30, types: ['electric'] });
      expect(b.stats).toEqual(quickStats(baseStatsOf(dto), 30));
      expect(b.sprite).toBe(officialArtwork(25));
    });

    it('defaults to level 50', async () => {
      const b = await factory.buildBattlerFromDto(pokemonDto());
      expect(b.level).toBe(50);
    });

    it('orders types by slot and drops unknown ones', async () => {
      const dto = pokemonDto({ types: ['shadow', 'water', 'flying'] });
      dto.types = [
        { slot: 2, type: named('flying') },
        { slot: 1, type: named('water') },
        { slot: 3, type: named('shadow') },
      ];
      expect((await factory.buildBattlerFromDto(dto)).types).toEqual(['water', 'flying']);
    });

    it('falls back to normal when no type is recognised', async () => {
      const b = await factory.buildBattlerFromDto(pokemonDto({ types: ['shadow'] }));
      expect(b.types).toEqual(['normal']);
    });

    it('picks the first modelled non-hidden ability', async () => {
      const dto = pokemonDto({
        abilities: [
          { name: 'levitate', hidden: true, slot: 3 },
          { name: 'unmodelled-ability', slot: 1 },
          { name: 'intimidate', slot: 2 },
        ],
      });
      expect((await factory.buildBattlerFromDto(dto)).ability).toBe('intimidate');
    });

    it('uses a modelled hidden ability when nothing else qualifies', async () => {
      const dto = pokemonDto({
        abilities: [
          { name: 'unmodelled-ability', slot: 1 },
          { name: 'levitate', hidden: true, slot: 3 },
        ],
      });
      expect((await factory.buildBattlerFromDto(dto)).ability).toBe('levitate');
    });

    it('leaves the ability undefined when none is modelled', async () => {
      const dto = pokemonDto({ abilities: [{ name: 'unmodelled-ability', slot: 1 }] });
      expect((await factory.buildBattlerFromDto(dto)).ability).toBeUndefined();
    });
  });

  describe('buildBattler', () => {
    it('fetches by lower-cased name or id', async () => {
      api.pokemon.mockResolvedValue(pokemonDto());
      const b = await factory.buildBattler('Pikachu', 40);
      expect(api.pokemon).toHaveBeenCalledWith('pikachu');
      expect(b.level).toBe(40);
      await factory.buildBattler(25);
      expect(api.pokemon).toHaveBeenLastCalledWith('25');
    });
  });

  describe('move selection (strongest mode)', () => {
    it('takes the four strongest damaging level-up moves, strongest first', async () => {
      const entries = learn([
        [moveDto('a', 40), 1],
        [moveDto('b', 90), 5],
        [moveDto('c', 60), 9],
        [moveDto('d', 120), 13],
        [moveDto('e', 80), 17],
      ]);
      const b = await factory.buildBattlerFromDto(pokemonDto({ moves: entries }));
      expect(b.moves.map((m) => m.name)).toEqual(['d', 'b', 'e', 'c']);
    });

    it('ignores moves that are not learned by level-up', async () => {
      moves['tm-move'] = moveDto('tm-move', 150);
      const entries = [
        ...learn([[moveDto('lvl', 40), 1]]),
        { move: named('tm-move'), version_group_details: [machine] },
      ];
      const b = await factory.buildBattlerFromDto(pokemonDto({ moves: entries }));
      expect(b.moves.map((m) => m.name)).toEqual(['lvl']);
      expect(api.move).not.toHaveBeenCalledWith('tm-move');
    });

    it('keeps one useful status move in the last slot', async () => {
      const dance = moveDto(
        'swords-dance',
        null,
        { stat_changes: [{ change: 2, stat: named('attack') }], target: named('user') },
        'status',
      );
      const entries = learn([
        [moveDto('a', 40), 1],
        [moveDto('b', 90), 5],
        [moveDto('c', 60), 9],
        [moveDto('d', 120), 13],
        [dance, 20],
      ]);
      const b = await factory.buildBattlerFromDto(pokemonDto({ moves: entries }));
      expect(b.moves.map((m) => m.name)).toEqual(['d', 'b', 'c', 'swords-dance']);
    });

    it('does not squeeze a status move in beside a single damaging move', async () => {
      const dance = moveDto(
        'swords-dance',
        null,
        { stat_changes: [{ change: 2, stat: named('attack') }], target: named('user') },
        'status',
      );
      const entries = learn([
        [moveDto('a', 40), 1],
        [dance, 5],
      ]);
      const b = await factory.buildBattlerFromDto(pokemonDto({ moves: entries }));
      expect(b.moves.map((m) => m.name)).toEqual(['a']);
    });

    it('falls back to useful status moves when nothing damages', async () => {
      const dance = moveDto(
        'swords-dance',
        null,
        { stat_changes: [{ change: 2, stat: named('attack') }], target: named('user') },
        'status',
      );
      const growl = moveDto('growl', null, {}, 'status'); // no modelled effect
      const b = await factory.buildBattlerFromDto(
        pokemonDto({
          moves: learn([
            [growl, 1],
            [dance, 5],
          ]),
        }),
      );
      expect(b.moves.map((m) => m.name)).toEqual(['swords-dance']);
    });

    it('skips moves whose lookup fails', async () => {
      const entries = learn([[moveDto('ok', 50), 1]]);
      entries.push({ move: named('missing'), version_group_details: [levelUp(3)] });
      const b = await factory.buildBattlerFromDto(pokemonDto({ moves: entries }));
      expect(b.moves.map((m) => m.name)).toEqual(['ok']);
    });

    it('gives Struggle to a Pokémon with nothing usable', async () => {
      const b = await factory.buildBattlerFromDto(pokemonDto());
      expect(b.moves).toEqual([
        { name: 'struggle', type: 'normal', power: 50, accuracy: 0, damageClass: 'physical' },
      ]);
    });

    it('only considers the first fourteen candidates', async () => {
      const defs: [MoveDto, number][] = Array.from({ length: 16 }, (_, i) => [
        moveDto(`m${i}`, 20 + i),
        i + 1,
      ]);
      await factory.buildBattlerFromDto(pokemonDto({ moves: learn(defs) }));
      expect(api.move).toHaveBeenCalledTimes(14);
    });
  });

  describe('move selection (level mode)', () => {
    it('uses moves known at the level, most recently learned first', async () => {
      const entries = learn([
        [moveDto('early', 40), 1],
        [moveDto('mid', 120), 10],
        [moveDto('late', 60), 30],
        [moveDto('future', 150), 60],
      ]);
      const b = await factory.buildBattlerFromDto(pokemonDto({ moves: entries }), 20, {
        levelMoves: true,
      });
      expect(b.moves.map((m) => m.name)).toEqual(['mid', 'early']);
      expect(api.move).not.toHaveBeenCalledWith('future');
      expect(api.move).not.toHaveBeenCalledWith('late');
    });

    it('uses the earliest level a move is learned across versions and skips non-level methods', async () => {
      moves['dual'] = moveDto('dual', 70);
      moves['egg'] = moveDto('egg', 70);
      moves['other'] = moveDto('other', 70);
      const entries: PokemonDto['moves'] = [
        { move: named('dual'), version_group_details: [levelUp(25), levelUp(5)] },
        { move: named('egg'), version_group_details: [machine] },
        { move: named('other'), version_group_details: [levelUp(15)] },
      ];
      const built = await factory.buildBattlerFromDto(pokemonDto({ moves: entries }), 20, {
        levelMoves: true,
      });
      // dual learned at 5 (earliest), other at 15 -> other is more recent
      expect(built.moves.map((m) => m.name)).toEqual(['other', 'dual']);
    });

    it('buildBattler forwards the level-moves option', async () => {
      const entries = learn([
        [moveDto('low', 40), 1],
        [moveDto('high', 90), 40],
      ]);
      api.pokemon.mockResolvedValue(pokemonDto({ moves: entries }));
      const b = await factory.buildBattler(25, 10, { levelMoves: true });
      expect(b.moves.map((m) => m.name)).toEqual(['low']);
    });
  });
});
