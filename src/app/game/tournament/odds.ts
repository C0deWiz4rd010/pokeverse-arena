/**
 * Pre-match odds — a light, deterministic estimate of the player's win chance
 * against a foe team, shown before a tournament battle for tension. Pure and
 * framework-free so it stays unit-testable; this is flavour, not the battle sim.
 */
import type { Battler } from '../engine';

/**
 * A single team's "power": summed base stats (BST) across the team, scaled by
 * average level so higher-level fields (Boss Ascent) read as stronger.
 */
export function teamPower(team: readonly Battler[]): number {
  if (!team.length) return 0;
  let bst = 0;
  let levels = 0;
  for (const m of team) {
    bst += Object.values(m.stats).reduce((a, b) => a + b, 0);
    levels += m.level;
  }
  const avgLevel = levels / team.length;
  return Math.round(bst * (avgLevel / 50));
}

/**
 * The player's estimated win probability as a whole percentage (5–95, never a
 * certainty). Uses a logistic curve over the two teams' power ratio so small
 * edges stay close to a coin-flip and large edges approach — but never reach —
 * a lock.
 */
export function winOdds(playerTeam: readonly Battler[], foeTeam: readonly Battler[]): number {
  const p = teamPower(playerTeam);
  const f = teamPower(foeTeam);
  if (p <= 0 && f <= 0) return 50;
  // Logistic on the log-ratio keeps the curve symmetric and bounded.
  const ratio = (p + 1) / (f + 1);
  const prob = 1 / (1 + Math.pow(ratio, -1.6));
  return Math.max(5, Math.min(95, Math.round(prob * 100)));
}
