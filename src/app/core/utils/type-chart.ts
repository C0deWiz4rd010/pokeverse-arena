/**
 * Gen VI+ type-effectiveness chart.
 *
 * `TYPE_CHART[attacker][defender]` = damage multiplier (0, 0.5, 1 or 2).
 * Kept as static data so battle math never needs a network call and is fully
 * deterministic / unit-testable.
 */

export const POKEMON_TYPES = [
  'normal', 'fire', 'water', 'electric', 'grass', 'ice', 'fighting', 'poison',
  'ground', 'flying', 'psychic', 'bug', 'rock', 'ghost', 'dragon', 'dark',
  'steel', 'fairy',
] as const;

export type PokemonType = (typeof POKEMON_TYPES)[number];

type ChartRow = Partial<Record<PokemonType, number>>;

/** Only non-1x relations are listed; everything else defaults to 1x. */
const RELATIONS: Record<PokemonType, ChartRow> = {
  normal: { rock: 0.5, ghost: 0, steel: 0.5 },
  fire: { fire: 0.5, water: 0.5, grass: 2, ice: 2, bug: 2, rock: 0.5, dragon: 0.5, steel: 2 },
  water: { fire: 2, water: 0.5, grass: 0.5, ground: 2, rock: 2, dragon: 0.5 },
  electric: { water: 2, electric: 0.5, grass: 0.5, ground: 0, flying: 2, dragon: 0.5 },
  grass: { fire: 0.5, water: 2, grass: 0.5, poison: 0.5, ground: 2, flying: 0.5, bug: 0.5, rock: 2, dragon: 0.5, steel: 0.5 },
  ice: { fire: 0.5, water: 0.5, grass: 2, ice: 0.5, ground: 2, flying: 2, dragon: 2, steel: 0.5 },
  fighting: { normal: 2, ice: 2, poison: 0.5, flying: 0.5, psychic: 0.5, bug: 0.5, rock: 2, ghost: 0, dark: 2, steel: 2, fairy: 0.5 },
  poison: { grass: 2, poison: 0.5, ground: 0.5, rock: 0.5, ghost: 0.5, steel: 0, fairy: 2 },
  ground: { fire: 2, electric: 2, grass: 0.5, poison: 2, flying: 0, bug: 0.5, rock: 2, steel: 2 },
  flying: { electric: 0.5, grass: 2, fighting: 2, bug: 2, rock: 0.5, steel: 0.5 },
  psychic: { fighting: 2, poison: 2, psychic: 0.5, dark: 0, steel: 0.5 },
  bug: { fire: 0.5, grass: 2, fighting: 0.5, poison: 0.5, flying: 0.5, psychic: 2, ghost: 0.5, dark: 2, steel: 0.5, fairy: 0.5 },
  rock: { fire: 2, ice: 2, fighting: 0.5, ground: 0.5, flying: 2, bug: 2, steel: 0.5 },
  ghost: { normal: 0, psychic: 2, ghost: 2, dark: 0.5 },
  dragon: { dragon: 2, steel: 0.5, fairy: 0 },
  dark: { fighting: 0.5, psychic: 2, ghost: 2, dark: 0.5, fairy: 0.5 },
  steel: { fire: 0.5, water: 0.5, electric: 0.5, ice: 2, rock: 2, steel: 0.5, fairy: 2 },
  fairy: { fire: 0.5, fighting: 2, poison: 0.5, dragon: 2, dark: 2, steel: 0.5 },
};

export function isPokemonType(value: string): value is PokemonType {
  return (POKEMON_TYPES as readonly string[]).includes(value);
}

/** Multiplier of a single attacking type against a single defending type. */
export function singleEffectiveness(attacker: PokemonType, defender: PokemonType): number {
  return RELATIONS[attacker][defender] ?? 1;
}

/** Combined multiplier of one attacking type against 1–2 defending types. */
export function effectiveness(attacker: PokemonType, defenders: readonly PokemonType[]): number {
  return defenders.reduce((mult, def) => mult * singleEffectiveness(attacker, def), 1);
}

/** Human-readable label for a multiplier, used in the Type Lab UI. */
export function effectivenessLabel(multiplier: number): string {
  if (multiplier === 0) return 'No effect';
  if (multiplier >= 4) return 'Hyper effective';
  if (multiplier > 1) return 'Super effective';
  if (multiplier < 1) return 'Not very effective';
  return 'Neutral';
}

/**
 * Defensive profile of a (1–2 type) Pokémon: for every attacking type, the
 * damage multiplier it would deal to this defender.
 */
export function defensiveProfile(
  defenders: readonly PokemonType[],
): Record<PokemonType, number> {
  const out = {} as Record<PokemonType, number>;
  for (const attacker of POKEMON_TYPES) {
    out[attacker] = effectiveness(attacker, defenders);
  }
  return out;
}

export interface DefenseGroups {
  /** ×4 double-weaknesses. */
  readonly x4: PokemonType[];
  /** ×2 weaknesses. */
  readonly x2: PokemonType[];
  /** ×½ resistances. */
  readonly half: PokemonType[];
  /** ×¼ double-resistances. */
  readonly quarter: PokemonType[];
  /** ×0 immunities. */
  readonly immune: PokemonType[];
}

/**
 * Group every attacking type by how hard it hits this (1–2 type) defender, for a
 * "weaknesses / resistances / immunities" panel. Neutral (×1) types are omitted.
 */
export function groupDefenses(defenders: readonly PokemonType[]): DefenseGroups {
  const profile = defensiveProfile(defenders);
  const groups: DefenseGroups = { x4: [], x2: [], half: [], quarter: [], immune: [] };
  for (const attacker of POKEMON_TYPES) {
    const m = profile[attacker];
    if (m === 0) groups.immune.push(attacker);
    else if (m >= 4) groups.x4.push(attacker);
    else if (m >= 2) groups.x2.push(attacker);
    else if (m <= 0.25) groups.quarter.push(attacker);
    else if (m < 1) groups.half.push(attacker);
  }
  return groups;
}

/**
 * Offensive profile of a single attacking type: the multiplier it deals to
 * each defending type. Useful for "what does this move hit hard?".
 */
export function offensiveProfile(
  attacker: PokemonType,
): Record<PokemonType, number> {
  const out = {} as Record<PokemonType, number>;
  for (const defender of POKEMON_TYPES) {
    out[defender] = singleEffectiveness(attacker, defender);
  }
  return out;
}

export interface TeamMemberTyping {
  readonly name: string;
  readonly types: readonly PokemonType[];
}

export interface TeamTypeAnalysis {
  /** How many team members are weak (>1x) to each attacking type. */
  readonly weaknesses: Record<PokemonType, number>;
  /** How many team members resist (<1x, incl. immunities) each attacking type. */
  readonly resistances: Record<PokemonType, number>;
  /** Attacking types no team member resists — the team's blind spots. */
  readonly uncovered: PokemonType[];
}

export interface OffensiveCoverage {
  /** Defending types at least one member can hit super-effectively (STAB). */
  readonly covered: PokemonType[];
  /** Defending types no member's STAB hits for ≥2× — offensive blind spots. */
  readonly gaps: PokemonType[];
}

/**
 * Which defending types a team can / cannot threaten with super-effective STAB.
 */
export function offensiveCoverage(team: readonly TeamMemberTyping[]): OffensiveCoverage {
  const covered: PokemonType[] = [];
  const gaps: PokemonType[] = [];
  for (const defender of POKEMON_TYPES) {
    const hit = team.some((m) => m.types.some((atk) => singleEffectiveness(atk, defender) >= 2));
    (hit ? covered : gaps).push(defender);
  }
  return { covered, gaps };
}

/**
 * Aggregates the defensive profiles of a whole team to surface shared
 * weaknesses and coverage gaps.
 */
export function analyzeTeamTypes(team: readonly TeamMemberTyping[]): TeamTypeAnalysis {
  const weaknesses = {} as Record<PokemonType, number>;
  const resistances = {} as Record<PokemonType, number>;
  for (const attacker of POKEMON_TYPES) {
    weaknesses[attacker] = 0;
    resistances[attacker] = 0;
  }
  for (const member of team) {
    const profile = defensiveProfile(member.types);
    for (const attacker of POKEMON_TYPES) {
      const mult = profile[attacker];
      if (mult > 1) weaknesses[attacker]++;
      else if (mult < 1) resistances[attacker]++;
    }
  }
  const uncovered = POKEMON_TYPES.filter(
    (attacker) => weaknesses[attacker] > 0 && resistances[attacker] === 0,
  );
  return { weaknesses, resistances, uncovered };
}
