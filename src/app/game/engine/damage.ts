/**
 * Pure damage calculation following a simplified main-series (Gen V+) formula.
 *
 * Every source of randomness (the 0.85–1.0 roll, critical hits) is passed in as
 * an explicit argument, so {@link computeDamage} is fully deterministic and easy
 * to unit-test. The {@link Battle} class is responsible for rolling those values
 * from the seeded RNG.
 */
import { effectiveness, type PokemonType } from '../../core/utils/type-chart';
import type { Battler, BattleMove } from './battle-types';

export const CRIT_MULTIPLIER = 1.5;
export const STAB_MULTIPLIER = 1.5;
/** Base critical-hit probability (Gen VI+ stage 0). */
export const CRIT_CHANCE = 1 / 24;
/** Inclusive damage-roll range as integer percentages. */
export const MIN_ROLL = 0.85;
export const MAX_ROLL = 1;

export interface DamageInput {
  level: number;
  power: number;
  /** Attacker's relevant offensive stat (Atk or SpA). */
  attack: number;
  /** Defender's relevant defensive stat (Def or SpD). */
  defense: number;
  /** 1.5 when the move shares a type with the attacker, else 1. */
  stab: number;
  /** Combined type multiplier vs. the defender (0, 0.25, 0.5, 1, 2, 4). */
  typeEffectiveness: number;
  crit: boolean;
  /** Random factor in [0.85, 1]. */
  roll: number;
}

export interface DamageResult {
  damage: number;
  effectiveness: number;
  crit: boolean;
  stab: number;
}

/** Deterministic damage given all inputs (including the random roll). */
export function computeDamage(input: DamageInput): DamageResult {
  const { level, power, attack, defense, stab, typeEffectiveness, crit, roll } = input;
  if (power <= 0 || typeEffectiveness === 0) {
    return { damage: 0, effectiveness: typeEffectiveness, crit, stab };
  }
  const base =
    Math.floor(Math.floor((Math.floor((2 * level) / 5) + 2) * power * attack) / defense / 50) + 2;
  const critMult = crit ? CRIT_MULTIPLIER : 1;
  const modified = base * stab * typeEffectiveness * critMult * roll;
  const damage = Math.max(1, Math.floor(modified));
  return { damage, effectiveness: typeEffectiveness, crit, stab };
}

/** 1.5 if the move's type is one of the attacker's types, else 1. */
export function stabFor(attacker: Battler, move: BattleMove): number {
  return attacker.types.includes(move.type) ? STAB_MULTIPLIER : 1;
}

/** Type multiplier of a move against a defender's typing. */
export function moveEffectiveness(move: BattleMove, defenderTypes: readonly PokemonType[]): number {
  return effectiveness(move.type, defenderTypes);
}

/** Pick the correct offensive/defensive stats for a move's damage class. */
export function offensiveStat(attacker: Battler, move: BattleMove): number {
  return move.damageClass === 'special'
    ? attacker.stats['special-attack']
    : attacker.stats.attack;
}

export function defensiveStat(defender: Battler, move: BattleMove): number {
  return move.damageClass === 'special'
    ? defender.stats['special-defense']
    : defender.stats.defense;
}

/**
 * Convenience wrapper that derives STAB, type effectiveness and the right stats
 * from two battlers, then defers to {@link computeDamage}.
 */
export function resolveDamage(
  attacker: Battler,
  defender: Battler,
  move: BattleMove,
  crit: boolean,
  roll: number,
): DamageResult {
  return computeDamage({
    level: attacker.level,
    power: move.power,
    attack: offensiveStat(attacker, move),
    defense: defensiveStat(defender, move),
    stab: stabFor(attacker, move),
    typeEffectiveness: moveEffectiveness(move, defender.types),
    crit,
    roll,
  });
}
