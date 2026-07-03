import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ToastService } from './toast.service';
import { IconComponent } from '../icon/icon';

/** Fixed bottom-right stack rendering the global {@link ToastService} queue. */
@Component({
  selector: 'pv-toasts',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="stack" aria-live="polite">
      @for (t of svc.toasts(); track t.id) {
        <button
          type="button"
          class="toast glass"
          [class.achievement]="t.kind === 'achievement'"
          (click)="svc.dismiss(t.id)"
          title="Dismiss"
        >
          <span class="t-icon" aria-hidden="true"><pv-icon [name]="t.icon" /></span>
          <span class="t-body">
            <strong>{{ t.title }}</strong>
            @if (t.text) { <span class="t-text">{{ t.text }}</span> }
          </span>
        </button>
      }
    </div>
  `,
  styleUrl: './toasts.scss',
})
export class ToastsComponent {
  protected readonly svc = inject(ToastService);
}
