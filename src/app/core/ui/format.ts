import type { PokemonType } from '../utils/type-chart';

/** "bulbasaur" -> "Bulbasaur"; "mr-mime" -> "Mr Mime". */
export function titleCase(value: string): string {
  return value
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** 25 -> "#025". */
export function padId(id: number): string {
  return `#${String(id).padStart(3, '0')}`;
}

/** CSS variable for a type color, e.g. type 'fire' -> var(--type-fire). */
export function typeColorVar(type: PokemonType | string): string {
  return `var(--type-${type})`;
}

export function metersToFeet(m: number): string {
  const totalInches = m * 39.3701;
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches % 12);
  return `${feet}'${String(inches).padStart(2, '0')}"`;
}

export function kgToLbs(kg: number): string {
  return `${(kg * 2.20462).toFixed(1)} lbs`;
}
