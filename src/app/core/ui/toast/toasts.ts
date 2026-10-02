import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ToastService } from './toast.service';
import { IconComponent } from '../icon/icon';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';

/** Fixed bottom-right stack rendering the global {@link ToastService} queue. */
@Component({
  selector: 'pv-toasts',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, IconComponent],
  template: `
    <div class="stack" role="status" aria-live="polite">
      @for (t of svc.toasts(); track t.id) {
        <button
          type="button"
          class="toast glass"
          [class.achievement]="t.kind === 'achievement'"
          (click)="svc.dismiss(t.id)"
          (mouseenter)="svc.pause(t.id)"
          (mouseleave)="svc.resume(t.id)"
          (focus)="svc.pause(t.id)"
          (blur)="svc.resume(t.id)"
          [attr.title]="'Dismiss' | t"
        >
          <span class="t-icon" aria-hidden="true"><pv-icon [name]="t.icon" /></span>
          <span class="t-body">
            <strong>{{ t.title | t }}</strong>
            @if (t.text) { <span class="t-text">{{ t.text | t }}</span> }
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
