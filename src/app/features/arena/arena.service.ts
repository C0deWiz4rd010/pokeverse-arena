import { Injectable, computed, inject, signal } from '@angular/core';
import { isPokemonType, type PokemonType } from '../../core/utils/type-chart';
import type { Battler } from '../../game/engine';
import type { BracketMatch, Trainer } from '../../game/tournament';
import {
  LEADER_LADDER,
  leaderLevel,
  leaderTier,
  type GymLeader,
  type LeaderMon,
} from '../../game/arena/gym-leaders';
import { arenaProgress, buildLadder } from '../../game/arena/gym-progression';
import { CHAMPION, GAUNTLET, gauntletUnlocked, type EliteTrainer } from '../../game/arena/elite-four';
import { BattleService } from '../battle/battle.service';
import { TeamBuilderService } from '../team-builder/team-builder.service';
import type { PlayerMatchSetup } from '../tournaments/tournaments.service';
import type { MatchOutcome } from '../tournaments/tournament-match/tournament-match';

type Status = 'hub' | 'loading' | 'battle' | 'gauntlet' | 'error';

const DEX_MAX = 1025;
const TEAM_SIZE = 3;
const GAUNTLET_LEVEL = 75;
const BADGE_KEY = 'arena:badges';
const CHAMP_KEY = 'arena:champion';
const COINS_KEY = 'arena:coins';

/** Deterministic gym-leader portrait via the DiceBear avatar library. */
function leaderAvatar(seed: string, accent = false): string {
  const params = new URLSearchParams({
    seed,
    radius: '50',
    backgroundType: 'gradientLinear',
    backgroundColor: accent ? 'ffd166,ffb703,fb8500' : 'b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf,c8f7c5',
  });
  return `https://api.dicebear.com/9.x/adventurer/svg?${params.toString()}`;
}

/** Live state of an in-progress Champion Gauntlet run. */
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

/**
 * Arena hub: a designed gym ladder (one leader per type, scaling level + AI),
 * persisted badge progress, a Champion Gauntlet (Elite Four + Champion, no heal
 * between matches), and the wiring to launch each challenge through the shared
 * 3-v-3 match component.
 */
@Injectable({ providedIn: 'root' })
export class ArenaService {
  private readonly battle = inject(BattleService);
  private readonly roster = inject(TeamBuilderService);

  readonly leaders = LEADER_LADDER;

  readonly status = signal<Status>('hub');
  readonly error = signal<string | null>(null);
  readonly setup = signal<PlayerMatchSetup | null>(null);
  readonly activeLeader = signal<GymLeader | null>(null);
  readonly lastResult = signal<{ leader: GymLeader; won: boolean; coins: number } | null>(null);

  readonly badges = signal<ReadonlySet<PokemonType>>(this.restoreBadges());
  readonly isChampion = signal<boolean>(localStorage.getItem(CHAMP_KEY) === '1');
  readonly coins = signal<number>(this.restoreCoins());

  readonly earnedCount = computed(() => this.badges().size);
  readonly total = computed(() => this.leaders.length);
  readonly ladder = computed(() => buildLadder(this.badges()));
  readonly progress = computed(() => arenaProgress(this.badges()));
  readonly gauntletOpen = computed(() => gauntletUnlocked(this.badges()));

  /** Gauntlet run state (null when not running). */
  private run: GauntletRun | null = null;
  readonly gauntletSetup = signal<PlayerMatchSetup | null>(null);
  readonly gauntletView = signal<GauntletView | null>(null);
  readonly gauntletResult = signal<'won' | 'lost' | null>(null);
  private gauntletPlayerTeam: Battler[] = [];

  hasBadge(type: PokemonType): boolean {
    return this.badges().has(type);
  }

  /* ---------------------------------------------------------- single gym */

  async challenge(leader: GymLeader): Promise<void> {
    this.status.set('loading');
    this.error.set(null);
    this.lastResult.set(null);
    this.activeLeader.set(leader);
    try {
      const level = leaderLevel(leader.order);
      const [foeTeam, playerTeam] = await Promise.all([
        this.buildLeaderTeam(leader, level),
        this.buildPlayerTeam(level),
      ]);
      if (!foeTeam.length || !playerTeam.length) throw new Error('Could not assemble a team for this challenge.');
      const foe: Trainer = {
        id: `leader-${leader.type}`,
        name: leader.name,
        title: leader.title,
        avatar: leaderAvatar(`${leader.name}-${leader.type}`),
        team: foeTeam,
      };
      const player = this.playerTrainer(playerTeam);
      this.setup.set({
        match: this.dummyMatch(`gym-${leader.type}`, player, foe),
        round: 'final',
        player,
        foe,
        playerTeam,
        foeTeam,
        aiTier: leaderTier(leader.order),
      });
      this.status.set('battle');
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Something went wrong. Try again.');
      this.status.set('error');
      this.activeLeader.set(null);
    }
  }

  finish(outcome: MatchOutcome): void {
    const leader = this.activeLeader();
    let reward = 0;
    if (leader) {
      const firstClear = outcome.playerWon && !this.badges().has(leader.type);
      if (outcome.playerWon) {
        reward = leader.order * 10 + (firstClear ? 40 : 0);
        this.addCoins(reward);
        if (firstClear) {
          const next = new Set(this.badges());
          next.add(leader.type);
          this.badges.set(next);
          this.persistBadges(next);
        }
      }
      this.lastResult.set({ leader, won: outcome.playerWon, coins: reward });
    }
    this.setup.set(null);
    this.activeLeader.set(null);
    this.status.set('hub');
  }

  abandon(): void {
    this.setup.set(null);
    this.activeLeader.set(null);
    this.error.set(null);
    this.status.set('hub');
  }

  /* --------------------------------------------------------- the gauntlet */

  async startGauntlet(): Promise<void> {
    if (!this.gauntletOpen()) return;
    this.status.set('loading');
    this.error.set(null);
    this.gauntletResult.set(null);
    try {
      this.gauntletPlayerTeam = await this.buildPlayerTeam(GAUNTLET_LEVEL);
      if (!this.gauntletPlayerTeam.length) throw new Error('Assemble a team in the Team Builder first.');
      this.run = { trainers: GAUNTLET, index: 0, playerHp: this.gauntletPlayerTeam.map((m) => m.stats.hp) };
      await this.loadGauntletMatch();
      this.status.set('gauntlet');
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Could not start the gauntlet.');
      this.status.set('error');
    }
  }

  async finishGauntletMatch(outcome: MatchOutcome): Promise<void> {
    const run = this.run;
    if (!run) return;
    if (!outcome.playerWon) {
      this.gauntletResult.set('lost');
      this.endGauntlet();
      return;
    }
    run.playerHp = outcome.playerFinalHp;
    run.index += 1;
    this.addCoins(60);
    if (run.index >= run.trainers.length) {
      // Champion defeated.
      this.addCoins(300);
      this.isChampion.set(true);
      localStorage.setItem(CHAMP_KEY, '1');
      this.gauntletResult.set('won');
      this.endGauntlet();
      return;
    }
    this.status.set('loading');
    await this.loadGauntletMatch();
    this.status.set('gauntlet');
  }

  abandonGauntlet(): void {
    this.endGauntlet();
  }

  private endGauntlet(): void {
    this.run = null;
    this.gauntletSetup.set(null);
    this.gauntletView.set(null);
    this.status.set('hub');
  }

  private async loadGauntletMatch(): Promise<void> {
    const run = this.run!;
    const trainer = run.trainers[run.index];
    const foeTeam = await this.buildEliteTeam(trainer);
    const player = this.playerTrainer(this.gauntletPlayerTeam, true);
    const foe: Trainer = {
      id: trainer.id,
      name: trainer.name,
      title: trainer.title,
      avatar: leaderAvatar(`${trainer.name}-${trainer.id}`, trainer.champion),
      team: foeTeam,
    };
    this.gauntletSetup.set({
      match: this.dummyMatch(`gauntlet-${trainer.id}`, player, foe),
      round: 'final',
      player,
      foe,
      playerTeam: this.gauntletPlayerTeam,
      foeTeam,
      aiTier: 'elite',
      playerStartHp: run.playerHp.slice(),
    });
    this.gauntletView.set({
      stageLabel: trainer.champion ? 'Champion' : `Elite ${run.index + 1}`,
      index: run.index + 1,
      total: run.trainers.length,
      foeName: `${trainer.name}, ${trainer.title}`,
    });
  }

  /* ------------------------------------------------------------- rewards */

  resetProgress(): void {
    this.badges.set(new Set());
    this.persistBadges(new Set());
    this.isChampion.set(false);
    localStorage.removeItem(CHAMP_KEY);
    this.lastResult.set(null);
  }

  private addCoins(n: number): void {
    if (n <= 0) return;
    const next = this.coins() + n;
    this.coins.set(next);
    try {
      localStorage.setItem(COINS_KEY, String(next));
    } catch {
      /* storage unavailable */
    }
  }

  /* ----------------------------------------------------------- team build */

  private async buildLeaderTeam(leader: GymLeader, level: number): Promise<Battler[]> {
    return this.buildLoadout(leader.team, level);
  }

  private async buildEliteTeam(trainer: EliteTrainer): Promise<Battler[]> {
    return this.buildLoadout(trainer.team, trainer.level);
  }

  /** Build a designed team: real movesets from the API, with set abilities/items. */
  private async buildLoadout(team: readonly LeaderMon[], level: number): Promise<Battler[]> {
    const built = await Promise.all(
      team.map(async (mon): Promise<Battler | null> => {
        try {
          const b = await this.battle.buildBattler(mon.species, level);
          return { ...b, ability: mon.ability ?? b.ability, item: mon.item };
        } catch {
          return null;
        }
      }),
    );
    return built.filter((b): b is Battler => b !== null);
  }

  /** Player brings their Team Builder roster (first three) or a fair random trio. */
  private async buildPlayerTeam(level: number): Promise<Battler[]> {
    const saved = this.roster.team().slice(0, TEAM_SIZE);
    if (saved.length) {
      return Promise.all(saved.map((m) => this.battle.buildBattler(m.id, level)));
    }
    const ids = new Set<number>();
    while (ids.size < TEAM_SIZE) ids.add(1 + Math.floor(Math.random() * DEX_MAX));
    return Promise.all([...ids].map((id) => this.battle.buildBattler(id, level)));
  }

  private playerTrainer(team: Battler[], champion = false): Trainer {
    return {
      id: 'player',
      name: 'You',
      title: 'Challenger',
      avatar: leaderAvatar('Champion-Ace', champion),
      team,
      isPlayer: true,
    };
  }

  private dummyMatch(id: string, player: Trainer, foe: Trainer): BracketMatch {
    return { id, round: 'final', slot: 0, a: player, b: foe, winner: null, played: false };
  }

  /* ------------------------------------------------------------ persistence */

  private restoreBadges(): ReadonlySet<PokemonType> {
    try {
      const raw = localStorage.getItem(BADGE_KEY);
      if (!raw) return new Set();
      const list = JSON.parse(raw) as unknown;
      if (!Array.isArray(list)) return new Set();
      return new Set(list.filter(isPokemonType));
    } catch {
      return new Set();
    }
  }

  private persistBadges(badges: ReadonlySet<PokemonType>): void {
    try {
      localStorage.setItem(BADGE_KEY, JSON.stringify([...badges]));
    } catch {
      /* storage unavailable — progress simply won't persist */
    }
  }

  private restoreCoins(): number {
    const n = Number(localStorage.getItem(COINS_KEY));
    return Number.isFinite(n) && n > 0 ? n : 0;
  }
}
