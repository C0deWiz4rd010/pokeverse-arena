import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { OdysseyService } from './odyssey.service';
import { PageHeaderComponent } from '../../core/ui/page-header/page-header';
import { IconComponent } from '../../core/ui/icon/icon';
import { SpinnerComponent } from '../../core/ui/spinner/spinner';
import { TournamentMatchComponent } from '../tournaments/tournament-match/tournament-match';
import { SPRITE_BASE } from '../../core/api/pokeapi-endpoints';
import { titleCase } from '../../core/ui/format';

/**
 * Odyssey — the endless biome-march roguelike. Thin shell over
 * {@link OdysseyService}: hub → starter pick → wave preview → shared match
 * component → dazed-catch window → reward draft → next wave, until the party
 * drops. Caught species permanently grow the starter roster.
 */
@Component({
  selector: 'pv-odyssey',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, PageHeaderComponent, IconComponent, SpinnerComponent, TournamentMatchComponent],
  templateUrl: './odyssey.html',
  styleUrl: './odyssey.scss',
})
export class OdysseyComponent {
  protected readonly svc = inject(OdysseyService);
  protected readonly titleCase = titleCase;

  protected sprite(dexId: number): string {
    return `${SPRITE_BASE}/pokemon/${dexId}.png`;
  }

  protected kindLabel(kind: 'wild' | 'elite' | 'boss'): string {
    return kind === 'boss' ? '👑 Guardian' : kind === 'elite' ? '⚔ Elite pack' : 'Wild encounter';
  }

  protected pct(chance: number): number {
    return Math.round(chance * 100);
  }
}
