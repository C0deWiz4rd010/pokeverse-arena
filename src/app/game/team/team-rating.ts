import {
  POKEMON_TYPES,
  singleEffectiveness,
  analyzeTeamTypes,
  type PokemonType,
  type TeamMemberTyping,
} from '../../core/utils/type-chart';

export interface TeamRating {
  /** Overall power score, 0–100. */
  readonly score: number;
  /** Letter grade derived from the score (S / A / B / C / D). */
  readonly grade: 'S' | 'A' | 'B' | 'C' | 'D';
  /** Defending types at least one member can hit super-effectively (of 18). */
  readonly offense: number;
  /** Attacking types resisted by at least one member (of 18). */
  readonly defense: number;
  /** Short qualitative verdict. */
  readonly verdict: string;
}

const TOTAL_TYPES = POKEMON_TYPES.length; // 18

/**
 * Rates a roster on offensive coverage and defensive resilience using only the
 * static type chart — no network needed, so it's deterministic and testable.
 *
 * - Offense: how many of the 18 defending types at least one member's STAB
 *   type hits for ≥2×.
 * - Defense: how many of the 18 attacking types are resisted by ≥1 member.
 */
export function rateTeam(team: readonly TeamMemberTyping[]): TeamRating {
  if (!team.length) {
    return { score: 0, grade: 'D', offense: 0, defense: 0, verdict: 'Add Pokémon to rate your squad.' };
  }

  const offense = POKEMON_TYPES.filter((defender) =>
    team.some((m) => m.types.some((atk) => singleEffectiveness(atk, defender) >= 2)),
  ).length;

  const { resistances } = analyzeTeamTypes(team);
  const defense = POKEMON_TYPES.filter((atk) => resistances[atk] > 0).length;

  const score = Math.round(((offense / TOTAL_TYPES) * 0.5 + (defense / TOTAL_TYPES) * 0.5) * 100);
  const grade: TeamRating['grade'] =
    score >= 85 ? 'S' : score >= 70 ? 'A' : score >= 55 ? 'B' : score >= 40 ? 'C' : 'D';

  return { score, grade, offense, defense, verdict: verdictFor(offense, defense) };
}

function verdictFor(offense: number, defense: number): string {
  if (offense >= 13 && defense >= 13) return 'Elite balance — hits hard and holds the line.';
  if (offense - defense >= 4) return 'Offensively loaded — shore up your defensive gaps.';
  if (defense - offense >= 4) return 'Defensively solid — add more offensive coverage.';
  if (offense >= 10 && defense >= 10) return 'Well-rounded squad with room to refine.';
  return 'Unbalanced — broaden your typing for better coverage.';
}
