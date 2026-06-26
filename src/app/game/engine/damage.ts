/**
 * Pure damage calculation following a simplified main-series (Gen V+) formula.
 *
 * Every source of randomness (the 0.85–1.0 roll, critical hits) is passed in as
 * an explicit argument, so {@link computeDamage} is fully deterministic and easy
 * to unit-test. The {@link Battle} class is responsible for rolling those values
 * from the seeded RNG.
 */
import { effectiveness, type PokemonType } from '../../core/utils/type-chart';
import type { Battler, BattleMove, BattleSide, Field } from './battle-types';
import { effectivenessRuled, weatherBoost, type BattleRules } from './rules';
import { stageMultiplier } from './stat-stages';
import { abilityById } from './abilities';
import { itemById } from './items';
import { weatherDamageFactor, weatherDefenseFactor } from './weather';
import { isGrounded, terrainDamageFactor } from './terrain';

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
  /** Combined final multiplier (weather, terrain, items, abilities). Default 1. */
  modifier?: number;
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
  const modifier = input.modifier ?? 1;
  const modified = base * stab * typeEffectiveness * critMult * roll * modifier;
  const damage = Math.max(1, Math.floor(modified));
  return { damage, effectiveness: typeEffectiveness, crit, stab };
}

/** 1.5 if the move's type is one of the attacker's types, else 1. */
export function stabFor(attacker: Battler, move: BattleMove): number {
  return attacker.types.includes(move.type) ? STAB_MULTIPLIER : 1;
}

/** Type multiplier of a move against a defender's typing (rule-aware). */
export function moveEffectiveness(
  move: BattleMove,
  defenderTypes: readonly PokemonType[],
  rules?: BattleRules,
): number {
  return rules ? effectivenessRuled(move.type, defenderTypes, rules) : effectiveness(move.type, defenderTypes);
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
  rules?: BattleRules,
): DamageResult {
  const typeEffectiveness = moveEffectiveness(move, defender.types, rules);
  const boosted = typeEffectiveness * weatherBoost(move.type, rules);
  const result = computeDamage({
    level: attacker.level,
    power: move.power,
    attack: offensiveStat(attacker, move),
    defense: defensiveStat(defender, move),
    stab: stabFor(attacker, move),
    typeEffectiveness: boosted,
    crit,
    roll,
  });
  // Report the true type effectiveness (without the weather boost) for the log.
  return { ...result, effectiveness: typeEffectiveness };
}

/** Whether a battler is grounded (Flying / Levitate float). */
export function battlerGrounded(side: BattleSide): boolean {
  const ability = abilityById(side.battler.ability);
  return isGrounded(side.battler.types) && ability?.levitate !== true;
}

/** Full damage context: two live sides + the field. */
export interface MoveDamageContext {
  readonly attacker: BattleSide;
  readonly defender: BattleSide;
  readonly field: Field;
  readonly move: BattleMove;
  readonly crit: boolean;
  readonly roll: number;
  readonly rules?: BattleRules;
  /** Flash Fire is active on the attacker (boosts its Fire moves). */
  readonly flashFire?: boolean;
}

/**
 * The full, context-aware damage pipeline used by the live engine. Folds in stat
 * stages, status (burn), abilities, held items, weather and terrain on top of the
 * pure {@link computeDamage} formula. Crits ignore the attacker's negative
 * offensive stages and the defender's positive defensive stages, as in the games.
 */
export function computeMoveDamage(ctx: MoveDamageContext): DamageResult {
  const { attacker, defender, field, move, crit, roll, rules } = ctx;
  const atk = attacker.battler;
  const def = defender.battler;
  const special = move.damageClass === 'special';

  const typeEff = moveEffectiveness(move, def.types, rules);
  let stab = stabFor(atk, move);
  if (move.power <= 0 || typeEff === 0) {
    return { damage: 0, effectiveness: typeEff, crit, stab };
  }

  const atkAbility = abilityById(atk.ability);
  const defAbility = abilityById(def.ability);
  const atkItem = itemById(atk.item);
  const defItem = itemById(def.item);

  // ---- Power modifiers ----
  let power = move.power;
  if (atkAbility?.technician && power <= 60) power *= 1.5;
  if (
    atkAbility?.pinch &&
    move.type === atkAbility.pinch.type &&
    attacker.currentHp / attacker.maxHp <= 1 / 3
  ) {
    power *= atkAbility.pinch.factor;
  }
  power = Math.max(1, Math.floor(power));

  // ---- Offensive stat ----
  const atkKey = special ? 'special-attack' : 'attack';
  let atkStage = attacker.stages[atkKey];
  if (crit && atkStage < 0) atkStage = 0; // crit ignores the attacker's drops
  if (defAbility?.unaware) atkStage = 0; // Unaware defender ignores the boosts
  let A = atk.stats[atkKey] * stageMultiplier(atkKey, atkStage);
  if (atkAbility?.attackMultiplier) A *= atkAbility.attackMultiplier;
  if (atkItem?.statMultiplier?.stat === atkKey) A *= atkItem.statMultiplier.factor;
  if (attacker.status !== 'none' && atkAbility?.guts) A *= 1.5;
  else if (!special && attacker.status === 'burn') A *= 0.5; // burn halves physical
  A = Math.max(1, Math.floor(A));

  // ---- Defensive stat ----
  const defKey = special ? 'special-defense' : 'defense';
  let defStage = defender.stages[defKey];
  if (crit && defStage > 0) defStage = 0; // crit ignores the defender's boosts
  if (atkAbility?.unaware) defStage = 0; // Unaware attacker ignores the boosts
  let D = def.stats[defKey] * stageMultiplier(defKey, defStage);
  if (defItem?.eviolite) D *= 1.5;
  if (special && defItem?.statMultiplier?.stat === 'special-defense') D *= defItem.statMultiplier.factor;
  D *= weatherDefenseFactor(field.weather, def.types, special);
  D = Math.max(1, Math.floor(D));

  // ---- Final multiplier chain ----
  let mod = 1;
  if (stab > 1 && atkAbility?.adaptability) stab = 2;
  mod *= weatherDamageFactor(field.weather, move.type);
  mod *= weatherBoost(move.type, rules); // tournament "Weather Wars" boost
  mod *= terrainDamageFactor(field.terrain, move.type, battlerGrounded(attacker), battlerGrounded(defender));
  if (ctx.flashFire && move.type === 'fire') mod *= 1.5;
  if (atkItem?.damageMultiplier) mod *= atkItem.damageMultiplier;
  if (atkItem?.expertBelt && typeEff > 1) mod *= atkItem.expertBelt;
  if (atkItem?.classBoost && atkItem.classBoost.special === special) mod *= atkItem.classBoost.factor;
  if (atkItem?.typeBoost && atkItem.typeBoost.type === move.type) mod *= atkItem.typeBoost.factor;
  if (defAbility?.thickFat && (move.type === 'fire' || move.type === 'ice')) mod *= 0.5;
  if (defAbility?.multiscale && defender.currentHp >= defender.maxHp) mod *= 0.5;

  const result = computeDamage({
    level: atk.level,
    power,
    attack: A,
    defense: D,
    stab,
    typeEffectiveness: typeEff,
    crit,
    roll,
    modifier: mod,
  });
  return { ...result, effectiveness: typeEff, stab };
}
