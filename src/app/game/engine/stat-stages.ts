/**
 * In-battle stat stages (−6..+6) and their multipliers.
 *
 * Pure and framework-free: the battle engine owns a {@link Stages} record per
 * side and asks {@link stageMultiplier} for the factor to fold into damage,
 * speed and accuracy maths. Offensive/defensive stats use the 2/(2+n) table;
 * accuracy and evasion use the slightly gentler 3/(3+n) table — both match the
 * main-series Gen III+ rules.
 */

/** The seven stats that can be raised or lowered in battle. */
export type BoostableStat =
  | 'attack'
  | 'defense'
  | 'special-attack'
  | 'special-defense'
  | 'speed'
  | 'accuracy'
  | 'evasion';

export const BOOSTABLE_STATS: readonly BoostableStat[] = [
  'attack',
  'defense',
  'special-attack',
  'special-defense',
  'speed',
  'accuracy',
  'evasion',
];

/** A full set of stage counters, each clamped to [-6, 6]. */
export type Stages = Record<BoostableStat, number>;

export const MIN_STAGE = -6;
export const MAX_STAGE = 6;

/** A fresh, all-zero stage record. */
export function freshStages(): Stages {
  return {
    attack: 0,
    defense: 0,
    'special-attack': 0,
    'special-defense': 0,
    speed: 0,
    accuracy: 0,
    evasion: 0,
  };
}

/** Clamp a raw stage value into the legal [-6, 6] band. */
export function clampStage(value: number): number {
  return Math.max(MIN_STAGE, Math.min(MAX_STAGE, value));
}

/**
 * Multiplier for a given stat at a given stage.
 *
 * - Attack/Defense/Sp.Atk/Sp.Def/Speed: `n >= 0 → (2+n)/2`, else `2/(2-n)`.
 * - Accuracy/Evasion: `n >= 0 → (3+n)/3`, else `3/(3-n)`.
 *
 * For evasion the engine inverts the meaning (higher evasion lowers the
 * attacker's chance) at the call site; this function always returns the raw
 * table value for the stat's own stage.
 */
export function stageMultiplier(stat: BoostableStat, stage: number): number {
  const n = clampStage(stage);
  const base = stat === 'accuracy' || stat === 'evasion' ? 3 : 2;
  return n >= 0 ? (base + n) / base : base / (base - n);
}

/**
 * Apply a boost to one stat, returning the new clamped stage and how much it
 * actually moved (0 when already maxed/minned — useful for "won't go higher!").
 */
export function applyBoost(
  stages: Stages,
  stat: BoostableStat,
  delta: number,
): { stages: Stages; applied: number } {
  const before = stages[stat];
  const after = clampStage(before + delta);
  return { stages: { ...stages, [stat]: after }, applied: after - before };
}

/** Apply several boosts at once (e.g. a move's self-boost block). */
export function applyBoosts(
  stages: Stages,
  boosts: Partial<Record<BoostableStat, number>>,
): Stages {
  let next = stages;
  for (const key of Object.keys(boosts) as BoostableStat[]) {
    next = applyBoost(next, key, boosts[key]!).stages;
  }
  return next;
}

/** Reset all stages to zero (e.g. on switch-out / Haze). */
export function clearStages(): Stages {
  return freshStages();
}

/** Short ▲▲ / ▼ label for the UI, or '' at neutral. */
export function stageLabel(stage: number): string {
  const n = clampStage(stage);
  if (n === 0) return '';
  const arrow = n > 0 ? '▲' : '▼';
  return arrow.repeat(Math.min(3, Math.abs(n))) + (Math.abs(n) > 3 ? '' : '');
}
