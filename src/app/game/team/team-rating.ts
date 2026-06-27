import {
  POKEMON_TYPES,
  singleEffectiveness,
  analyzeTeamTypes,
  type PokemonType,
  type TeamMemberTyping,
} from '../../core/utils/type-chart';
import { titleCase } from '../../core/ui/format';

export interface StackedWeakness {
  readonly type: PokemonType;
  /** How many team members are weak to this attacking type. */
  readonly count: number;
  /** Whether anyone resists it (a stacked weakness with no answer is dangerous). */
  readonly covered: boolean;
}

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
  /** Attacking types two or more members share a weakness to. */
  readonly stackedWeaknesses: StackedWeakness[];
  /** Defending types the team has no super-effective answer to. */
  readonly coverageGaps: PokemonType[];
  /** Concrete, actionable improvement tips. */
  readonly suggestions: string[];
}

const TOTAL_TYPES = POKEMON_TYPES.length; // 18

/**
 * Rates a roster on offensive coverage and defensive resilience using the static
 * type chart, then surfaces *why* — stacked shared weaknesses, offensive blind
 * spots and concrete suggestions. Deterministic and network-free.
 */
export function rateTeam(team: readonly TeamMemberTyping[]): TeamRating {
  if (!team.length) {
    return {
      score: 0,
      grade: 'D',
      offense: 0,
      defense: 0,
      verdict: 'Add Pokémon to rate your squad.',
      stackedWeaknesses: [],
      coverageGaps: [],
      suggestions: ['Add Pokémon to build a rating.'],
    };
  }

  const offense = POKEMON_TYPES.filter((defender) =>
    team.some((m) => m.types.some((atk) => singleEffectiveness(atk, defender) >= 2)),
  ).length;

  const { weaknesses, resistances } = analyzeTeamTypes(team);
  const defense = POKEMON_TYPES.filter((atk) => resistances[atk] > 0).length;

  const stackedWeaknesses: StackedWeakness[] = POKEMON_TYPES.filter((atk) => weaknesses[atk] >= 2)
    .map((type) => ({ type, count: weaknesses[type], covered: resistances[type] > 0 }))
    .sort((a, b) => b.count - a.count);

  const coverageGaps = POKEMON_TYPES.filter(
    (defender) => !team.some((m) => m.types.some((atk) => singleEffectiveness(atk, defender) >= 2)),
  );

  const score = Math.round(((offense / TOTAL_TYPES) * 0.5 + (defense / TOTAL_TYPES) * 0.5) * 100);
  const grade: TeamRating['grade'] =
    score >= 85 ? 'S' : score >= 70 ? 'A' : score >= 55 ? 'B' : score >= 40 ? 'C' : 'D';

  return {
    score,
    grade,
    offense,
    defense,
    verdict: verdictFor(offense, defense),
    stackedWeaknesses,
    coverageGaps,
    suggestions: buildSuggestions(offense, defense, stackedWeaknesses, coverageGaps),
  };
}

function buildSuggestions(
  offense: number,
  defense: number,
  stacked: StackedWeakness[],
  gaps: PokemonType[],
): string[] {
  const tips: string[] = [];
  const dangerous = stacked.filter((s) => !s.covered);
  if (dangerous.length) {
    const list = dangerous.slice(0, 3).map((s) => `${titleCase(s.type)} (×${s.count})`).join(', ');
    tips.push(`Shared weakness with no resist: ${list}. Add a Pokémon that resists it.`);
  } else if (stacked.length) {
    tips.push(`Several members share a ${titleCase(stacked[0].type)} weakness — keep a resist in the back.`);
  }
  if (gaps.length >= 3) {
    tips.push(`No super-effective answer to ${gaps.slice(0, 3).map(titleCase).join(', ')}. Broaden your attacking types.`);
  }
  if (offense < 9) tips.push('Offensive coverage is thin — add a different STAB type.');
  if (defense < 9) tips.push('Few resistances — add a bulky, resistant typing.');
  if (!tips.length) tips.push('Balanced and resilient — a tournament-ready core.');
  return tips;
}

function verdictFor(offense: number, defense: number): string {
  if (offense >= 13 && defense >= 13) return 'Elite balance — hits hard and holds the line.';
  if (offense - defense >= 4) return 'Offensively loaded — shore up your defensive gaps.';
  if (defense - offense >= 4) return 'Defensively solid — add more offensive coverage.';
  if (offense >= 10 && defense >= 10) return 'Well-rounded squad with room to refine.';
  return 'Unbalanced — broaden your typing for better coverage.';
}
