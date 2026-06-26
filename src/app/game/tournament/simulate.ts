/**
 * Headless 3-vs-3 (N-v-N) match simulation.
 *
 * Runs on the party-aware {@link TeamBattle} engine, so CPU matches share the
 * full mechanical depth — persistent weather/terrain/hazards, status, stat
 * stages, abilities and items — and the AI may **switch** a badly-outmatched
 * Pokémon, not just send in the next on a KO. Callers may seed starting HP
 * (Survival mode carries HP across rounds) and read the final HP back.
 */
import { TeamBattle, type AiTier, type Battler, type BattleRules } from '../engine';
import type { MatchResult } from './types';

export interface SimulateOpts {
  readonly rules?: BattleRules;
  readonly aiTier?: AiTier;
  /** Starting HP for each team-A member (defaults to full). */
  readonly startHpA?: readonly number[];
  /** Starting HP for each team-B member (defaults to full). */
  readonly startHpB?: readonly number[];
}

/** Safety cap so a pathological stall can never loop forever. */
const MAX_TURNS = 600;

/**
 * Simulate a full team match and return the winner plus the final HP of every
 * Pokémon on both sides.
 */
export function simulateMatch(
  teamA: readonly Battler[],
  teamB: readonly Battler[],
  seed: string,
  opts: SimulateOpts = {},
): MatchResult {
  const tb = new TeamBattle(teamA, teamB, seed, {
    rules: opts.rules,
    aiTier: opts.aiTier ?? 'strong',
    startHpA: opts.startHpA,
    startHpB: opts.startHpB,
  });
  const log: string[] = [];

  let guard = 0;
  while (!tb.state.finished && guard++ < MAX_TURNS) {
    // Bring in replacements for any fainted active Pokémon first.
    let safety = 0;
    while ((tb.mustSwitch(0) || tb.mustSwitch(1)) && safety++ < 12) {
      if (tb.mustSwitch(0)) collect(tb.autoForceSwitch(0), log);
      if (tb.mustSwitch(1)) collect(tb.autoForceSwitch(1), log);
    }
    if (tb.state.finished) break;
    collect(tb.takeTurn(tb.chooseAction(0), tb.chooseAction(1)), log);
  }

  const hpA = tb.hp(0);
  const hpB = tb.hp(1);
  const survivorsA = tb.survivors(0);
  const survivorsB = tb.survivors(1);
  const winner: 0 | 1 = decideWinner(tb.state.winner, survivorsA, survivorsB, hpA, hpB, teamA, teamB);
  return { winner, log, survivorsA, survivorsB, hpA, hpB };
}

function collect(events: ReturnType<TeamBattle['takeTurn']>, log: string[]): void {
  for (const ev of events) {
    if (ev.kind === 'faint') log.push(`${ev.name} fainted`);
  }
}

/** Use the engine's winner, or break a stalemate on surviving count then HP fraction. */
function decideWinner(
  engineWinner: 0 | 1 | null,
  survivorsA: number,
  survivorsB: number,
  hpA: number[],
  hpB: number[],
  teamA: readonly Battler[],
  teamB: readonly Battler[],
): 0 | 1 {
  if (engineWinner !== null) return engineWinner;
  if (survivorsA !== survivorsB) return survivorsA > survivorsB ? 0 : 1;
  return hpFraction(hpA, teamA) >= hpFraction(hpB, teamB) ? 0 : 1;
}

function hpFraction(hp: number[], team: readonly Battler[]): number {
  const total = team.reduce((sum, m) => sum + m.stats.hp, 0);
  const left = hp.reduce((sum, v) => sum + Math.max(0, v), 0);
  return total > 0 ? left / total : 0;
}
