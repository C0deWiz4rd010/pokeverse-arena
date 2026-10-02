import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { IconComponent } from '../icon/icon';
import type { IconName } from '../icon/icons.data';
import { SpinnerComponent } from '../spinner/spinner';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';

/**
 * One consistent block for the three non-content states of a page:
 * loading (spinner), empty (nothing to show) and error (with an optional retry).
 * Announces itself to assistive tech (`status` for loading/empty, `alert` for errors).
 */
@Component({
  selector: 'pv-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, IconComponent, SpinnerComponent],
  template: `
    <div class="state" [class.glass]="card()" [attr.role]="kind() === 'error' ? 'alert' : null">
      @if (kind() === 'loading') {
        <pv-spinner [label]="title()" />
      } @else {
        <span class="icon" aria-hidden="true">
          <pv-icon [name]="icon() ?? (kind() === 'error' ? 'triangle-alert' : 'search')" [size]="28" />
        </span>
        @if (title()) { <strong class="title">{{ title() | t }}</strong> }
        @if (text()) { <p class="text">{{ text() }}</p> }
        @if (actionLabel()) {
          <button class="btn btn-primary" type="button" (click)="action.emit()">{{ actionLabel() }}</button>
        }
      }
    </div>
  `,
  styles: [
    `
      :host { display: block; }
      .state {
        display: grid;
        place-items: center;
        align-content: center;
        gap: 0.75rem;
        min-height: 12rem;
        padding: 2rem 1rem;
        text-align: center;
        color: var(--text-dim);
      }
      .icon { color: var(--accent); }
      .title { color: var(--text); font-size: 1.05rem; }
      .text { margin: 0; max-width: 34rem; }
    `,
  ],
})
export class StateComponent {
  readonly kind = input.required<'loading' | 'empty' | 'error'>();
  readonly title = input<string>('');
  readonly text = input<string>('');
  readonly icon = input<IconName>();
  /** Label of the optional button (retry / clear filters …); emits {@link action}. */
  readonly actionLabel = input<string>('');
  /** Wrap in the glass card style. */
  readonly card = input(true);
  readonly action = output<void>();
}
