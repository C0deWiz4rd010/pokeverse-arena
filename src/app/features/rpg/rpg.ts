import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RpgService } from './rpg.service';
import { OverworldComponent } from './overworld/overworld';
import { IconComponent } from '../../core/ui/icon/icon';

/**
 * Classic RPG mode shell. Shows a title screen (New Adventure / Continue) and
 * mounts the overworld while playing. Battle and menu phases hook in later.
 */
@Component({
  selector: 'pv-rpg',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [OverworldComponent, IconComponent],
  templateUrl: './rpg.html',
  styleUrl: './rpg.scss',
})
export class RpgComponent {
  protected readonly svc = inject(RpgService);
}
