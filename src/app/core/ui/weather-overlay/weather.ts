import type { PokemonType } from '../../utils/type-chart';
import type { IconName } from '../icon/icons.data';
import type { Weather as EngineWeather } from '../../../game/engine';

/** The set of atmospheric backdrops a battle can take place in. */
export type Ambience = 'clear' | 'sun' | 'rain' | 'storm' | 'sand' | 'snow' | 'fog' | 'leaves';

export interface AmbienceInfo {
  readonly id: Ambience;
  readonly label: string;
  readonly icon: IconName;
}

/** Which atmosphere a given type evokes (drives the auto-picked weather). */
const TYPE_WEATHER: Partial<Record<PokemonType, Ambience>> = {
  fire: 'sun',
  water: 'rain',
  electric: 'storm',
  ice: 'snow',
  rock: 'sand',
  ground: 'sand',
  steel: 'sand',
  grass: 'leaves',
  bug: 'leaves',
  ghost: 'fog',
  dark: 'fog',
  poison: 'fog',
  psychic: 'fog',
  fairy: 'fog',
};

export const AMBIENCE_INFO: Record<Ambience, AmbienceInfo> = {
  clear: { id: 'clear', label: 'Clear skies', icon: 'cloud-sun' },
  sun: { id: 'sun', label: 'Harsh sunlight', icon: 'sun' },
  rain: { id: 'rain', label: 'Rain', icon: 'cloud-rain' },
  storm: { id: 'storm', label: 'Thunderstorm', icon: 'cloud-lightning' },
  sand: { id: 'sand', label: 'Sandstorm', icon: 'wind' },
  snow: { id: 'snow', label: 'Snow', icon: 'snowflake' },
  fog: { id: 'fog', label: 'Fog', icon: 'cloud-fog' },
  leaves: { id: 'leaves', label: 'Windswept', icon: 'leaf' },
};

/** The weather a single type evokes, if any (used to honor a forced boost type). */
export function weatherForType(type: PokemonType): Ambience {
  return TYPE_WEATHER[type] ?? 'clear';
}

/**
 * Choose a fitting weather from the fighters' typings.
 *
 * The foe's types are weighted first (it's the "wild" environment), then the
 * player's. When several types suggest weather, an optional `pick` (e.g. a
 * seeded RNG) selects among them so the same matchup reproduces deterministically.
 */
export function pickWeather(
  playerTypes: readonly PokemonType[],
  foeTypes: readonly PokemonType[],
  pick?: <T>(items: readonly T[]) => T,
): Ambience {
  const candidates = [
    ...new Set(
      [...foeTypes, ...playerTypes].map((t) => TYPE_WEATHER[t]).filter((w): w is Ambience => !!w),
    ),
  ];
  if (!candidates.length) return 'clear';
  return pick ? pick(candidates) : candidates[0]!;
}

/** The battle engine's weather condition → the cosmetic backdrop that depicts it. */
export const AMBIENCE_FOR_ENGINE: Record<EngineWeather, Ambience> = {
  none: 'clear',
  sun: 'sun',
  rain: 'rain',
  sand: 'sand',
  hail: 'snow',
  snow: 'snow',
};
