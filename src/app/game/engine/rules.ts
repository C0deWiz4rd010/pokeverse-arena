/**
 * Optional rule modifiers that bend the core damage maths for special battle
 * formats (tournament modes). They are kept here, separate from the pure
 * {@link computeDamage}, so both the interactive {@link Battle} and the headless
 * tournament simulator can share identical rule-aware effectiveness.
 */
import { singleEffectiveness, type PokemonType } from '../../core/utils/type-chart';

export interface BattleRules {
  /** Invert the type chart (Inverse Cup): resists/immunities become weaknesses. */
  inverse?: boolean;
  /** A weather-empowered move type that deals 1.5× damage (Weather Wars). */
  weatherBoostType?: PokemonType;
}

/** Single-matchup effectiveness, optionally inverted. */
export function singleEffectivenessRuled(
  attacker: PokemonType,
  defender: PokemonType,
  rules?: BattleRules,
): number {
  const base = singleEffectiveness(attacker, defender);
  if (!rules?.inverse) return base;
  // Inverse battles: anything that resisted (incl. immunity) now hits hard,
  // anything that was super-effective is now resisted.
  if (base > 1) return 0.5;
  if (base < 1) return 2;
  return 1;
}

/** Combined effectiveness of a move type against a defender's typing. */
export function effectivenessRuled(
  moveType: PokemonType,
  defenderTypes: readonly PokemonType[],
  rules?: BattleRules,
): number {
  return defenderTypes.reduce(
    (mult, def) => mult * singleEffectivenessRuled(moveType, def, rules),
    1,
  );
}

/** 1.5× if the active weather empowers this move's type, else 1. */
export function weatherBoost(moveType: PokemonType, rules?: BattleRules): number {
  return rules?.weatherBoostType === moveType ? 1.5 : 1;
}
