import { Injectable, inject, signal } from '@angular/core';
import { GAUNTLET, type EliteTrainer } from '../../game/arena/elite-four';
import { dummyMatch, playerTrainer } from '../../game/arena/match-setup';
import type { Battler } from '../../game/engine';
import {
  trainerAvatar,
  type MatchOutcome,
  type PlayerMatchSetup,
  type Trainer,
} from '../../game/tournament';
import { ArenaProgressStore } from './arena-progress.store';
import { ArenaTeams } from './arena-teams.service';

const GAUNTLET_LEVEL = 75;
const STAGE_COINS = 60;
const CHAMPION_COINS = 300;

interface GauntletRun {
  readonly trainers: readonly EliteTrainer[];
  index: number;
  playerHp: number[];
}

export interface GauntletView {
  readonly stageLabel: string;
  readonly index: number;
  readonly total: number;
  readonly foeName: string;
}

/** What happens after a gauntlet match: keep going or the run is over (won the title / lost). */
export type GauntletStep = 'next' | 'over';

/**
 * The Champion Gauntlet: the Elite Four and the Champion back to back, HP carried between
 * fights. The Arena facade owns the screen status; this class owns the run.
 */
@Injectable({ providedIn: 'root' })
export class ArenaGauntlet {
  private readonly teams = inject(ArenaTeams);
  private readonly progress = inject(ArenaProgressStore);

  readonly setup = signal<PlayerMatchSetup | null>(null);
  readonly view = signal<GauntletView | null>(null);
  readonly result = signal<'won' | 'lost' | null>(null);

  private run: GauntletRun | null = null;
  private playerTeam: Battler[] = [];

  /** Assemble the player's team and load the first fight. Throws a readable Error on failure. */
  async start(): Promise<void> {
    this.result.set(null);
    this.playerTeam = this.teams.applyBadgeBoosts(
      await this.teams.buildPlayerTeam(GAUNTLET_LEVEL),
      this.progress.badges(),
    );
    if (!this.playerTeam.length) throw new Error('Assemble a team in the Team Builder first.');
    this.run = { trainers: GAUNTLET, index: 0, playerHp: this.playerTeam.map((m) => m.stats.hp) };
    await this.loadMatch();
  }

  /** Record a finished fight (coins, HP carry, crown). Call {@link loadMatch} on 'next'. */
  advance(outcome: MatchOutcome): GauntletStep {
    const run = this.run;
    if (!run) return 'over';
    if (!outcome.playerWon) {
      this.result.set('lost');
      this.end();
      return 'over';
    }
    run.playerHp = outcome.playerFinalHp;
    run.index += 1;
    this.progress.addCoins(STAGE_COINS);
    if (run.index >= run.trainers.length) {
      this.progress.addCoins(CHAMPION_COINS);
      this.progress.crown();
      this.result.set('won');
      this.end();
      return 'over';
    }
    return 'next';
  }

  end(): void {
    this.run = null;
    this.setup.set(null);
    this.view.set(null);
  }

  async loadMatch(): Promise<void> {
    const run = this.run!;
    const trainer = run.trainers[run.index]!;
    const foeTeam = await this.teams.buildEliteTeam(trainer);
    const player = playerTrainer(this.playerTeam, true);
    const foe: Trainer = {
      id: trainer.id,
      name: trainer.name,
      title: trainer.title,
      avatar: trainerAvatar(`${trainer.name}-${trainer.id}`, trainer.champion),
      team: foeTeam,
    };
    this.setup.set({
      match: dummyMatch(`gauntlet-${trainer.id}`, player, foe),
      round: 'final',
      player,
      foe,
      playerTeam: this.playerTeam,
      foeTeam,
      aiTier: 'elite',
      playerStartHp: run.playerHp.slice(),
    });
    this.view.set({
      stageLabel: trainer.champion ? 'Champion' : `Elite ${run.index + 1}`,
      index: run.index + 1,
      total: run.trainers.length,
      foeName: `${trainer.name}, ${trainer.title}`,
    });
  }
}
