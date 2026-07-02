/**
 * Experience & leveling — classic "medium-fast" growth where the total XP needed
 * to *be* level n is n³. Pure and deterministic.
 */

/** Total XP required to reach a given level (medium-fast: n³). */
export function xpForLevel(level: number): number {
  const l = Math.max(1, Math.min(100, Math.floor(level)));
  return l ** 3;
}

/** The level a given total-XP amount corresponds to (1–100). */
export function levelFromXp(xp: number): number {
  let level = 1;
  while (level < 100 && xpForLevel(level + 1) <= xp) level++;
  return level;
}

/**
 * XP a participant earns for knocking out a foe — a trimmed main-series formula
 * (base experience × foe level ÷ 7).
 */
export function xpYield(foeBaseExp: number, foeLevel: number): number {
  return Math.max(1, Math.floor((Math.max(1, foeBaseExp) * Math.max(1, foeLevel)) / 7));
}

/**
 * XP actually granted to a party member after a win: participants earn the full
 * yield, benched members earn half — but only when the trainer owns an EXP Share
 * (otherwise they learn nothing from watching).
 */
export function shareXp(gain: number, participated: boolean, hasExpShare: boolean): number {
  const g = Math.max(0, Math.floor(gain));
  if (participated) return g;
  return hasExpShare ? Math.floor(g / 2) : 0;
}

export interface XpResult {
  /** New total XP. */
  readonly xp: number;
  /** New level. */
  readonly level: number;
  /** Each level gained this time, ascending (for level-up messages). */
  readonly leveledTo: number[];
}

/** Add gained XP to a mon's totals, returning the new level and any level-ups. */
export function applyXp(currentXp: number, currentLevel: number, gained: number): XpResult {
  // Never let total fall below the floor for the current level.
  const xp = Math.max(currentXp, xpForLevel(currentLevel)) + Math.max(0, Math.floor(gained));
  const level = Math.max(currentLevel, levelFromXp(xp));
  const leveledTo: number[] = [];
  for (let l = currentLevel + 1; l <= level; l++) leveledTo.push(l);
  return { xp, level, leveledTo };
}

/** Progress through the current level band — for an XP bar. */
export function xpProgress(xp: number, level: number): { into: number; span: number; pct: number } {
  const base = xpForLevel(level);
  const next = xpForLevel(Math.min(100, level + 1));
  const span = Math.max(1, next - base);
  const into = Math.max(0, Math.min(span, xp - base));
  return { into, span, pct: Math.round((into / span) * 100) };
}
