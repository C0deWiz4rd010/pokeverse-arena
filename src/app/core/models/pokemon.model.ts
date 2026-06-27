import { idFromUrl, officialArtwork } from '../api/pokeapi-endpoints';
import type {
  AbilityDto,
  ChainLinkDto,
  EvolutionChainDto,
  MoveDto,
  PokemonDto,
  PokemonSpeciesDto,
} from '../dto/pokeapi.dto';
import type { PokemonType } from '../utils/type-chart';
import type { StatKey } from '../utils/stat-calculator';

/** Lightweight entry for the Pokedex grid (types/gen filled in by enrichment). */
export interface PokedexEntry {
  id: number;
  name: string;
  artwork: string;
  /** Filled in lazily by the one-time type-list enrichment ([] until then). */
  types: PokemonType[];
  /** Debut generation 1–9 (0 until enriched). */
  gen: number;
}

export interface PokemonStats {
  hp: number;
  attack: number;
  defense: number;
  'special-attack': number;
  'special-defense': number;
  speed: number;
}

export interface PokemonAbilityRef {
  name: string;
  isHidden: boolean;
}

export interface LearnableMove {
  name: string;
  levelLearnedAt: number;
  method: string;
}

/** Ergonomic Pokemon view-model used throughout the UI. */
export interface Pokemon {
  id: number;
  name: string;
  types: PokemonType[];
  heightM: number;
  weightKg: number;
  baseExperience: number | null;
  stats: PokemonStats;
  baseStatTotal: number;
  abilities: PokemonAbilityRef[];
  moves: LearnableMove[];
  sprites: {
    default: string;
    shiny: string;
    animatedFront: string | null;
    animatedBack: string | null;
  };
  cry: string | null;
  speciesId: number;
}

export interface SpeciesInfo {
  id: number;
  name: string;
  genus: string;
  flavorText: string;
  color: string;
  shape: string | null;
  habitat: string | null;
  generation: string;
  eggGroups: string[];
  captureRate: number;
  baseHappiness: number | null;
  genderRate: number;
  isBaby: boolean;
  isLegendary: boolean;
  isMythical: boolean;
  evolutionChainId: number;
  varieties: string[];
}

export interface EvolutionNode {
  id: number;
  name: string;
  artwork: string;
  trigger: string | null;
  children: EvolutionNode[];
}

export interface AbilityInfo {
  id: number;
  name: string;
  effect: string;
  shortEffect: string;
}

export interface MoveInfo {
  id: number;
  name: string;
  type: PokemonType;
  damageClass: 'physical' | 'special' | 'status';
  power: number | null;
  accuracy: number | null;
  pp: number | null;
  priority: number;
  effect: string;
  ailment: string | null;
  ailmentChance: number;
  critRate: number;
  minHits: number | null;
  maxHits: number | null;
}

/* ----------------------------------------------------------------- mappers */

const STAT_KEYS: StatKey[] = [
  'hp', 'attack', 'defense', 'special-attack', 'special-defense', 'speed',
];

function englishFlavor(entries: { flavor_text: string; language: { name: string } }[]): string {
  const en = entries.find((e) => e.language.name === 'en');
  return (en?.flavor_text ?? '').replace(/[\n\f\r]/g, ' ').trim();
}

function englishEffect(entries: { effect: string; short_effect: string; language: { name: string } }[]): {
  effect: string;
  shortEffect: string;
} {
  const en = entries.find((e) => e.language.name === 'en');
  return { effect: en?.effect ?? '', shortEffect: en?.short_effect ?? '' };
}

export function mapPokemon(dto: PokemonDto): Pokemon {
  const stats = STAT_KEYS.reduce((acc, key) => {
    acc[key] = dto.stats.find((s) => s.stat.name === key)?.base_stat ?? 0;
    return acc;
  }, {} as PokemonStats);

  const showdown = dto.sprites.other?.showdown;
  const artwork =
    dto.sprites.other?.['official-artwork']?.front_default ?? officialArtwork(dto.id);
  const shinyArt =
    dto.sprites.other?.['official-artwork']?.front_shiny ?? officialArtwork(dto.id, true);

  return {
    id: dto.id,
    name: dto.name,
    types: dto.types.sort((a, b) => a.slot - b.slot).map((t) => t.type.name as PokemonType),
    heightM: dto.height / 10,
    weightKg: dto.weight / 10,
    baseExperience: dto.base_experience,
    stats,
    baseStatTotal: STAT_KEYS.reduce((sum, key) => sum + stats[key], 0),
    abilities: dto.abilities
      .sort((a, b) => a.slot - b.slot)
      .map((a) => ({ name: a.ability.name, isHidden: a.is_hidden })),
    moves: mapMoves(dto),
    sprites: {
      default: artwork,
      shiny: shinyArt,
      animatedFront: showdown?.front_default ?? null,
      animatedBack: showdown?.back_default ?? null,
    },
    cry: dto.cries?.latest ?? null,
    speciesId: idFromUrl(dto.species.url),
  };
}

function mapMoves(dto: PokemonDto): LearnableMove[] {
  return dto.moves
    .map((m) => {
      const detail =
        m.version_group_details[m.version_group_details.length - 1] ??
        m.version_group_details[0];
      return {
        name: m.move.name,
        levelLearnedAt: detail?.level_learned_at ?? 0,
        method: detail?.move_learn_method.name ?? 'unknown',
      };
    })
    .sort((a, b) => a.levelLearnedAt - b.levelLearnedAt || a.name.localeCompare(b.name));
}

export function mapSpecies(dto: PokemonSpeciesDto): SpeciesInfo {
  return {
    id: dto.id,
    name: dto.name,
    genus: dto.genera.find((g) => g.language.name === 'en')?.genus ?? '',
    flavorText: englishFlavor(dto.flavor_text_entries),
    color: dto.color.name,
    shape: dto.shape?.name ?? null,
    habitat: dto.habitat?.name ?? null,
    generation: dto.generation.name,
    eggGroups: dto.egg_groups.map((g) => g.name),
    captureRate: dto.capture_rate,
    baseHappiness: dto.base_happiness,
    genderRate: dto.gender_rate,
    isBaby: dto.is_baby,
    isLegendary: dto.is_legendary,
    isMythical: dto.is_mythical,
    evolutionChainId: idFromUrl(dto.evolution_chain.url),
    varieties: dto.varieties.map((v) => v.pokemon.name),
  };
}

export function mapEvolutionChain(dto: EvolutionChainDto): EvolutionNode {
  const walk = (link: ChainLinkDto, trigger: string | null): EvolutionNode => {
    const id = idFromUrl(link.species.url);
    return {
      id,
      name: link.species.name,
      artwork: officialArtwork(id),
      trigger,
      children: link.evolves_to.map((child) => {
        const detail = child.evolution_details[0];
        const label = detail
          ? detail.min_level
            ? `Lv. ${detail.min_level}`
            : (detail.item?.name ?? detail.trigger.name).replace(/-/g, ' ')
          : null;
        return walk(child, label);
      }),
    };
  };
  return walk(dto.chain, null);
}

export function mapAbility(dto: AbilityDto): AbilityInfo {
  const { effect, shortEffect } = englishEffect(dto.effect_entries);
  return { id: dto.id, name: dto.name, effect, shortEffect };
}

export function mapMoveInfo(dto: MoveDto): MoveInfo {
  const en = dto.effect_entries.find((e) => e.language.name === 'en');
  const effect = (en?.short_effect ?? en?.effect ?? '').replace(
    /\$effect_chance/g,
    String(dto.effect_chance ?? 0),
  );
  return {
    id: dto.id,
    name: dto.name,
    type: dto.type.name as PokemonType,
    damageClass: (dto.damage_class?.name ?? 'status') as MoveInfo['damageClass'],
    power: dto.power,
    accuracy: dto.accuracy,
    pp: dto.pp,
    priority: dto.priority,
    effect,
    ailment: dto.meta?.ailment.name && dto.meta.ailment.name !== 'none' ? dto.meta.ailment.name : null,
    ailmentChance: dto.meta?.ailment_chance ?? 0,
    critRate: dto.meta?.crit_rate ?? 0,
    minHits: dto.meta?.min_hits ?? null,
    maxHits: dto.meta?.max_hits ?? null,
  };
}
