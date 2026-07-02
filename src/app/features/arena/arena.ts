import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ArenaService } from './arena.service';
import { PageHeaderComponent } from '../../core/ui/page-header/page-header';
import { IconComponent } from '../../core/ui/icon/icon';
import { SpinnerComponent } from '../../core/ui/spinner/spinner';
import { TypeBadgeComponent } from '../../core/ui/type-badge/type-badge';
import { TournamentMatchComponent } from '../tournaments/tournament-match/tournament-match';
import { PokedexService } from '../pokedex/pokedex.service';
import { SPRITE_BASE } from '../../core/api/pokeapi-endpoints';
import { titleCase } from '../../core/ui/format';
import { bestLead, scoutMatchup, winOdds } from '../../game/tournament';
import type { GymLeader } from '../../game/arena/gym-leaders';
import type { MatchOutcome } from '../tournaments/tournament-match/tournament-match';

interface ScoutMon {
  readonly species: string;
  readonly art: string | undefined;
  readonly ace: boolean;
}

@Component({
  selector: 'pv-arena',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeaderComponent, SpinnerComponent, TypeBadgeComponent, IconComponent, TournamentMatchComponent],
  templateUrl: './arena.html',
  styleUrl: './arena.scss',
})
export class ArenaComponent {
  protected readonly svc = inject(ArenaService);
  private readonly dex = inject(PokedexService);
  protected readonly titleCase = titleCase;

  constructor() {
    // The Pokédex index (cache-first, one request) gives us species → artwork
    // for the scouting previews without any per-Pokémon fetches.
    void this.dex.ensureLoaded();
  }

  /** species name → lightweight pixel-sprite URL, from the cached Pokédex index. */
  private readonly artByName = computed(() => {
    const m = new Map<string, string>();
    for (const e of this.dex.entries()) m.set(e.name, `${SPRITE_BASE}/pokemon/${e.id}.png`);
    return m;
  });

  /** The leader's signature team as scoutable thumbnails (ace flagged). */
  protected scout(leader: GymLeader): ScoutMon[] {
    const art = this.artByName();
    const last = leader.team.length - 1;
    return leader.team.map((mon, i) => ({
      species: mon.species,
      art: art.get(mon.species),
      ace: i === last,
    }));
  }

  /** [filled, empty] pip helpers for a 3-star rating. */
  protected stars(n: number): boolean[] {
    return [n >= 1, n >= 2, n >= 3];
  }

  /** Pre-battle intel for the VS splash (odds, type edge, suggested lead). */
  protected readonly intel = computed(() => {
    const g = this.svc.intro();
    if (!g) return null;
    const odds = winOdds(g.playerTeam, g.foeTeam);
    const scout = scoutMatchup(g.playerTeam, g.foeTeam);
    const lead = bestLead(g.playerTeam, g.foeTeam);
    const verdict =
      odds >= 66 ? 'Favoured' : odds >= 55 ? 'Slight edge' : odds > 45 ? 'Even match' : odds > 34 ? 'Underdog' : 'Long shot';
    return { odds, verdict, scout, lead, tier: odds >= 55 ? 'up' : odds > 45 ? 'even' : 'down' };
  });

  protected challenge(leader: GymLeader): void {
    void this.svc.challenge(leader);
  }

  protected rematch(leader: GymLeader): void {
    this.svc.rematch(leader);
  }

  protected begin(): void {
    this.svc.beginBattle();
  }

  protected startGauntlet(): void {
    void this.svc.startGauntlet();
  }

  protected onGymFinished(outcome: MatchOutcome): void {
    this.svc.finish(outcome);
  }

  protected onGauntletFinished(outcome: MatchOutcome): void {
    void this.svc.finishGauntletMatch(outcome);
  }
}
