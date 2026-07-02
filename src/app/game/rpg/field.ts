/**
 * Overworld field effects — pure, framework-free helpers applied as the player
 * walks. Currently: residual poison damage (classic "poisoned Pokémon lose HP in
 * the field"). Kept dependency-light so it stays unit-testable.
 */
import type { PartyMon } from './rpg-types';

/** HP each poisoned party member loses per field tick. */
export const FIELD_POISON_DAMAGE = 1;
/** Walkable steps between field-status ticks. */
export const FIELD_STEP_INTERVAL = 4;

export interface FieldStatusResult {
  readonly party: PartyMon[];
  /** Display names of members that took poison damage this tick. */
  readonly hurt: readonly string[];
}

/**
 * Apply overworld poison to every poisoned, non-fainted party member. Members
 * never faint from field poison — HP is clamped at a minimum of 1 (modern-era
 * behaviour), so the player is nudged toward a Pokémon Center without a wipe.
 */
export function applyFieldPoison(party: readonly PartyMon[]): FieldStatusResult {
  const hurt: string[] = [];
  const next = party.map((m) => {
    const poisoned = m.status === 'poison' || m.status === 'toxic';
    if (poisoned && m.currentHp > 1) {
      hurt.push(m.nickname ?? m.species);
      return { ...m, currentHp: Math.max(1, m.currentHp - FIELD_POISON_DAMAGE) };
    }
    return m;
  });
  return { party: next, hurt };
}
