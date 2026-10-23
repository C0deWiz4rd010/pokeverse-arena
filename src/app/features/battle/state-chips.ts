import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import type { FieldChip, StateChip } from './battle-view';

/** Small status chips for a fighter: Substitute, Confused, Tera … (labels are translated). */
@Component({
  selector: 'pv-state-chips',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  template: `
    @if (chips().length) {
      <div class="chips" role="list">
        @for (c of chips(); track c.id) {
          <span class="chip" role="listitem" [attr.data-tone]="c.tone">{{ c.label | t }}</span>
        }
      </div>
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .chips {
        display: flex;
        flex-wrap: wrap;
        gap: 0.25rem;
        margin-top: 0.25rem;
      }
      .chip {
        padding: 0.05rem 0.45rem;
        border-radius: 999px;
        font-size: var(--fs-xs, 0.75rem);
        font-weight: 700;
        line-height: 1.5;
        color: var(--text);
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.16);
      }
      .chip[data-tone='good'] {
        background: rgba(80, 220, 140, 0.2);
        border-color: rgba(80, 220, 140, 0.5);
      }
      .chip[data-tone='bad'] {
        background: rgba(255, 110, 120, 0.2);
        border-color: rgba(255, 110, 120, 0.5);
      }
      .chip[data-tone='info'] {
        background: rgba(120, 180, 255, 0.2);
        border-color: rgba(120, 180, 255, 0.5);
      }
    `,
  ],
})
export class StateChipsComponent {
  readonly chips = input.required<readonly StateChip[]>();
}

/** The field conditions that belong to one side or to everybody: screens, Tailwind, Trick Room. */
@Component({
  selector: 'pv-field-chips',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  template: `
    @if (chips().length) {
      <ul class="field-chips" aria-label="{{ 'Field conditions' | t }}">
        @for (c of chips(); track c.id) {
          <li [attr.data-owner]="c.owner">
            <span class="who">{{
              (c.owner === 'you' ? 'You' : c.owner === 'foe' ? 'Foe' : 'Field') | t
            }}</span>
            {{ c.label | t }} <small>{{ c.turns }}</small>
          </li>
        }
      </ul>
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .field-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 0.25rem;
        margin: 0.25rem 0 0;
        padding: 0;
        list-style: none;
      }
      li {
        padding: 0.05rem 0.5rem;
        border-radius: 999px;
        font-size: var(--fs-xs, 0.75rem);
        font-weight: 700;
        color: var(--text);
        background: rgba(10, 8, 30, 0.6);
        border: 1px solid rgba(255, 255, 255, 0.2);
        backdrop-filter: blur(6px);
      }
      li[data-owner='you'] {
        border-color: rgba(80, 220, 140, 0.6);
      }
      li[data-owner='foe'] {
        border-color: rgba(255, 110, 120, 0.6);
      }
      .who {
        opacity: 0.7;
        margin-right: 0.15rem;
      }
      small {
        opacity: 0.75;
      }
    `,
  ],
})
export class FieldChipsComponent {
  readonly chips = input.required<readonly FieldChip[]>();
}
