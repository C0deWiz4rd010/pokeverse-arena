/**
 * Round-robin / Swiss league run. Plain state machine: CPU fixtures resolve automatically
 * until the player's next match, which is exposed as {@link League.match}.
 */
import type { BracketFormat } from './format';
import { rulesForMode } from './match-runner';
import type { TournamentMode } from './modes';
import {
  pairKey,
  roundRobinSchedule,
  swissPairings,
  swissRounds,
  type Fixture,
} from './round-robin';
import { simulateMatch } from './simulate';
import { applyMatch, initStandings, rankStandings, type Standing } from './standings';
import type { PlayerMatchSetup, Trainer } from './types';

/** Final result of a league, reported once. */
export interface LeagueFinish {
  readonly ranked: Standing[];
  readonly champion: Trainer | null;
  /** 1-based placement of the player (0 when they are not listed). */
  readonly placement: number;
  readonly field: number;
}

export class League {
  standings: Standing[];
  /** The player's pending interactive match, or null. */
  match: PlayerMatchSetup | null = null;

  private readonly byId: Map<string, Trainer>;
  private fixtures: Fixture[];
  private cursor = 0;
  private readonly played = new Set<string>();
  private swissRound = 1;
  private readonly swissTotal: number;
  private pending: { fixture: Fixture; playerIsA: boolean } | null = null;

  constructor(
    private readonly format: Exclude<BracketFormat, 'single-elim'>,
    trainers: readonly Trainer[],
    private readonly teamSize: number,
    private readonly mode: TournamentMode | null,
  ) {
    this.standings = initStandings(trainers);
    const ids = trainers.map((t) => t.id);
    this.swissTotal = format === 'swiss' ? swissRounds(ids.length) : 0;
    this.fixtures =
      format === 'round-robin'
        ? roundRobinSchedule(ids).flat()
        : swissPairings(this.standings, new Set());
    this.byId = new Map(trainers.map((t) => [t.id, t]));
  }

  /** Resolve CPU fixtures until the player's next match, or finish the league. */
  advance(): LeagueFinish | null {
    let guard = 0;
    while (this.cursor < this.fixtures.length && guard++ < 256) {
      const fx = this.fixtures[this.cursor]!;
      const a = this.byId.get(fx.aId)!;
      const b = this.byId.get(fx.bId)!;
      if (a.isPlayer || b.isPlayer) {
        this.expose(fx, a, b);
        return null;
      }
      const res = simulateMatch(a.team, b.team, `lg-${this.format}-${fx.aId}-${fx.bId}`, {
        rules: rulesForMode(this.mode, `${fx.aId}-${fx.bId}`),
      });
      this.record(fx, res.winner, res.survivorsA, res.survivorsB);
      this.cursor++;
    }
    // Round exhausted: Swiss may have more rounds.
    if (this.format === 'swiss' && this.swissRound < this.swissTotal) {
      this.swissRound++;
      this.fixtures = swissPairings(this.standings, this.played);
      this.cursor = 0;
      return this.advance();
    }
    return this.finish();
  }

  /**
   * Record the player's result for the pending fixture, then resolve onward.
   * Returns null when no match was pending.
   */
  recordPlayerOutcome(
    playerWon: boolean,
    playerFinalHp?: number[],
  ): { foeIsRival: boolean; finish: LeagueFinish | null } | null {
    if (!this.pending) return null;
    const { fixture, playerIsA } = this.pending;
    const foe = this.byId.get(playerIsA ? fixture.bId : fixture.aId);
    const playerSurv = (playerFinalHp ?? []).filter((h) => h > 0).length;
    const aSurv = playerIsA ? playerSurv : playerWon ? 0 : 1;
    const bSurv = playerIsA ? (playerWon ? 0 : 1) : playerSurv;
    const winner: 0 | 1 = playerIsA === playerWon ? 0 : 1;
    this.record(fixture, winner, aSurv, bSurv);
    this.pending = null;
    this.cursor++;
    this.match = null;
    return { foeIsRival: !!foe?.isRival, finish: this.advance() };
  }

  private expose(fx: Fixture, a: Trainer, b: Trainer): void {
    const playerIsA = !!a.isPlayer;
    const player = playerIsA ? a : b;
    const foe = playerIsA ? b : a;
    this.pending = { fixture: fx, playerIsA };
    this.match = {
      match: {
        id: `lg-${fx.aId}-${fx.bId}`,
        round: 'final',
        slot: 0,
        a: player,
        b: foe,
        winner: null,
        played: false,
      },
      round: 'final',
      player,
      foe,
      playerTeam: player.team,
      foeTeam: foe.team,
      aiTier: 'strong',
    };
  }

  private record(fx: Fixture, winner: 0 | 1, survivorsA: number, survivorsB: number): void {
    this.standings = applyMatch(
      this.standings,
      fx.aId,
      fx.bId,
      { winner, survivorsA, survivorsB },
      this.teamSize,
    );
    this.played.add(pairKey(fx.aId, fx.bId));
  }

  private finish(): LeagueFinish {
    const ranked = rankStandings(this.standings);
    const championId = ranked[0]?.trainerId;
    const champion = championId ? (this.byId.get(championId) ?? null) : null;
    this.match = null;
    return {
      ranked,
      champion,
      placement: ranked.findIndex((s) => s.isPlayer) + 1,
      field: ranked.length,
    };
  }
}
