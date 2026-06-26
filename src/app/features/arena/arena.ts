import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ArenaService } from './arena.service';
import { PageHeaderComponent } from '../../core/ui/page-header/page-header';
import { IconComponent } from '../../core/ui/icon/icon';
import { SpinnerComponent } from '../../core/ui/spinner/spinner';
import { TypeBadgeComponent } from '../../core/ui/type-badge/type-badge';
import { TournamentMatchComponent } from '../tournaments/tournament-match/tournament-match';
import { titleCase } from '../../core/ui/format';
import type { GymLeader } from '../../game/arena/gym-leaders';
import type { MatchOutcome } from '../tournaments/tournament-match/tournament-match';

@Component({
  selector: 'pv-arena',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeaderComponent, SpinnerComponent, TypeBadgeComponent, IconComponent, TournamentMatchComponent],
  templateUrl: './arena.html',
  styleUrl: './arena.scss',
})
export class ArenaComponent {
  protected readonly svc = inject(ArenaService);
  protected readonly titleCase = titleCase;

  protected challenge(leader: GymLeader): void {
    void this.svc.challenge(leader);
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
