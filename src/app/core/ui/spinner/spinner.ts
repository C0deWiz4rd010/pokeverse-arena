import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** A spinning Poke Ball loading indicator. */
@Component({
  selector: 'pv-spinner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="wrap" role="status" [attr.aria-label]="label()">
      <div class="ball">
        <div class="top"></div>
        <div class="bottom"></div>
        <div class="belt"></div>
        <div class="center"></div>
      </div>
      @if (label()) {
        <span class="text">{{ label() }}</span>
      }
    </div>
  `,
  styles: [
    `
      .wrap {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.8rem;
        padding: 1.5rem;
      }
      .ball {
        position: relative;
        width: 56px;
        height: 56px;
        border-radius: 50%;
        border: 3px solid #14122f;
        overflow: hidden;
        animation: spin 1s linear infinite;
        box-shadow: 0 0 22px rgba(108, 224, 255, 0.45);
      }
      .top { position: absolute; inset: 0 0 50% 0; background: linear-gradient(135deg,#ff5d73,#ff9d55); }
      .bottom { position: absolute; inset: 50% 0 0 0; background: #f3f3fb; }
      .belt { position: absolute; top: calc(50% - 3px); left: 0; right: 0; height: 6px; background: #14122f; }
      .center {
        position: absolute; top: 50%; left: 50%;
        width: 16px; height: 16px; transform: translate(-50%, -50%);
        background: #fff; border: 3px solid #14122f; border-radius: 50%;
      }
      .text { color: var(--text-dim); font-size: 0.85rem; }
      @keyframes spin { to { transform: rotate(360deg); } }
      @media (prefers-reduced-motion: reduce) { .ball { animation: none; } }
    `,
  ],
})
export class SpinnerComponent {
  readonly label = input('Loading…');
}
