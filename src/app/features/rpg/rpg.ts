import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RpgService } from './rpg.service';
import { OverworldComponent } from './overworld/overworld';
import { PixiOverworldComponent } from './overworld/pixi-overworld';
import { RpgBattleComponent } from './battle/rpg-battle';
import { FieldMenuComponent } from './ui/field-menu';
import { ShopComponent } from './ui/shop';
import { DialogueBoxComponent } from './ui/dialogue-box';
import { StarterComponent } from './ui/starter';
import { IconComponent } from '../../core/ui/icon/icon';

/**
 * Classic RPG mode shell. Shows a title screen (New Adventure / Continue) and
 * mounts the overworld while playing. Battle and menu phases hook in later.
 */
@Component({
  selector: 'pv-rpg',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    OverworldComponent,
    PixiOverworldComponent,
    RpgBattleComponent,
    FieldMenuComponent,
    ShopComponent,
    DialogueBoxComponent,
    StarterComponent,
    IconComponent,
  ],
  templateUrl: './rpg.html',
  styleUrl: './rpg.scss',
})
export class RpgComponent {
  protected readonly svc = inject(RpgService);

  /** Use the canvas fallback when motion is reduced or WebGL is unavailable. */
  protected readonly useCanvas = ((): boolean => {
    try {
      if (typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches) return true;
      const c = document.createElement('canvas');
      return !(c.getContext('webgl2') || c.getContext('webgl'));
    } catch {
      return true;
    }
  })();
}
