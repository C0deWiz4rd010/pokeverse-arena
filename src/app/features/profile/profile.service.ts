import { Injectable, computed, inject, signal } from '@angular/core';
import { SaveService } from '../../core/storage/save.service';
import {
  DEFAULT_IDENTITY,
  evaluateAchievements,
  rankFor,
  type ProfileState,
  type TrainerIdentity,
} from '../../core/models/profile';
import { LEADER_LADDER } from '../../game/arena/gym-leaders';
import { loadMeta } from '../../game/spire';
import { loadHistory } from '../../game/tournament';

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
  readonly rank = computed(() => rankFor(this.state()));

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
    };
  }
}
