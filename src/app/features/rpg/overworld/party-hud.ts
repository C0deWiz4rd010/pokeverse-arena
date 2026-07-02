import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RpgService } from '../rpg.service';
import { titleCase } from '../../../core/ui/format';
import { STATUS_INFO } from '../../../game/engine';
import type { StatusCondition } from '../../../game/engine';
import type { PartyMon } from '../../../game/rpg/rpg-types';

/**
 * Compact overworld party HUD: a stacked strip of the current team showing each
 * member's level, a colour-graded HP bar and any status tag. Shared by both the
 * Pixi and canvas overworld renderers so the readout is identical.
 */
@Component({
  selector: 'pv-ow-party-hud',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (svc.party().length) {
      <div class="party-hud" aria-label="Party status">
        @for (m of svc.party(); track m.uid) {
          <div class="ph-mon" [class.fainted]="m.currentHp <= 0" [title]="label(m) + ' · Lv ' + m.level">
            <span class="ph-top">
              <span class="ph-name">{{ label(m) }}</span>
              <span class="ph-lvl">L{{ m.level }}</span>
            </span>
            <span class="ph-bar">
              <span
                class="ph-fill"
                [class.low]="pct(m) <= 20"
                [class.mid]="pct(m) > 20 && pct(m) <= 50"
                [style.width.%]="pct(m)"
              ></span>
            </span>
            @if (m.status !== 'none') {
              <span class="ph-status" [style.--sc]="color(m.status)">{{ tag(m.status) }}</span>
            }
          </div>
        }
      </div>
    }
  `,
  styleUrl: './party-hud.scss',
})
export class OwPartyHudComponent {
  protected readonly svc = inject(RpgService);

  protected label(m: PartyMon): string {
    return m.nickname ?? titleCase(m.species);
  }
  protected pct(m: PartyMon): number {
    return m.maxHp > 0 ? Math.max(0, Math.round((m.currentHp / m.maxHp) * 100)) : 0;
  }
  protected tag(s: StatusCondition): string {
    return s === 'none' ? '' : STATUS_INFO[s].tag;
  }
  protected color(s: StatusCondition): string {
    return s === 'none' ? 'transparent' : STATUS_INFO[s].color;
  }
}
