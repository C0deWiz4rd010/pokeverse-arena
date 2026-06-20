/**
 * Headless 3-vs-3 match simulation.
 *
 * Reuses the deterministic single {@link Battle} engine for each duel and runs a
 * sequential-KO format: when a Pokémon faints the next one steps in, while the
 * surviving Pokémon keeps the damage it has taken *within the match*. Callers
 * may seed starting HP (Survival mode carries HP across rounds) and read the
 * final HP back from the result.
 */
import { Battle, type Battler, type BattleRules } from '../engine';
import type { MatchResult } from './types';

export interface SimulateOpts {
  readonly rules?: BattleRules;
  /** Starting HP for each team-A member (defaults to full). */
  readonly startHpA?: readonly number[];
  /** Starting HP for each team-B member (defaults to full). */
  readonly startHpB?: readonly number[];
}

/** Safety cap so a pathological stall can never loop forever. */
const MAX_TURNS_PER_DUEL = 300;

function clampHp(hp: number, maxHp: number): number {
  if (!Number.isFinite(hp)) return maxHp;
  return Math.max(0, Math.min(hp, maxHp));
}

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
  const hpA = teamA.map((m, i) => clampHp(opts.startHpA?.[i] ?? m.stats.hp, m.stats.hp));
  const hpB = teamB.map((m, i) => clampHp(opts.startHpB?.[i] ?? m.stats.hp, m.stats.hp));
  const log: string[] = [];

  let ia = skipFainted(hpA, 0);
  let ib = skipFainted(hpB, 0);
  let duel = 0;

  while (ia < teamA.length && ib < teamB.length) {
    const a = teamA[ia];
    const b = teamB[ib];
    const battle = new Battle(a, b, `${seed}-d${duel}`, opts.rules);
    battle.state.sides[0].currentHp = clampHp(hpA[ia], battle.state.sides[0].maxHp);
    battle.state.sides[1].currentHp = clampHp(hpB[ib], battle.state.sides[1].maxHp);

    let guard = 0;
    while (!battle.state.finished && guard++ < MAX_TURNS_PER_DUEL) {
      battle.takeTurn(battle.autoPlayerMove());
    }

    hpA[ia] = battle.state.sides[0].currentHp;
    hpB[ib] = battle.state.sides[1].currentHp;

    if (battle.state.winner === 0) {
      log.push(`${a.name} beat ${b.name}`);
      ib = skipFainted(hpB, ib + 1);
    } else if (battle.state.winner === 1) {
      log.push(`${b.name} beat ${a.name}`);
      ia = skipFainted(hpA, ia + 1);
    } else {
      // Stalemate guard tripped — award the duel on remaining HP fraction.
      const fa = hpA[ia] / battle.state.sides[0].maxHp;
      const fb = hpB[ib] / battle.state.sides[1].maxHp;
      if (fa >= fb) {
        log.push(`${a.name} outlasted ${b.name}`);
        ib = skipFainted(hpB, ib + 1);
      } else {
        log.push(`${b.name} outlasted ${a.name}`);
        ia = skipFainted(hpA, ia + 1);
      }
    }
    duel++;
  }

  const survivorsA = hpA.filter((hp) => hp > 0).length;
  const survivorsB = hpB.filter((hp) => hp > 0).length;
  const winner: 0 | 1 = ib >= teamB.length ? 0 : 1;
  return { winner, log, survivorsA, survivorsB, hpA, hpB };
}

/** Advance an index past any already-fainted members. */
function skipFainted(hp: number[], from: number): number {
  let i = from;
  while (i < hp.length && hp[i] <= 0) i++;
  return i;
}
