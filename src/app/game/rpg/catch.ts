/**
 * Wild-catch probability — a simplified, fun-tuned take on the classic capture
 * formula: lower foe HP, a status condition, and a better ball all raise odds.
 * Pure; the RNG is injected so battles stay reproducible.
 */
import type { SeededRng } from '../../core/utils/rng';
import type { StatusCondition } from '../engine';

export type RpgBallId = 'poke-ball' | 'great-ball' | 'ultra-ball';

export const BALL_MULT: Record<RpgBallId, number> = {
  'poke-ball': 1,
  'great-ball': 1.5,
  'ultra-ball': 2,
};

const STATUS_BONUS: Partial<Record<StatusCondition, number>> = {
  sleep: 2,
  freeze: 2,
  paralysis: 1.5,
  burn: 1.5,
  poison: 1.5,
};

/** Default species capture rate when an encounter doesn't specify one. */
export const DEFAULT_CATCH_RATE = 120;

/**
 * Catch probability 0–1.
 * @param catchRate species capture rate, 1 (legendary) – 255 (trivial)
 * @param hpPct     foe's remaining HP fraction, 0–1
 */
export function catchChance(
  catchRate: number,
  hpPct: number,
  status: StatusCondition,
  ball: RpgBallId,
): number {
  const rate = Math.max(1, Math.min(255, catchRate));
  const hp = Math.max(0.01, Math.min(1, hpPct));
  const ballMult = BALL_MULT[ball];
  const statusMult = STATUS_BONUS[status] ?? 1;
  // (3 - 2·hp) gives 1 at full HP and ~3 near zero; scaled by rate/255.
  const a = ((3 - 2 * hp) / 3) * (rate / 255) * ballMult * statusMult;
  return Math.max(0.02, Math.min(0.98, a));
}

export function attemptCatch(
  catchRate: number,
  hpPct: number,
  status: StatusCondition,
  ball: RpgBallId,
  rng: SeededRng,
): boolean {
  return rng.next() < catchChance(catchRate, hpPct, status, ball);
}
