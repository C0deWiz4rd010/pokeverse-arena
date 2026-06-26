/**
 * In-battle weather as a real mechanic (distinct from the cosmetic
 * `core/ui/weather-overlay`). Weather modifies damage of certain move types and
 * chips non-immune Pokémon at end of turn. Pure and deterministic.
 */
import type { PokemonType } from '../../core/utils/type-chart';

export type Weather = 'none' | 'sun' | 'rain' | 'sand' | 'hail' | 'snow';

export interface WeatherInfo {
  readonly key: Weather;
  readonly label: string;
  /** Types not chipped by this weather (sand/hail only). */
  readonly chips: boolean;
}

export const WEATHER_INFO: Record<Weather, WeatherInfo> = {
  none: { key: 'none', label: 'Clear skies', chips: false },
  sun: { key: 'sun', label: 'Harsh sunlight', chips: false },
  rain: { key: 'rain', label: 'Rain', chips: false },
  sand: { key: 'sand', label: 'Sandstorm', chips: true },
  hail: { key: 'hail', label: 'Hail', chips: true },
  snow: { key: 'snow', label: 'Snow', chips: false },
};

/** End-of-turn weather chip is 1/16 max HP. */
export const WEATHER_CHIP_FRACTION = 1 / 16;

/** Types immune to the sandstorm/hail residual. */
const SAND_IMMUNE: readonly PokemonType[] = ['rock', 'ground', 'steel'];
const HAIL_IMMUNE: readonly PokemonType[] = ['ice'];

/**
 * Damage multiplier this weather applies to a move of the given type.
 * Sun boosts Fire ×1.5 and weakens Water ×0.5; rain mirrors it.
 */
export function weatherDamageFactor(weather: Weather, moveType: PokemonType): number {
  if (weather === 'sun') {
    if (moveType === 'fire') return 1.5;
    if (moveType === 'water') return 0.5;
  }
  if (weather === 'rain') {
    if (moveType === 'water') return 1.5;
    if (moveType === 'fire') return 0.5;
  }
  return 1;
}

/**
 * Passive defensive bonus from weather: Sandstorm gives Rock-types +50% Sp.Def,
 * Snow gives Ice-types +50% Defense. Returns the multiplier on the relevant
 * defensive stat (1 when it doesn't apply).
 */
export function weatherDefenseFactor(
  weather: Weather,
  defenderTypes: readonly PokemonType[],
  isSpecial: boolean,
): number {
  if (weather === 'sand' && isSpecial && defenderTypes.includes('rock')) return 1.5;
  if (weather === 'snow' && !isSpecial && defenderTypes.includes('ice')) return 1.5;
  return 1;
}

/** Whether this Pokémon takes end-of-turn weather chip. */
export function takesWeatherChip(weather: Weather, types: readonly PokemonType[]): boolean {
  if (weather === 'sand') return !types.some((t) => SAND_IMMUNE.includes(t));
  if (weather === 'hail') return !types.some((t) => HAIL_IMMUNE.includes(t));
  return false;
}

/** Residual damage from weather for one Pokémon (0 when immune / no chip). */
export function weatherChipDamage(weather: Weather, maxHp: number, types: readonly PokemonType[]): number {
  if (!takesWeatherChip(weather, types)) return 0;
  return Math.max(1, Math.floor(maxHp * WEATHER_CHIP_FRACTION));
}

export function weatherSetMessage(weather: Weather): string {
  switch (weather) {
    case 'sun':
      return 'The sunlight turned harsh!';
    case 'rain':
      return 'It started to rain!';
    case 'sand':
      return 'A sandstorm kicked up!';
    case 'hail':
      return 'It started to hail!';
    case 'snow':
      return 'It started to snow!';
    default:
      return 'The weather cleared up.';
  }
}

export function weatherChipMessage(name: string, weather: Weather): string {
  if (weather === 'sand') return `${name} is buffeted by the sandstorm!`;
  if (weather === 'hail') return `${name} is pelted by hail!`;
  return '';
}
