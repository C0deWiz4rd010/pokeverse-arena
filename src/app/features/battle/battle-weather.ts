import type { PokemonType } from '../../core/utils/type-chart';

/** The set of atmospheric backdrops a battle can take place in. */
export type Weather = 'clear' | 'sun' | 'rain' | 'storm' | 'sand' | 'snow' | 'fog' | 'leaves';

export interface WeatherInfo {
  readonly id: Weather;
  readonly label: string;
  readonly icon: string;
}

/** Which atmosphere a given type evokes (drives the auto-picked weather). */
const TYPE_WEATHER: Partial<Record<PokemonType, Weather>> = {
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

export const WEATHER_INFO: Record<Weather, WeatherInfo> = {
  clear: { id: 'clear', label: 'Clear skies', icon: '🌤️' },
  sun: { id: 'sun', label: 'Harsh sunlight', icon: '☀️' },
  rain: { id: 'rain', label: 'Rain', icon: '🌧️' },
  storm: { id: 'storm', label: 'Thunderstorm', icon: '⛈️' },
  sand: { id: 'sand', label: 'Sandstorm', icon: '🏜️' },
  snow: { id: 'snow', label: 'Snow', icon: '❄️' },
  fog: { id: 'fog', label: 'Fog', icon: '🌫️' },
  leaves: { id: 'leaves', label: 'Windswept', icon: '🍃' },
};

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
): Weather {
  const candidates = [
    ...new Set(
      [...foeTypes, ...playerTypes]
        .map((t) => TYPE_WEATHER[t])
        .filter((w): w is Weather => !!w),
    ),
  ];
  if (!candidates.length) return 'clear';
  return pick ? pick(candidates) : candidates[0];
}
