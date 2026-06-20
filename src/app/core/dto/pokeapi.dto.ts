/**
 * Raw PokeAPI REST v2 response shapes (DTOs).
 *
 * These mirror the API exactly and must NOT leak into the UI layer directly.
 * Mappers in `core/models` convert them into ergonomic view-models.
 * Treat every optional field as possibly-absent (PokeAPI is inconsistent).
 */

export interface NamedApiResource {
  name: string;
  url: string;
}

export interface ApiResource {
  url: string;
}

export interface NamedApiResourceList {
  count: number;
  next: string | null;
  previous: string | null;
  results: NamedApiResource[];
}

export interface VerboseEffect {
  effect: string;
  short_effect: string;
  language: NamedApiResource;
}

export interface FlavorText {
  flavor_text: string;
  language: NamedApiResource;
  version?: NamedApiResource;
}

export interface Name {
  name: string;
  language: NamedApiResource;
}

/* ---------------------------------------------------------------- Pokemon */

export interface PokemonSpriteSet {
  front_default: string | null;
  front_shiny: string | null;
  back_default: string | null;
  back_shiny: string | null;
  other?: {
    'official-artwork'?: { front_default: string | null; front_shiny: string | null };
    home?: { front_default: string | null; front_shiny: string | null };
    showdown?: {
      front_default: string | null;
      back_default: string | null;
      front_shiny: string | null;
      back_shiny: string | null;
    };
  };
}

export interface PokemonTypeSlot {
  slot: number;
  type: NamedApiResource;
}

export interface PokemonAbilitySlot {
  ability: NamedApiResource;
  is_hidden: boolean;
  slot: number;
}

export interface PokemonStatEntry {
  base_stat: number;
  effort: number;
  stat: NamedApiResource;
}

export interface PokemonMoveVersionDetail {
  level_learned_at: number;
  move_learn_method: NamedApiResource;
  version_group: NamedApiResource;
}

export interface PokemonMoveEntry {
  move: NamedApiResource;
  version_group_details: PokemonMoveVersionDetail[];
}

export interface PokemonCriesDto {
  latest: string | null;
  legacy: string | null;
}

export interface PokemonDto {
  id: number;
  name: string;
  height: number;
  weight: number;
  base_experience: number | null;
  order: number;
  is_default: boolean;
  sprites: PokemonSpriteSet;
  types: PokemonTypeSlot[];
  abilities: PokemonAbilitySlot[];
  stats: PokemonStatEntry[];
  moves: PokemonMoveEntry[];
  species: NamedApiResource;
  cries?: PokemonCriesDto;
}

/* -------------------------------------------------------- Pokemon species */

export interface PokemonSpeciesDto {
  id: number;
  name: string;
  order: number;
  gender_rate: number;
  capture_rate: number;
  base_happiness: number | null;
  is_baby: boolean;
  is_legendary: boolean;
  is_mythical: boolean;
  hatch_counter: number | null;
  has_gender_differences: boolean;
  forms_switchable: boolean;
  growth_rate: NamedApiResource | null;
  egg_groups: NamedApiResource[];
  color: NamedApiResource;
  shape: NamedApiResource | null;
  habitat: NamedApiResource | null;
  generation: NamedApiResource;
  evolves_from_species: NamedApiResource | null;
  evolution_chain: ApiResource;
  flavor_text_entries: FlavorText[];
  genera: { genus: string; language: NamedApiResource }[];
  varieties: { is_default: boolean; pokemon: NamedApiResource }[];
}

/* --------------------------------------------------------- Evolution chain */

export interface EvolutionDetailDto {
  min_level: number | null;
  trigger: NamedApiResource;
  item: NamedApiResource | null;
  min_happiness: number | null;
  time_of_day: string;
  known_move: NamedApiResource | null;
  location: NamedApiResource | null;
}

export interface ChainLinkDto {
  is_baby: boolean;
  species: NamedApiResource;
  evolution_details: EvolutionDetailDto[];
  evolves_to: ChainLinkDto[];
}

export interface EvolutionChainDto {
  id: number;
  chain: ChainLinkDto;
}

/* ------------------------------------------------------------------- Type */

export interface TypeDamageRelations {
  no_damage_to: NamedApiResource[];
  half_damage_to: NamedApiResource[];
  double_damage_to: NamedApiResource[];
  no_damage_from: NamedApiResource[];
  half_damage_from: NamedApiResource[];
  double_damage_from: NamedApiResource[];
}

export interface TypeDto {
  id: number;
  name: string;
  damage_relations: TypeDamageRelations;
  pokemon: { slot: number; pokemon: NamedApiResource }[];
}

/* ------------------------------------------------------------------- Move */

export interface MoveDto {
  id: number;
  name: string;
  accuracy: number | null;
  power: number | null;
  pp: number | null;
  priority: number;
  type: NamedApiResource;
  damage_class: NamedApiResource | null;
  effect_chance: number | null;
  effect_entries: VerboseEffect[];
  flavor_text_entries: FlavorText[];
  meta: {
    ailment: NamedApiResource;
    ailment_chance: number;
    crit_rate: number;
    drain: number;
    flinch_chance: number;
    healing: number;
    max_hits: number | null;
    min_hits: number | null;
  } | null;
}

/* ---------------------------------------------------------------- Ability */

export interface AbilityDto {
  id: number;
  name: string;
  is_main_series: boolean;
  effect_entries: VerboseEffect[];
  flavor_text_entries: FlavorText[];
}

/* ----------------------------------------------------------------- Nature */

export interface NatureDto {
  id: number;
  name: string;
  increased_stat: NamedApiResource | null;
  decreased_stat: NamedApiResource | null;
  likes_flavor: NamedApiResource | null;
  hates_flavor: NamedApiResource | null;
}

/* ------------------------------------------------------------- Generation */

export interface GenerationDto {
  id: number;
  name: string;
  main_region: NamedApiResource;
  pokemon_species: NamedApiResource[];
}

/* ---------------------------------------------------------- Berry flavour */

export interface BerryFlavorDto {
  id: number;
  name: string;
  /** Berries that carry this flavour, with their potency. */
  berries: { potency: number; berry: NamedApiResource }[];
  /** The contest type this flavour feeds (e.g. spicy → cool). */
  contest_type: NamedApiResource;
}
