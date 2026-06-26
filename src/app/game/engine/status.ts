/**
 * Non-volatile status conditions (burn, poison, badly-poisoned, paralysis,
 * sleep, freeze) and the pure helpers the turn engine uses to apply them, gate
 * a Pokémon's move, and resolve end-of-turn residual damage.
 *
 * Every random branch (waking up, thawing, full-paralysis) takes an explicit
 * roll in [0,1) so the engine can drive it from its {@link SeededRng} and stay
 * deterministic and unit-testable.
 */
import type { PokemonType } from '../../core/utils/type-chart';

export type StatusCondition =
  | 'none'
  | 'burn'
  | 'poison'
  | 'toxic'
  | 'paralysis'
  | 'sleep'
  | 'freeze';

/** Conditions that deal residual damage at end of turn. */
export const RESIDUAL_STATUSES: readonly StatusCondition[] = ['burn', 'poison', 'toxic'];

export interface StatusInfo {
  readonly key: StatusCondition;
  readonly label: string;
  /** Three-letter battle tag, e.g. "BRN". */
  readonly tag: string;
  /** Theme colour for badges. */
  readonly color: string;
}

export const STATUS_INFO: Record<Exclude<StatusCondition, 'none'>, StatusInfo> = {
  burn: { key: 'burn', label: 'Burned', tag: 'BRN', color: '#f1683a' },
  poison: { key: 'poison', label: 'Poisoned', tag: 'PSN', color: '#a33ea1' },
  toxic: { key: 'toxic', label: 'Badly Poisoned', tag: 'TOX', color: '#7b2d8b' },
  paralysis: { key: 'paralysis', label: 'Paralysed', tag: 'PAR', color: '#e0c000' },
  sleep: { key: 'sleep', label: 'Asleep', tag: 'SLP', color: '#8a8a99' },
  freeze: { key: 'freeze', label: 'Frozen', tag: 'FRZ', color: '#5fc7e6' },
};

/** Burn chips 1/16, poison 1/8; toxic ramps n/16 each turn. */
export const BURN_FRACTION = 1 / 16;
export const POISON_FRACTION = 1 / 8;

/** Type immunities to being inflicted with a status. */
const STATUS_IMMUNE_TYPES: Partial<Record<StatusCondition, readonly PokemonType[]>> = {
  burn: ['fire'],
  paralysis: ['electric'],
  freeze: ['ice'],
  poison: ['poison', 'steel'],
  toxic: ['poison', 'steel'],
};

/** Whether a defender with these types can be given this status. */
export function canApplyStatus(
  status: StatusCondition,
  defenderTypes: readonly PokemonType[],
  current: StatusCondition,
): boolean {
  if (status === 'none') return false;
  if (current !== 'none') return false; // already has a non-volatile status
  const immune = STATUS_IMMUNE_TYPES[status];
  if (immune && defenderTypes.some((t) => immune.includes(t))) return false;
  return true;
}

/** Residual damage this turn for a status, given max HP and the toxic counter. */
export function residualDamage(
  status: StatusCondition,
  maxHp: number,
  toxicCounter: number,
): number {
  if (status === 'burn') return Math.max(1, Math.floor(maxHp * BURN_FRACTION));
  if (status === 'poison') return Math.max(1, Math.floor(maxHp * POISON_FRACTION));
  if (status === 'toxic') return Math.max(1, Math.floor((maxHp * Math.min(15, toxicCounter)) / 16));
  return 0;
}

export interface MoveGate {
  /** Whether the Pokémon may act this turn. */
  readonly canMove: boolean;
  /** A log line describing why it couldn't (or a flavour beat when it can). */
  readonly message?: string;
  /** The status after this gate (e.g. sleep/freeze may clear). */
  readonly status: StatusCondition;
  /** Remaining sleep turns after this gate. */
  readonly sleepTurns: number;
}

/**
 * Resolve whether a Pokémon can move through its non-volatile status.
 *
 * - Sleep: counts down; wakes (and acts) when the counter hits 0.
 * - Freeze: 20% thaw each turn (then acts), else stays frozen and can't move.
 * - Paralysis: 25% fully paralysed (can't move) per the `roll`.
 *
 * `roll` is a value in [0,1) from the seeded RNG.
 */
export function resolveMoveGate(
  name: string,
  status: StatusCondition,
  sleepTurns: number,
  roll: number,
): MoveGate {
  if (status === 'sleep') {
    if (sleepTurns <= 1) {
      return { canMove: true, message: `${name} woke up!`, status: 'none', sleepTurns: 0 };
    }
    return { canMove: false, message: `${name} is fast asleep.`, status: 'sleep', sleepTurns: sleepTurns - 1 };
  }
  if (status === 'freeze') {
    if (roll < 0.2) {
      return { canMove: true, message: `${name} thawed out!`, status: 'none', sleepTurns };
    }
    return { canMove: false, message: `${name} is frozen solid!`, status: 'freeze', sleepTurns };
  }
  if (status === 'paralysis' && roll < 0.25) {
    return { canMove: false, message: `${name} is paralysed! It can't move!`, status: 'paralysis', sleepTurns };
  }
  return { canMove: true, status, sleepTurns };
}

/** Initial sleep duration (1–3 turns), driven by the engine's RNG int. */
export function rollSleepTurns(rngInt: (min: number, max: number) => number): number {
  return rngInt(1, 3);
}

/** Burn halves physical attack; everything else is unaffected here. */
export function burnAttackFactor(status: StatusCondition): number {
  return status === 'burn' ? 0.5 : 1;
}

/** Paralysis quarters speed. */
export function paralysisSpeedFactor(status: StatusCondition): number {
  return status === 'paralysis' ? 0.5 : 1;
}

/** Human-readable "was inflicted" line. */
export function statusSetMessage(name: string, status: StatusCondition): string {
  switch (status) {
    case 'burn':
      return `${name} was burned!`;
    case 'poison':
      return `${name} was poisoned!`;
    case 'toxic':
      return `${name} was badly poisoned!`;
    case 'paralysis':
      return `${name} was paralysed! It may be unable to move!`;
    case 'sleep':
      return `${name} fell asleep!`;
    case 'freeze':
      return `${name} was frozen solid!`;
    default:
      return '';
  }
}

/** Residual "hurt by …" line. */
export function residualMessage(name: string, status: StatusCondition): string {
  switch (status) {
    case 'burn':
      return `${name} was hurt by its burn!`;
    case 'poison':
    case 'toxic':
      return `${name} was hurt by poison!`;
    default:
      return '';
  }
}
