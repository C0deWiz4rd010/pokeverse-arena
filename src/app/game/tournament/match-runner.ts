/**
 * Pure helpers that run a knockout bracket: round-scaled teams, mode rules, the player's
 * pending match and the CPU auto-resolver. The Angular facade only holds the signals.
 */
import { POKEMON_TYPES } from '../../core/utils/type-chart';
import { SeededRng } from '../../core/utils/rng';
import type { Battler, BattleRules } from '../engine';
import { nextReadyMatch, playerMatch, reportResult } from './bracket';
import { levelForRound, type TournamentMode } from './modes';
import { simulateMatch } from './simulate';
import { scaleStats } from './trainers';
import type { Bracket, PlayerMatchSetup, RoundId, Trainer } from './types';

/** Mode-imposed battle rules (inverse chart / type-boosting weather) for a match keyed by `seedKey`. */
export function rulesForMode(
  mode: TournamentMode | null,
  seedKey: string,
): BattleRules | undefined {
  if (!mode) return undefined;
  if (mode.inverse) return { inverse: true };
  if (mode.weather) {
    const rng = new SeededRng(`weather-${seedKey}`);
    return { weatherBoostType: rng.pick([...POKEMON_TYPES]) };
  }
  return undefined;
}

/** Opponent teams scale up each round in Boss Ascent; the player stays fixed. */
export function teamForRound(mode: TournamentMode | null, t: Trainer, round: RoundId): Battler[] {
  if (!mode?.ascend || t.isPlayer) return t.team;
  const level = levelForRound(mode, round);
  const factor = level / mode.baseLevel;
  return t.team.map((b) => ({ ...b, level, stats: scaleStats(b.stats, factor) }));
}

/** True while the player still has an unplayed match somewhere in the bracket. */
export function anyPlayerRemaining(b: Bracket): boolean {
  return Object.values(b.rounds)
    .flat()
    .some((m) => (m.a?.isPlayer || m.b?.isPlayer) && !m.played);
}

/** Everything the interactive player match needs, or null when none is pending. */
export function bracketMatchSetup(
  b: Bracket | null,
  mode: TournamentMode | null,
  carry: ReadonlyMap<string, number[]>,
): PlayerMatchSetup | null {
  if (!b || !mode) return null;
  const pm = playerMatch(b);
  if (!pm) return null;
  const playerIsA = !!pm.a?.isPlayer;
  const player = (playerIsA ? pm.a : pm.b) as Trainer;
  const foe = (playerIsA ? pm.b : pm.a) as Trainer;
  return {
    match: pm,
    round: pm.round,
    player,
    foe,
    playerTeam: player.team,
    foeTeam: teamForRound(mode, foe, pm.round),
    rules: rulesForMode(mode, pm.id),
    playerStartHp: mode.hpCarry ? carry.get(player.id) : undefined,
    foeStartHp: mode.hpCarry ? carry.get(foe.id) : undefined,
  };
}

/**
 * Auto-resolve every CPU match up to the player's next match (or the champion).
 * Survival HP is written into `carry`. Returns the advanced bracket.
 */
export function runAiMatches(
  bracket: Bracket,
  mode: TournamentMode,
  carry: Map<string, number[]>,
): Bracket {
  let b = bracket;
  let m = nextReadyMatch(b);
  let guard = 0;
  while (m && !(m.a?.isPlayer || m.b?.isPlayer) && guard++ < 32) {
    const res = simulateMatch(
      teamForRound(mode, m.a as Trainer, m.round),
      teamForRound(mode, m.b as Trainer, m.round),
      `sim-${m.id}`,
      {
        rules: rulesForMode(mode, m.id),
        startHpA: mode.hpCarry ? carry.get((m.a as Trainer).id) : undefined,
        startHpB: mode.hpCarry ? carry.get((m.b as Trainer).id) : undefined,
      },
    );
    if (mode.hpCarry) {
      const winner = res.winner === 0 ? (m.a as Trainer) : (m.b as Trainer);
      carry.set(winner.id, res.winner === 0 ? res.hpA : res.hpB);
    }
    b = reportResult(b, m.id, res.winner);
    m = nextReadyMatch(b);
  }
  return b;
}
