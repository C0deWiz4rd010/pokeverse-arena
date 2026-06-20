/**
 * Pure stat-calculation helpers following the main-series Gen III+ formulas.
 *
 * Used by the Team Builder (preview stats) and the Battle Engine (combat stats).
 */

export type StatKey = 'hp' | 'attack' | 'defense' | 'special-attack' | 'special-defense' | 'speed';

export interface NatureModifier {
  increased: StatKey | null;
  decreased: StatKey | null;
}

const NEUTRAL: NatureModifier = { increased: null, decreased: null };

/** HP uses a slightly different formula from the other five stats. */
export function calcHp(base: number, iv: number, ev: number, level: number): number {
  if (base === 1) return 1; // Shedinja rule
  return Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level) / 100) + level + 10;
}

/** Attack/Defense/Sp.Atk/Sp.Def/Speed, including the nature multiplier. */
export function calcStat(
  stat: StatKey,
  base: number,
  iv: number,
  ev: number,
  level: number,
  nature: NatureModifier = NEUTRAL,
): number {
  if (stat === 'hp') return calcHp(base, iv, ev, level);
  const flat = Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level) / 100) + 5;
  let multiplier = 1;
  if (nature.increased === stat) multiplier = 1.1;
  if (nature.decreased === stat) multiplier = 0.9;
  return Math.floor(flat * multiplier);
}

/** A clean set of "max IV, no EV" stats — sensible defaults for quick battles. */
export function quickStats(
  bases: Record<StatKey, number>,
  level: number,
  nature: NatureModifier = NEUTRAL,
): Record<StatKey, number> {
  return {
    hp: calcStat('hp', bases.hp, 31, 0, level, nature),
    attack: calcStat('attack', bases.attack, 31, 0, level, nature),
    defense: calcStat('defense', bases.defense, 31, 0, level, nature),
    'special-attack': calcStat('special-attack', bases['special-attack'], 31, 0, level, nature),
    'special-defense': calcStat('special-defense', bases['special-defense'], 31, 0, level, nature),
    speed: calcStat('speed', bases.speed, 31, 0, level, nature),
  };
}
