import { describe, expect, it } from 'vitest';
import type {
  AbilityDto,
  ChainLinkDto,
  EvolutionChainDto,
  MoveDto,
  PokemonDto,
  PokemonSpeciesDto,
} from '../dto/pokeapi.dto';
import {
  mapAbility,
  mapEvolutionChain,
  mapMoveInfo,
  mapPokemon,
  mapSpecies,
} from './pokemon.model';

const res = (name: string, id?: number) => ({
  name,
  url: `https://pokeapi.co/api/v2/x/${id ?? 0}/`,
});

function pokemonDto(over: Partial<PokemonDto> = {}): PokemonDto {
  return {
    id: 6,
    name: 'charizard',
    height: 17,
    weight: 905,
    base_experience: 267,
    order: 7,
    is_default: true,
    sprites: {
      front_default: null,
      front_shiny: null,
      back_default: null,
      back_shiny: null,
      other: {
        'official-artwork': { front_default: 'art.png', front_shiny: 'shiny.png' },
        showdown: {
          front_default: 'f.gif',
          back_default: 'b.gif',
          front_shiny: null,
          back_shiny: null,
        },
      },
    },
    types: [
      { slot: 2, type: res('flying') },
      { slot: 1, type: res('fire') },
    ],
    abilities: [
      { slot: 3, is_hidden: true, ability: res('solar-power') },
      { slot: 1, is_hidden: false, ability: res('blaze') },
    ],
    stats: [
      { base_stat: 78, effort: 0, stat: res('hp') },
      { base_stat: 84, effort: 0, stat: res('attack') },
      { base_stat: 78, effort: 0, stat: res('defense') },
      { base_stat: 109, effort: 3, stat: res('special-attack') },
      { base_stat: 85, effort: 0, stat: res('special-defense') },
      { base_stat: 100, effort: 0, stat: res('speed') },
    ],
    moves: [
      {
        move: res('slash'),
        version_group_details: [
          {
            level_learned_at: 1,
            move_learn_method: res('level-up'),
            version_group: res('red-blue'),
          },
          {
            level_learned_at: 36,
            move_learn_method: res('level-up'),
            version_group: res('sword-shield'),
          },
        ],
      },
      {
        move: res('ember'),
        version_group_details: [
          { level_learned_at: 7, move_learn_method: res('level-up'), version_group: res('x') },
        ],
      },
      { move: res('fly'), version_group_details: [] },
      {
        move: res('air-slash'),
        version_group_details: [
          { level_learned_at: 7, move_learn_method: res('level-up'), version_group: res('x') },
        ],
      },
    ],
    species: { name: 'charizard', url: 'https://pokeapi.co/api/v2/pokemon-species/6/' },
    cries: { latest: 'cry.ogg', legacy: null },
    ...over,
  };
}

function speciesDto(over: Partial<PokemonSpeciesDto> = {}): PokemonSpeciesDto {
  return {
    id: 6,
    name: 'charizard',
    order: 7,
    gender_rate: 1,
    capture_rate: 45,
    base_happiness: 50,
    is_baby: false,
    is_legendary: false,
    is_mythical: false,
    hatch_counter: 20,
    has_gender_differences: false,
    forms_switchable: false,
    growth_rate: null,
    egg_groups: [res('monster'), res('dragon')],
    color: res('red'),
    shape: res('upright'),
    habitat: res('mountain'),
    generation: res('generation-i'),
    evolves_from_species: null,
    evolution_chain: { url: 'https://pokeapi.co/api/v2/evolution-chain/2/' },
    flavor_text_entries: [
      { flavor_text: 'Old\ntext', language: res('en') },
      { flavor_text: 'Neuer\fText', language: res('de') },
      { flavor_text: 'Newest\nEnglish\ftext ', language: res('en') },
    ],
    genera: [
      { genus: 'Flame Pokémon', language: res('en') },
      { genus: 'Flammen-Pokémon', language: res('de') },
    ],
    names: [
      { name: 'Glurak', language: res('de') },
      { name: 'Charizard', language: res('en') },
    ],
    varieties: [
      { is_default: true, pokemon: res('charizard') },
      { is_default: false, pokemon: res('charizard-mega-x') },
    ],
    ...over,
  };
}

describe('mapPokemon', () => {
  it('maps units, sorts slots and totals the base stats', () => {
    const p = mapPokemon(pokemonDto());
    expect(p.heightM).toBe(1.7);
    expect(p.weightKg).toBe(90.5);
    expect(p.types).toEqual(['fire', 'flying']);
    expect(p.abilities).toEqual([
      { name: 'blaze', isHidden: false },
      { name: 'solar-power', isHidden: true },
    ]);
    expect(p.stats['special-attack']).toBe(109);
    expect(p.baseStatTotal).toBe(78 + 84 + 78 + 109 + 85 + 100);
    expect(p.speciesId).toBe(6);
    expect(p.cry).toBe('cry.ogg');
  });

  it('uses artwork and showdown sprites when present', () => {
    const p = mapPokemon(pokemonDto());
    expect(p.sprites).toEqual({
      default: 'art.png',
      shiny: 'shiny.png',
      animatedFront: 'f.gif',
      animatedBack: 'b.gif',
    });
  });

  it('falls back to CDN artwork, zero stats and null cry', () => {
    const p = mapPokemon(
      pokemonDto({
        sprites: { front_default: null, front_shiny: null, back_default: null, back_shiny: null },
        stats: [{ base_stat: 10, effort: 0, stat: res('hp') }],
        cries: undefined,
      }),
    );
    expect(p.sprites.default).toContain('/other/official-artwork/6.png');
    expect(p.sprites.shiny).toContain('/other/official-artwork/shiny/6.png');
    expect(p.sprites.animatedFront).toBeNull();
    expect(p.sprites.animatedBack).toBeNull();
    expect(p.stats.attack).toBe(0);
    expect(p.baseStatTotal).toBe(10);
    expect(p.cry).toBeNull();
  });

  it('sorts moves by level then name and picks the latest version detail', () => {
    const p = mapPokemon(pokemonDto());
    expect(p.moves.map((m) => [m.name, m.levelLearnedAt, m.method])).toEqual([
      ['fly', 0, 'unknown'],
      ['air-slash', 7, 'level-up'],
      ['ember', 7, 'level-up'],
      ['slash', 36, 'level-up'],
    ]);
  });
});

describe('mapSpecies', () => {
  it('maps English text, cleans whitespace and prefers the newest entry', () => {
    const s = mapSpecies(speciesDto());
    expect(s.genus).toBe('Flame Pokémon');
    expect(s.flavorText).toBe('Newest English text');
    expect(s.eggGroups).toEqual(['monster', 'dragon']);
    expect(s.evolutionChainId).toBe(2);
    expect(s.varieties).toEqual(['charizard', 'charizard-mega-x']);
    expect(s.shape).toBe('upright');
    expect(s.habitat).toBe('mountain');
    expect(s.generation).toBe('generation-i');
  });

  it('adds a German localisation when available', () => {
    expect(mapSpecies(speciesDto()).de).toEqual({
      name: 'Glurak',
      genus: 'Flammen-Pokémon',
      flavorText: 'Neuer Text',
    });
  });

  it('returns null German data and null shape/habitat when absent', () => {
    const s = mapSpecies(
      speciesDto({
        names: undefined,
        genera: [{ genus: 'Flame', language: res('en') }],
        flavor_text_entries: [{ flavor_text: 'x', language: res('en') }],
        shape: null,
        habitat: null,
      }),
    );
    expect(s.de).toBeNull();
    expect(s.shape).toBeNull();
    expect(s.habitat).toBeNull();
  });

  it('tolerates missing English entries', () => {
    const s = mapSpecies(speciesDto({ genera: [], flavor_text_entries: [] }));
    expect(s.genus).toBe('');
    expect(s.flavorText).toBe('');
  });
});

describe('mapEvolutionChain', () => {
  const link = (
    id: number,
    name: string,
    details: ChainLinkDto['evolution_details'],
    evolves_to: ChainLinkDto[] = [],
  ): ChainLinkDto => ({
    is_baby: false,
    species: { name, url: `https://pokeapi.co/api/v2/pokemon-species/${id}/` },
    evolution_details: details,
    evolves_to,
  });
  const detail = (over: Partial<ChainLinkDto['evolution_details'][number]> = {}) => ({
    min_level: null,
    trigger: res('level-up'),
    item: null,
    min_happiness: null,
    time_of_day: '',
    known_move: null,
    location: null,
    ...over,
  });

  it('builds a tree with level, item and trigger labels', () => {
    const dto: EvolutionChainDto = {
      id: 67,
      chain: link(
        133,
        'eevee',
        [],
        [
          link(134, 'vaporeon', [detail({ item: res('water-stone') })]),
          link(135, 'jolteon', [detail({ trigger: res('trade-me') })]),
          link(136, 'flareon', [detail({ min_level: 16 })], [link(137, 'x', [])]),
        ],
      ),
    };
    const root = mapEvolutionChain(dto);
    expect(root.id).toBe(133);
    expect(root.trigger).toBeNull();
    expect(root.artwork).toContain('/133.png');
    expect(root.children.map((c) => [c.name, c.trigger])).toEqual([
      ['vaporeon', 'water stone'],
      ['jolteon', 'trade me'],
      ['flareon', 'Lv. 16'],
    ]);
    expect(root.children[2]!.children[0]!.trigger).toBeNull();
  });
});

describe('mapAbility', () => {
  const dto = (entries: AbilityDto['effect_entries']): AbilityDto => ({
    id: 66,
    name: 'blaze',
    is_main_series: true,
    effect_entries: entries,
    flavor_text_entries: [],
  });

  it('picks the English effect', () => {
    const a = mapAbility(
      dto([
        { effect: 'de', short_effect: 'de-s', language: res('de') },
        { effect: 'Long', short_effect: 'Short', language: res('en') },
      ]),
    );
    expect(a).toEqual({ id: 66, name: 'blaze', effect: 'Long', shortEffect: 'Short' });
  });

  it('falls back to empty strings', () => {
    expect(mapAbility(dto([]))).toMatchObject({ effect: '', shortEffect: '' });
  });
});

describe('mapMoveInfo', () => {
  const moveDto = (over: Partial<MoveDto> = {}): MoveDto => ({
    id: 53,
    name: 'flamethrower',
    accuracy: 100,
    power: 90,
    pp: 15,
    priority: 0,
    type: res('fire'),
    damage_class: res('special'),
    effect_chance: 10,
    effect_entries: [
      {
        effect: 'long',
        short_effect: 'Has a $effect_chance% chance to burn.',
        language: res('en'),
      },
    ],
    flavor_text_entries: [],
    meta: {
      ailment: res('burn'),
      ailment_chance: 10,
      crit_rate: 0,
      drain: 0,
      flinch_chance: 0,
      healing: 0,
      max_hits: null,
      min_hits: null,
      stat_chance: 0,
    },
    ...over,
  });

  it('substitutes the effect chance and maps meta', () => {
    const m = mapMoveInfo(moveDto());
    expect(m.effect).toBe('Has a 10% chance to burn.');
    expect(m.ailment).toBe('burn');
    expect(m.ailmentChance).toBe(10);
    expect(m.damageClass).toBe('special');
    expect(m.type).toBe('fire');
  });

  it('defaults for status moves without meta or damage class', () => {
    const m = mapMoveInfo(
      moveDto({
        meta: null,
        damage_class: null,
        effect_chance: null,
        power: null,
        effect_entries: [
          { effect: 'Long only', short_effect: undefined as never, language: res('en') },
        ],
      }),
    );
    expect(m.damageClass).toBe('status');
    expect(m.ailment).toBeNull();
    expect(m.ailmentChance).toBe(0);
    expect(m.critRate).toBe(0);
    expect(m.minHits).toBeNull();
    expect(m.effect).toBe('Long only');
  });

  it('treats the "none" ailment as null and has empty effect without English text', () => {
    const base = moveDto();
    const m = mapMoveInfo(
      moveDto({
        effect_entries: [],
        meta: { ...base.meta!, ailment: res('none'), min_hits: 2, max_hits: 5 },
      }),
    );
    expect(m.ailment).toBeNull();
    expect(m.effect).toBe('');
    expect([m.minHits, m.maxHits]).toEqual([2, 5]);
  });
});
