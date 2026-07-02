/**
 * Crystal-ball pick'em — before your first match you may call the tournament's
 * champion. Longshots pay more than favourites: the payout multiplier is the
 * inverse of the pick's implied win probability, derived from team power shares.
 * Pure maths, no storage — the run's pick lives in the service.
 */

/** Sharpens the power→probability curve so favourites read as favourites. */
const SHARPNESS = 1.5;
/** Base bonus (₽) a correct call pays before the multiplier. */
export const PICKEM_BASE = 20;
export const PICKEM_MIN_MULT = 2;
export const PICKEM_MAX_MULT = 25;

/** Implied probability that the team with `pickPower` wins the whole field. */
export function pickProbability(pickPower: number, fieldPowers: readonly number[]): number {
  const total = fieldPowers.reduce((s, p) => s + Math.pow(Math.max(0, p), SHARPNESS), 0);
  if (total <= 0) return 0;
  return Math.pow(Math.max(0, pickPower), SHARPNESS) / total;
}

/** Payout multiplier for calling this champion (longshots pay more). */
export function pickemMultiplier(pickPower: number, fieldPowers: readonly number[]): number {
  const p = pickProbability(pickPower, fieldPowers);
  if (p <= 0) return PICKEM_MAX_MULT;
  return Math.max(PICKEM_MIN_MULT, Math.min(PICKEM_MAX_MULT, Math.round(0.85 / p)));
}

/** Bonus prize (₽) paid when the called champion actually lifts the trophy. */
export function pickemPayout(pickPower: number, fieldPowers: readonly number[]): number {
  return PICKEM_BASE * pickemMultiplier(pickPower, fieldPowers);
}
