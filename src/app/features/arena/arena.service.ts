import { Injectable, computed, inject, signal } from '@angular/core';
import { PokeApiClient } from '../../core/api/pokeapi.client';
import type { PokemonDto } from '../../core/dto/pokeapi.dto';
import { quickStats, type StatKey } from '../../core/utils/stat-calculator';
import { isPokemonType, type PokemonType } from '../../core/utils/type-chart';
import { SeededRng } from '../../core/utils/rng';
import type { Battler, BattleMove } from '../../game/engine';
import type { BracketMatch, Trainer } from '../../game/tournament';
import { GYM_LEADERS, type GymLeader } from '../../game/arena/gym-leaders';
import { BattleService } from '../battle/battle.service';
import { TeamBuilderService } from '../team-builder/team-builder.service';
import type { PlayerMatchSetup } from '../tournaments/tournaments.service';
import type { MatchOutcome } from '../tournaments/tournament-match/tournament-match';

type Status = 'hub' | 'loading' | 'battle' | 'error';

const DEX_MAX = 1025;
const GYM_LEVEL = 50;
const TEAM_SIZE = 3;
const BADGE_KEY = 'arena:badges';

/** A leader's themed team is drawn from the strongest of a sampled candidate pool. */
const CANDIDATE_POOL = 12;

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Type-accurate synthetic move set (mirrors the tournament CPU builder). */
function synthMoves(types: PokemonType[]): BattleMove[] {
  const moves: BattleMove[] = types.map((ty, i) => ({
    name: `${titleCase(ty)} ${i === 0 ? 'Blast' : 'Strike'}`,
    type: ty,
    power: 85,
    accuracy: 100,
    damageClass: i % 2 === 0 ? 'physical' : 'special',
  }));
  moves.push({ name: 'Tackle', type: 'normal', power: 50, accuracy: 100, damageClass: 'physical' });
  return moves;
}

/** Deterministic gym-leader portrait via the DiceBear avatar library. */
function leaderAvatar(seed: string): string {
  const params = new URLSearchParams({
    seed,
    radius: '50',
    backgroundType: 'gradientLinear',
    backgroundColor: 'b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf,c8f7c5',
  });
  return `https://api.dicebear.com/9.x/adventurer/svg?${params.toString()}`;
}

function idFromUrl(url: string): number | null {
  const m = url.match(/\/pokemon\/(\d+)\/?$/);
  return m ? Number(m[1]) : null;
}

/**
 * Arena hub state: a roster of type-themed gym leaders, the player's badge
 * progress (persisted), and the wiring to launch a 3-v-3 challenge match.
 */
@Injectable({ providedIn: 'root' })
export class ArenaService {
  private readonly api = inject(PokeApiClient);
  private readonly battle = inject(BattleService);
  private readonly roster = inject(TeamBuilderService);

  readonly leaders = GYM_LEADERS;

  readonly status = signal<Status>('hub');
  readonly error = signal<string | null>(null);
  readonly setup = signal<PlayerMatchSetup | null>(null);
  readonly activeLeader = signal<GymLeader | null>(null);
  readonly lastResult = signal<{ leader: GymLeader; won: boolean } | null>(null);

  /** Types whose badge the player has earned. */
  readonly badges = signal<ReadonlySet<PokemonType>>(this.restoreBadges());

  readonly earnedCount = computed(() => this.badges().size);
  readonly total = computed(() => this.leaders.length);
  readonly isChampion = computed(() => this.earnedCount() === this.total());

  hasBadge(type: PokemonType): boolean {
    return this.badges().has(type);
  }

  /** Build both teams and drop the player into a challenge match. */
  async challenge(leader: GymLeader): Promise<void> {
    this.status.set('loading');
    this.error.set(null);
    this.lastResult.set(null);
    this.activeLeader.set(leader);
    try {
      const [foeTeam, playerTeam] = await Promise.all([
        this.buildLeaderTeam(leader.type),
        this.buildPlayerTeam(),
      ]);
      if (!foeTeam.length || !playerTeam.length) {
        throw new Error('Could not assemble a team for this challenge.');
      }
      const foe: Trainer = {
        id: `leader-${leader.type}`,
        name: leader.name,
        title: leader.title,
        avatar: leaderAvatar(`${leader.name}-${leader.type}`),
        team: foeTeam,
      };
      const player: Trainer = {
        id: 'player',
        name: 'You',
        title: 'Challenger',
        avatar: leaderAvatar('Champion-Ace'),
        team: playerTeam,
        isPlayer: true,
      };
      const match: BracketMatch = {
        id: `gym-${leader.type}`,
        round: 'final',
        slot: 0,
        a: player,
        b: foe,
        winner: null,
        played: false,
      };
      this.setup.set({ match, round: 'final', player, foe, playerTeam, foeTeam });
      this.status.set('battle');
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Something went wrong. Try again.');
      this.status.set('error');
      this.activeLeader.set(null);
    }
  }

  /** Handle a finished match: award the badge on a win, return to the hub. */
  finish(outcome: MatchOutcome): void {
    const leader = this.activeLeader();
    if (leader) {
      this.lastResult.set({ leader, won: outcome.playerWon });
      if (outcome.playerWon && !this.badges().has(leader.type)) {
        const next = new Set(this.badges());
        next.add(leader.type);
        this.badges.set(next);
        this.persistBadges(next);
      }
    }
    this.setup.set(null);
    this.activeLeader.set(null);
    this.status.set('hub');
  }

  /** Abandon an in-progress challenge and return to the hub. */
  abandon(): void {
    this.setup.set(null);
    this.activeLeader.set(null);
    this.error.set(null);
    this.status.set('hub');
  }

  /** Wipe all earned badges (with confirmation handled by the UI). */
  resetProgress(): void {
    this.badges.set(new Set());
    this.persistBadges(new Set());
    this.lastResult.set(null);
  }

  /* ----------------------------------------------------------- team building */

  /** The leader fields the three strongest mons of a sampled same-type pool. */
  private async buildLeaderTeam(type: PokemonType): Promise<Battler[]> {
    const dto = await this.api.type(type);
    const pool = dto.pokemon
      .map((p) => idFromUrl(p.pokemon.url))
      .filter((id): id is number => id !== null && id <= DEX_MAX);
    if (!pool.length) return [];

    const rng = new SeededRng(`gym-${type}`);
    const ids = rng.shuffle(pool).slice(0, CANDIDATE_POOL);
    const dtos = await this.fetchDtos(ids);
    dtos.sort((a, b) => this.battle.totalBaseStats(b) - this.battle.totalBaseStats(a));
    return dtos.slice(0, TEAM_SIZE).map((d) => this.buildLight(d));
  }

  /**
   * The player brings their Team Builder roster (first three) when available,
   * otherwise a fair random trio so anyone can jump straight in.
   */
  private async buildPlayerTeam(): Promise<Battler[]> {
    const saved = this.roster.team().slice(0, TEAM_SIZE);
    if (saved.length) {
      return Promise.all(saved.map((m) => this.battle.buildBattler(m.id, GYM_LEVEL)));
    }
    const ids = new Set<number>();
    while (ids.size < TEAM_SIZE) ids.add(1 + Math.floor(Math.random() * DEX_MAX));
    return Promise.all([...ids].map((id) => this.battle.buildBattler(id, GYM_LEVEL)));
  }

  private async fetchDtos(ids: number[]): Promise<PokemonDto[]> {
    const res = await Promise.all(ids.map((id) => this.api.pokemon(id).catch(() => null)));
    return res.filter((d): d is PokemonDto => !!d);
  }

  private buildLight(dto: PokemonDto): Battler {
    const types = dto.types
      .slice()
      .sort((a, b) => a.slot - b.slot)
      .map((t) => t.type.name)
      .filter(isPokemonType);
    const t = types.length ? types : (['normal'] as PokemonType[]);
    return {
      id: dto.id,
      name: dto.name,
      level: GYM_LEVEL,
      types: t,
      stats: quickStats(this.baseStats(dto), GYM_LEVEL),
      moves: synthMoves(t),
      sprite: this.battle.battleSprite(dto, 'front'),
    };
  }

  private baseStats(dto: PokemonDto): Record<StatKey, number> {
    const stats = {} as Record<StatKey, number>;
    for (const s of dto.stats) stats[s.stat.name as StatKey] = s.base_stat;
    return stats;
  }

  /* ------------------------------------------------------------- persistence */

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
}
