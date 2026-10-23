import { Injectable, inject } from '@angular/core';
import { BattlerFactory } from '../../core/battle/battler-factory';
import type { StatKey } from '../../core/utils/stat-calculator';
import type { PokemonType } from '../../core/utils/type-chart';
import type { EliteTrainer } from '../../game/arena/elite-four';
import type { GymLeader, LeaderMon } from '../../game/arena/gym-leaders';
import { badgeStatMultipliers } from '../../game/arena/gym-progression';
import type { Battler } from '../../game/engine';
import { TeamBuilderService } from '../team-builder/team-builder.service';

export const TEAM_SIZE = 3;
const DEX_MAX = 1025;

/** Builds the battlers for Arena fights: leader / Elite teams, the player's team and badge boosts. */
@Injectable({ providedIn: 'root' })
export class ArenaTeams {
  private readonly battle = inject(BattlerFactory);
  private readonly roster = inject(TeamBuilderService);

  /** Apply the stat multipliers earned by the owned badges. */
  applyBadgeBoosts(team: Battler[], badges: ReadonlySet<PokemonType>): Battler[] {
    const mult = badgeStatMultipliers(badges);
    return team.map((mon) => {
      const stats = { ...mon.stats };
      for (const key of Object.keys(stats) as StatKey[])
        stats[key] = Math.round(stats[key] * mult[key]);
      return { ...mon, stats };
    });
  }

  /** A leader's signature team; rematches bring the ace twice. */
  async buildLeaderTeam(leader: GymLeader, level: number, rematch: boolean): Promise<Battler[]> {
    const team = rematch ? [...leader.team, leader.team[leader.team.length - 1]!] : leader.team;
    return this.buildLoadout(team, level);
  }

  async buildEliteTeam(trainer: EliteTrainer): Promise<Battler[]> {
    return this.buildLoadout(trainer.team, trainer.level);
  }

  /** The saved team-builder squad, or a random trio when none is saved. */
  async buildPlayerTeam(level: number): Promise<Battler[]> {
    const saved = this.roster.team().slice(0, TEAM_SIZE);
    if (saved.length) {
      return Promise.all(saved.map((m) => this.battle.buildBattler(m.id, level)));
    }
    const ids = new Set<number>();
    while (ids.size < TEAM_SIZE) ids.add(1 + Math.floor(Math.random() * DEX_MAX));
    return Promise.all([...ids].map((id) => this.battle.buildBattler(id, level)));
  }

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
}
