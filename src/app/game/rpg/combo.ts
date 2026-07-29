/**
 * Catch combos — chain-catching the same species (Let's-Go style) pays off:
 * the chained species rolls better shiny odds and grants bonus XP. The chain
 * bumps on every successful catch of the same species, resets to 1 on a new
 * species, and breaks when a wild battle ends without a catch. Pure + tested.
 */

export interface CatchCombo {
  readonly species: string;
  readonly count: number;
}

/** Extend the chain with a fresh catch (same species stacks, new one restarts). */
export function bumpCombo(combo: CatchCombo | undefined, species: string): CatchCombo {
  if (combo && combo.species === species) return { species, count: combo.count + 1 };
  return { species, count: 1 };
}

/** Shiny-odds multiplier for the chained species (1× → 8× at a 20 chain). */
export function comboShinyMultiplier(count: number): number {
  if (count >= 20) return 8;
  if (count >= 10) return 4;
  if (count >= 5) return 2;
  return 1;
}

/** XP multiplier for battles against the chained species (caps at +50 %). */
export function comboXpMultiplier(count: number): number {
  return 1 + Math.min(0.5, Math.max(0, count) * 0.05);
}

/** Combo tier label for the HUD (null below a visible chain). */
export function comboLabel(combo: CatchCombo | undefined): string | null {
  if (!combo || combo.count < 2) return null;
  return `${combo.count}× ${combo.species}`;
}
