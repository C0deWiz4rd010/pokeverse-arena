/**
 * Pre-match scouting — a quick type-matchup read of the player's team against a
 * foe team, shown before a tournament battle. Pure and framework-free (only the
 * static type chart) so it stays deterministic and unit-testable.
 */
import type { Battler } from '../engine';
import { effectiveness, type PokemonType } from '../../core/utils/type-chart';

export interface ScoutReport {
  /** Foe members some attacker on your team hits super-effectively (≥2×). */
  readonly advantage: number;
  /** Your members some attacker on the foe team hits super-effectively. */
  readonly threat: number;
  /** Foe team size (denominator for the advantage figure). */
  readonly total: number;
}

/** Best offensive multiplier any attacker's STAB type lands on `defenders`. */
function bestStab(team: readonly Battler[], defenders: readonly PokemonType[]): number {
  let best = 0;
  for (const m of team) {
    for (const ty of m.types) {
      const mult = effectiveness(ty, defenders);
      if (mult > best) best = mult;
    }
  }
  return best;
}

/**
 * Count how many foe Pokémon your team threatens super-effectively, and how many
 * of yours the foe team threatens back — a compact "who has the type edge" read.
 */
export function scoutMatchup(
  playerTeam: readonly Battler[],
  foeTeam: readonly Battler[],
): ScoutReport {
  const advantage = foeTeam.filter((f) => bestStab(playerTeam, f.types) >= 2).length;
  const threat = playerTeam.filter((p) => bestStab(foeTeam, p.types) >= 2).length;
  return { advantage, threat, total: foeTeam.length };
}

/** A recommended lead: the team member with the strongest read on the foe team. */
export interface LeadPick {
  /** Name of the suggested lead. */
  readonly name: string;
  /** How many foe Pokémon its STAB threatens super-effectively. */
  readonly offense: number;
  /** How many foe Pokémon threaten it super-effectively. */
  readonly risk: number;
}

/**
 * Suggest the best Pokémon to lead with: the one whose type edge (foes it
 * threatens minus foes that threaten it) is highest. Ties break toward more
 * offence, then less risk. Returns `null` for an empty team.
 */
export function bestLead(
  playerTeam: readonly Battler[],
  foeTeam: readonly Battler[],
): LeadPick | null {
  let pick: LeadPick | null = null;
  let bestScore = -Infinity;
  for (const mon of playerTeam) {
    const offense = foeTeam.filter((f) => bestStab([mon], f.types) >= 2).length;
    const risk = foeTeam.filter((f) => bestStab([f], mon.types) >= 2).length;
    const score = offense - risk;
    if (
      score > bestScore ||
      (score === bestScore && pick !== null && (offense > pick.offense ||
        (offense === pick.offense && risk < pick.risk)))
    ) {
      bestScore = score;
      pick = { name: mon.name, offense, risk };
    }
  }
  return pick;
}
