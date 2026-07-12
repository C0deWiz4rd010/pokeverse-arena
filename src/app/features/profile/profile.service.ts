import { Injectable, computed, inject, signal } from '@angular/core';
import { SaveService } from '../../core/storage/save.service';
import {
  ACHIEVEMENTS,
  DEFAULT_IDENTITY,
  evaluateAchievements,
  rankFor,
  rankProgress,
  type ProfileState,
  type TrainerIdentity,
} from '../../core/models/profile';
import { LEADER_LADDER } from '../../game/arena/gym-leaders';
import { EMPTY_DAILY, currentStreak, dailyKey, type DailyRecord } from '../../game/daily/daily';
import { loadOdysseyMeta } from '../../game/odyssey/odyssey';
import { loadMeta } from '../../game/spire';
import { loadHistory, loadRival } from '../../game/tournament';

/**
 * Aggregates progression from every system (arena badges/champion/coins, spire
 * meta, tournament history) into one Trainer profile, and persists the player's
 * editable identity. This is the single read-side of the progression backbone.
 */
@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly save = inject(SaveService);

  readonly identity = signal<TrainerIdentity>(this.save.read('profile:identity', DEFAULT_IDENTITY));
  readonly state = signal<ProfileState>(this.readState());

  readonly achievements = computed(() => evaluateAchievements(this.state()));
  readonly unlocked = computed(() => this.achievements().filter((a) => a.unlocked).length);
  readonly totalAchievements = ACHIEVEMENTS.length;
  /** Achievement completion as a 0–100 percentage. */
  readonly completion = computed(() => Math.round((this.unlocked() / this.totalAchievements) * 100));
  readonly rank = computed(() => rankFor(this.state()));
  /** Rank ladder progress toward the next tier. */
  readonly progress = computed(() => rankProgress(this.state()));

  /** Re-read aggregate progression (call when entering the profile page). */
  refresh(): void {
    this.state.set(this.readState());
  }

  setIdentity(name: string, title: string): void {
    const identity: TrainerIdentity = {
      name: name.trim() || DEFAULT_IDENTITY.name,
      title: title.trim() || DEFAULT_IDENTITY.title,
    };
    this.identity.set(identity);
    this.save.write('profile:identity', identity);
  }

  private readState(): ProfileState {
    const badgeList = this.save.readLegacy<string[]>('arena:badges', []);
    const badges = Array.isArray(badgeList) ? badgeList.length : 0;
    const arenaChampion = this.save.readLegacy<string>('arena:champion', '') === '1';
    const arenaCoins = Number(this.save.readLegacy<string>('arena:coins', '0')) || 0;

    const meta = loadMeta();
    const history = loadHistory();
    const tournamentWins = history.filter((h) => h.playerWon).length;
    const tournamentPrizes = history.reduce((sum, h) => sum + (h.prize ?? 0), 0);
    const pickemHits = history.filter((h) => (h.pickBonus ?? 0) > 0).length;

    // Adventure (RPG), World Explorer, Contest Hall and the tournament rival.
    const rpg = this.save.read<{ badges?: string[]; caught?: number[] } | null>('rpg:save', null);
    // Nuzlocke progress may live in any of the three RPG slots — take the best.
    const nuzlockeBadges = ['rpg:save', 'rpg:save:2', 'rpg:save:3']
      .map((k) => this.save.read<{ badges?: string[]; nuzlocke?: unknown } | null>(k, null))
      .filter((g) => !!g?.nuzlocke)
      .reduce((best, g) => Math.max(best, g?.badges?.length ?? 0), 0);
    const worldCaught = this.save.read<number[]>('world:caught', []).length;
    const shinyCaught = this.save.read<number[]>('world:shiny', []).length;
    const contestRibbons = this.save.read<string[]>('contest:ribbons', []).length;
    const rival = loadRival();
    const daily = this.save.read<DailyRecord>('daily:record', EMPTY_DAILY);
    const odyssey = loadOdysseyMeta();
    const fusionsRegistered = this.save.read<unknown[]>('fusion:dex', []).length;

    return {
      badges,
      totalBadges: LEADER_LADDER.length,
      arenaChampion,
      bestDepth: meta.bestDepth,
      spireClears: meta.clears,
      ascension: meta.ascension,
      tournamentWins,
      tournamentRuns: history.length,
      coins: arenaCoins + meta.bankedCoins + tournamentPrizes,
      adventureBadges: rpg?.badges?.length ?? 0,
      adventureCaught: rpg?.caught?.length ?? 0,
      worldCaught,
      shinyCaught,
      contestRibbons,
      rivalWins: rival.playerWins,
      rivalLosses: rival.rivalWins,
      pickemHits,
      dailyStreak: currentStreak(daily, dailyKey()),
      dailyBest: daily.best,
      odysseyBestWave: odyssey.bestWave,
      odysseyUnlocked: odyssey.unlocked.length,
      fusionsRegistered,
      nuzlockeBadges,
    };
  }
}
