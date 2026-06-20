import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TypeBadgeComponent } from '../type-badge/type-badge';
import { titleCase, typeColorVar } from '../format';
import type { BattleMove, DamageClass } from '../../../game/engine';
import { effectivenessRuled, type BattleRules } from '../../../game/engine/rules';
import type { PokemonType } from '../../utils/type-chart';

interface EffInfo {
  readonly mult: number;
  readonly tier: 'immune' | 'resist' | 'neutral' | 'super';
  readonly label: string;
}

const CAT_META: Record<DamageClass, { icon: string; label: string }> = {
  physical: { icon: '💥', label: 'Physical' },
  special: { icon: '✨', label: 'Special' },
  status: { icon: '🌀', label: 'Status' },
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
  imports: [TypeBadgeComponent],
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
        <span class="mv-name">{{ label() }}</span>
        <span class="mv-cat" [attr.data-cat]="move().damageClass" [title]="cat().label">{{ cat().icon }}</span>
      </span>

      <span class="mv-foot">
        <pv-type-badge [type]="move().type" />
        <span class="mv-stats">
          <span class="stat" title="Power">⚔ {{ move().power || '—' }}</span>
          <span class="stat" title="Accuracy">🎯 {{ accLabel() }}</span>
        </span>
      </span>

      @if (eff(); as e) {
        <span class="mv-eff" [attr.data-tier]="e.tier">{{ effShort(e.mult) }}</span>
      }

      <span class="tip" role="tooltip">
        <span class="tip-title">{{ label() }}</span>
        <span class="tip-row"><span>Type</span><b>{{ titleCase(move().type) }}</b></span>
        <span class="tip-row"><span>Class</span><b>{{ cat().icon }} {{ cat().label }}</b></span>
        <span class="tip-row"><span>Power</span><b>{{ move().power || '—' }}</b></span>
        <span class="tip-row"><span>Accuracy</span><b>{{ accLabel() }}</b></span>
        @if (eff(); as e) {
          <span class="tip-eff" [attr.data-tier]="e.tier">{{ effShort(e.mult) }} · {{ e.label }}</span>
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

  readonly picked = output<void>();

  protected readonly titleCase = titleCase;
  protected readonly color = computed(() => typeColorVar(this.move().type));
  protected readonly cat = computed(() => CAT_META[this.move().damageClass]);
  protected readonly label = computed(() => titleCase(this.move().name));
  protected readonly accLabel = computed(() => {
    const a = this.move().accuracy;
    return a > 0 ? `${a}%` : '—';
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
    const base = `${this.label()}, ${this.cat().label} ${titleCase(mv.type)} move, power ${mv.power || 'none'}`;
    return e && e.tier !== 'neutral' ? `${base}, ${e.label}` : base;
  });

  protected effShort(mult: number): string {
    if (mult === 0) return '×0';
    if (mult === 0.25) return '×¼';
    if (mult === 0.5) return '×½';
    return `×${mult}`;
  }
}
