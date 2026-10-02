import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { I18nService } from '../../i18n/i18n.service';
import { TypeBadgeComponent } from '../type-badge/type-badge';
import { IconComponent } from '../icon/icon';
import type { IconName } from '../icon/icons.data';
import { titleCase, typeColorVar } from '../format';
import type { BattleMove, DamageClass } from '../../../game/engine';
import { effectivenessRuled, type BattleRules } from '../../../game/engine/rules';
import type { PokemonType } from '../../utils/type-chart';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';

interface EffInfo {
  readonly mult: number;
  readonly tier: 'immune' | 'resist' | 'neutral' | 'super';
  readonly label: string;
}

const CAT_META: Record<DamageClass, { icon: IconName; label: string }> = {
  physical: { icon: 'sword', label: 'Physical' },
  special: { icon: 'sparkles', label: 'Special' },
  status: { icon: 'wand-sparkles', label: 'Status' },
};

/**
 * A polished, type-colored attack button shared by the Battle Arena and
 * Tournaments. Shows the move at a glance (type, power, accuracy, damage
 * class) and reveals a rich tooltip on hover/focus — including live
 * effectiveness against the current defender when its types are supplied.
 */
@Component({
  selector: 'pv-move-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, TypeBadgeComponent, IconComponent],
  template: `
    <button
      class="mv"
      type="button"
      [style.--c]="color()"
      [disabled]="disabled()"
      [attr.aria-label]="ariaLabel()"
      (click)="picked.emit()"
    >
      <span class="mv-glow" aria-hidden="true"></span>

      <span class="mv-head">
        <span class="mv-name">{{ label() | t }}</span>
        @if (hotkey() !== null) { <kbd class="mv-key" aria-hidden="true">{{ hotkey() }}</kbd> }
        <span class="mv-cat" [attr.data-cat]="move().damageClass" [title]="cat().label">
          <pv-icon [name]="cat().icon" />
        </span>
      </span>

      <span class="mv-foot">
        <pv-type-badge [type]="move().type" />
        <span class="mv-stats">
          <span class="stat" [attr.title]="'Power' | t"><pv-icon name="sword" /> {{ move().power || '—' }}</span>
          <span class="stat" [attr.title]="'Accuracy' | t"><pv-icon name="target" /> {{ accLabel() }}</span>
        </span>
      </span>

      @if (eff(); as e) {
        <span class="mv-eff" [attr.data-tier]="e.tier">{{ effShort(e.mult) }}</span>
      }

      <span class="tip" role="tooltip">
        <span class="tip-head">
          <span class="tip-icon" aria-hidden="true"><pv-icon [name]="cat().icon" /></span>
          <span class="tip-titles">
            <span class="tip-title">{{ label() | t }}</span>
            <span class="tip-sub">{{ titleCase(move().type) | t }} · {{ cat().label | t }}</span>
          </span>
        </span>

        <span class="tip-desc">{{ blurb() }}</span>

        <span class="tip-grid">
          <span class="cell"><i>{{ 'Power' | t }}</i><b>{{ move().power || '—' }}</b></span>
          <span class="cell"><i>{{ 'Accuracy' | t }}</i><b>{{ accLabel() }}</b></span>
          @if (ppLabel()) { <span class="cell"><i>{{ 'PP' | t }}</i><b>{{ ppLabel() }}</b></span> }
          @if (priorityLabel()) { <span class="cell"><i>{{ 'Priority' | t }}</i><b>{{ priorityLabel() }}</b></span> }
        </span>

        @if (eff(); as e) {
          <span class="tip-eff" [attr.data-tier]="e.tier">{{ effShort(e.mult) }} · {{ e.label | t }}</span>
        }
      </span>
    </button>
  `,
  styleUrl: './move-button.scss',
})
export class MoveButtonComponent {
  readonly move = input.required<BattleMove>();
  readonly defenderTypes = input<readonly PokemonType[]>();
  readonly rules = input<BattleRules>();
  readonly disabled = input(false);
  /** Optional 1–4 hotkey shown as a keycap (battle keyboard control). */
  readonly hotkey = input<number | null>(null);

  readonly picked = output<void>();

  private readonly i18n = inject(I18nService);
  protected readonly titleCase = titleCase;
  protected readonly color = computed(() => typeColorVar(this.move().type));
  protected readonly cat = computed(() => CAT_META[this.move().damageClass]);
  protected readonly label = computed(() => titleCase(this.move().name));
  protected readonly accLabel = computed(() => {
    const a = this.move().accuracy;
    return a > 0 ? `${a}%` : '—';
  });

  /** Remaining-PP label, only when the move tracks PP. */
  protected readonly ppLabel = computed(() => {
    const pp = this.move().pp;
    return pp !== undefined && Number.isFinite(pp) ? `${pp}` : null;
  });

  /** Signed priority bracket label, only when non-zero. */
  protected readonly priorityLabel = computed(() => {
    const p = this.move().priority ?? 0;
    if (p === 0) return null;
    return p > 0 ? `+${p}` : `${p}`;
  });

  /** A short scouting blurb generated from the move's profile. */
  protected readonly blurb = computed(() => {
    const mv = this.move();
    const t = (text: string, params?: readonly unknown[]) => this.i18n.t(text, params);
    const type = t(titleCase(mv.type));
    if (mv.damageClass === 'status' || mv.power <= 0) {
      return t('A {0}-type status move — sways the battle without dealing direct damage.', [type]);
    }
    const punch =
      mv.power >= 120 ? 'a devastating hit'
      : mv.power >= 90 ? 'a powerful hit'
      : mv.power >= 60 ? 'a solid hit'
      : 'a quick hit';
    const acc = mv.accuracy === 0 ? t(' and never misses') : mv.accuracy < 85 ? t(' but risky to land') : '';
    const first = (mv.priority ?? 0) > 0 ? t(' It strikes first in a pinch.') : '';
    const kind = t(this.cat().label).toLowerCase();
    return `${t('A {0}-type {1} move', [type, kind])} — ${t(punch)}${acc}.${first}`;
  });

  /** Live effectiveness against the defender, when its types are provided. */
  protected readonly eff = computed<EffInfo | null>(() => {
    const defenders = this.defenderTypes();
    const mv = this.move();
    if (!defenders?.length || mv.power <= 0) return null;
    const mult = effectivenessRuled(mv.type, defenders, this.rules());
    if (mult === 0) return { mult, tier: 'immune', label: 'No effect' };
    if (mult > 1) return { mult, tier: 'super', label: 'Super effective' };
    if (mult < 1) return { mult, tier: 'resist', label: 'Not very effective' };
    return { mult, tier: 'neutral', label: 'Neutral' };
  });

  protected readonly ariaLabel = computed(() => {
    const mv = this.move();
    const e = this.eff();
    const t = (text: string, params?: readonly unknown[]) => this.i18n.t(text, params);
    const base = t('{0}, {1} {2} move, power {3}', [
      this.label(),
      t(this.cat().label),
      t(titleCase(mv.type)),
      mv.power || t('none'),
    ]);
    return e && e.tier !== 'neutral' ? `${base}, ${t(e.label)}` : base;
  });

  protected effShort(mult: number): string {
    if (mult === 0) return '×0';
    if (mult === 0.25) return '×¼';
    if (mult === 0.5) return '×½';
    return `×${mult}`;
  }
}
