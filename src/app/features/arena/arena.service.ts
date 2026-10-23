import { Injectable, computed, inject, signal } from '@angular/core';
import { typeColorVar } from '../../core/ui/format';
import type { PokemonType } from '../../core/utils/type-chart';
import type { Battler } from '../../game/engine';
import {
  trainerAvatar,
  type MatchOutcome,
  type PlayerMatchSetup,
  type Trainer,
} from '../../game/tournament';
import {
  LEADER_LADDER,
  leaderLevel,
  leaderTier,
  type GymLeader,
} from '../../game/arena/gym-leaders';
import {
  arenaProgress,
  badgeBoostSummary,
  buildLadder,
  starsFor,
} from '../../game/arena/gym-progression';
import { gauntletUnlocked } from '../../game/arena/elite-four';
import { dummyMatch, playerTrainer } from '../../game/arena/match-setup';
import { ArenaGauntlet } from './arena-gauntlet.service';
import { ArenaProgressStore } from './arena-progress.store';
import { ArenaTeams, TEAM_SIZE } from './arena-teams.service';

export type { GauntletView } from './arena-gauntlet.service';

type Status = 'hub' | 'loading' | 'intro' | 'battle' | 'reward' | 'gauntlet' | 'error';

const REMATCH_BONUS_LEVEL = 12;

/** The pre-battle "VS" splash context. */
export interface IntroView {
  readonly leader: GymLeader;
  readonly level: number;
  readonly rematch: boolean;
  readonly foeTeam: Battler[];
  readonly playerTeam: Battler[];
  readonly boostSummary: string;
}

/** The post-battle reward summary. */
export interface ArenaReward {
  readonly leader: GymLeader;
  readonly won: boolean;
  readonly stars: 0 | 1 | 2 | 3;
  readonly bestStars: number;
  readonly coins: number;
  readonly firstClear: boolean;
  readonly gauntletJustUnlocked: boolean;
}

/**
 * Arena hub: a designed gym ladder with thematic battlefields, badge boosts, star
 * ratings, a pre-battle VS splash, a reward sequence, rematches, and a Champion
 * Gauntlet. Battles run through the shared deep-engine match component. Progress lives
 * in {@link ArenaProgressStore}, team building in {@link ArenaTeams} and the Elite Four run
 * in {@link ArenaGauntlet}.
 */
@Injectable({ providedIn: 'root' })
export class ArenaService {
  private readonly teams = inject(ArenaTeams);
  private readonly progressStore = inject(ArenaProgressStore);
  private readonly gauntlet = inject(ArenaGauntlet);

  readonly leaders = LEADER_LADDER;

  readonly status = signal<Status>('hub');
  readonly error = signal<string | null>(null);
  readonly setup = signal<PlayerMatchSetup | null>(null);
  readonly activeLeader = signal<GymLeader | null>(null);
  readonly intro = signal<IntroView | null>(null);
  readonly reward = signal<ArenaReward | null>(null);

  readonly badges = this.progressStore.badges;
  readonly isChampion = this.progressStore.isChampion;
  readonly coins = this.progressStore.coins;
  readonly stars = this.progressStore.stars;

  readonly earnedCount = computed(() => this.badges().size);
  readonly total = computed(() => this.leaders.length);
  readonly ladder = computed(() => buildLadder(this.badges()));
  readonly progress = computed(() => arenaProgress(this.badges()));
  readonly gauntletOpen = computed(() => gauntletUnlocked(this.badges()));
  readonly boostSummary = computed(() => badgeBoostSummary(this.badges()));
  readonly totalStars = computed(() => Object.values(this.stars()).reduce((a, b) => a + b, 0));

  readonly gauntletSetup = this.gauntlet.setup;
  readonly gauntletView = this.gauntlet.view;
  readonly gauntletResult = this.gauntlet.result;

  private isRematch = false;

  hasBadge(type: PokemonType): boolean {
    return this.progressStore.hasBadge(type);
  }

  starsFor(type: PokemonType): number {
    return this.progressStore.starsFor(type);
  }

  /* ---------------------------------------------------------- single gym */

  /** Prepare a challenge and show the VS splash (does not start the battle yet). */
  async challenge(leader: GymLeader, rematch = false): Promise<void> {
    this.status.set('loading');
    this.error.set(null);
    this.reward.set(null);
    this.isRematch = rematch;
    this.activeLeader.set(leader);
    try {
      const level = leaderLevel(leader.order) + (rematch ? REMATCH_BONUS_LEVEL : 0);
      const [foeTeam, rawPlayerTeam] = await Promise.all([
        this.teams.buildLeaderTeam(leader, level, rematch),
        this.teams.buildPlayerTeam(level),
      ]);
      if (!foeTeam.length || !rawPlayerTeam.length)
        throw new Error('Could not assemble a team for this challenge.');
      const playerTeam = this.teams.applyBadgeBoosts(rawPlayerTeam, this.badges());

      const foe: Trainer = {
        id: `leader-${leader.type}`,
        name: leader.name,
        title: leader.title,
        avatar: trainerAvatar(`${leader.name}-${leader.type}`, rematch),
        team: foeTeam,
      };
      const player = playerTrainer(playerTeam);
      this.setup.set({
        match: dummyMatch(`gym-${leader.type}${rematch ? '-r' : ''}`, player, foe),
        round: 'final',
        player,
        foe,
        playerTeam,
        foeTeam,
        aiTier: rematch ? 'elite' : leaderTier(leader.order),
        field: leader.gymField,
        accent: typeColorVar(leader.type),
        foeAce: leader.dialogue.ace,
      });
      this.intro.set({
        leader,
        level,
        rematch,
        foeTeam,
        playerTeam,
        boostSummary: this.boostSummary(),
      });
      this.status.set('intro');
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Something went wrong. Try again.');
      this.status.set('error');
      this.activeLeader.set(null);
    }
  }

  rematch(leader: GymLeader): void {
    void this.challenge(leader, true);
  }

  /** Commit the VS splash → enter the battle. */
  beginBattle(): void {
    if (this.setup()) this.status.set('battle');
  }

  finish(outcome: MatchOutcome): void {
    const leader = this.activeLeader();
    if (!leader) {
      this.status.set('hub');
      return;
    }
    const survivors = outcome.playerFinalHp.filter((hp) => hp > 0).length;
    const teamSize = this.setup()?.playerTeam.length ?? TEAM_SIZE;
    const stars = outcome.playerWon ? starsFor(survivors, teamSize) : 0;
    const firstClear = outcome.playerWon && !this.hasBadge(leader.type);
    const before = this.gauntletOpen();

    let coins = 0;
    if (outcome.playerWon) {
      coins = leader.order * 10 + (firstClear ? 40 : 0) + stars * 8 + (this.isRematch ? 30 : 0);
      this.progressStore.addCoins(coins);
      if (firstClear) this.progressStore.awardBadge(leader.type);
      this.progressStore.recordStars(leader.type, stars);
    }

    this.reward.set({
      leader,
      won: outcome.playerWon,
      stars,
      bestStars: this.starsFor(leader.type),
      coins,
      firstClear,
      gauntletJustUnlocked: !before && this.gauntletOpen(),
    });
    this.setup.set(null);
    this.intro.set(null);
    this.status.set('reward');
  }

  /** Dismiss the reward screen back to the hub. */
  closeReward(): void {
    this.reward.set(null);
    this.activeLeader.set(null);
    this.status.set('hub');
  }

  abandon(): void {
    this.setup.set(null);
    this.intro.set(null);
    this.activeLeader.set(null);
    this.error.set(null);
    this.status.set('hub');
  }

  resetProgress(): void {
    this.progressStore.reset();
    this.reward.set(null);
  }

  /* --------------------------------------------------------- the gauntlet */

  async startGauntlet(): Promise<void> {
    if (!this.gauntletOpen()) return;
    this.status.set('loading');
    this.error.set(null);
    try {
      await this.gauntlet.start();
      this.status.set('gauntlet');
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Could not start the gauntlet.');
      this.status.set('error');
    }
  }

  async finishGauntletMatch(outcome: MatchOutcome): Promise<void> {
    if (this.gauntlet.advance(outcome) === 'over') {
      this.status.set('hub');
      return;
    }
    this.status.set('loading');
    await this.gauntlet.loadMatch();
    this.status.set('gauntlet');
  }

  abandonGauntlet(): void {
    this.gauntlet.end();
    this.status.set('hub');
  }
}
