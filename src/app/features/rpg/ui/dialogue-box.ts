import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  OnDestroy,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { RpgService } from '../rpg.service';

const REDUCED =
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Character keys that ship a Ninja Adventure faceset in public/rpg/facesets. */
const FACE_KEYS = new Set(['boy', 'girl', 'prof', 'nurse', 'clerk', 'leader', 'oldman']);

/** Classic dialogue box with a typewriter reveal and choice options. */
@Component({
  selector: 'pv-dialogue-box',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (svc.dialogue(); as d) {
      <div class="dbox" [class.with-face]="!!faceUrl()" (click)="onAdvance()">
        @if (faceUrl(); as f) {
          <span class="face" aria-hidden="true"><img [src]="f" alt="" /></span>
        }
        @if (d.speaker) { <span class="speaker">{{ d.speaker }}</span> }
        <p class="text">{{ shown() }}<span class="caret" [class.show]="!revealed()">▌</span></p>

        @if (d.choices && revealed()) {
          <div class="choices" (click)="$event.stopPropagation()">
            @for (c of d.choices; track $index; let i = $index) {
              <button type="button" (click)="choose(i)">{{ c }}</button>
            }
          </div>
        } @else if (revealed()) {
          <span class="next" aria-hidden="true">▾</span>
        }
      </div>
    }
  `,
  styleUrl: './dialogue-box.scss',
})
export class DialogueBoxComponent implements OnDestroy {
  protected readonly svc = inject(RpgService);
  protected readonly shown = signal('');
  protected readonly revealed = signal(false);
  private timer: ReturnType<typeof setInterval> | null = null;
  private full = '';

  protected readonly hasChoices = computed(() => !!this.svc.dialogue()?.choices?.length);

  /** Faceset portrait URL for known character keys (hidden for anything else). */
  protected readonly faceUrl = computed(() => {
    const key = this.svc.dialogue()?.portrait;
    return key && FACE_KEYS.has(key) ? `rpg/facesets/nj-face-${key}.png` : null;
  });

  constructor() {
    effect(() => {
      const d = this.svc.dialogue();
      this.stop();
      this.full = d?.text ?? '';
      // the speaker label already names them — drop a redundant "Name: " prefix
      if (d?.speaker && this.full.startsWith(`${d.speaker}: `)) {
        this.full = this.full.slice(d.speaker.length + 2);
      }
      if (!d) {
        this.shown.set('');
        this.revealed.set(false);
        return;
      }
      if (REDUCED) {
        this.shown.set(this.full);
        this.revealed.set(true);
        return;
      }
      this.shown.set('');
      this.revealed.set(false);
      let i = 0;
      this.timer = setInterval(() => {
        i++;
        this.shown.set(this.full.slice(0, i));
        if (i >= this.full.length) {
          this.revealed.set(true);
          this.stop();
        }
      }, 18);
    });
  }

  ngOnDestroy(): void {
    this.stop();
  }

  @HostListener('document:keydown', ['$event'])
  protected onKey(e: KeyboardEvent): void {
    if (this.hasChoices() && this.revealed()) {
      const n = Number(e.key);
      const len = this.svc.dialogue()?.choices?.length ?? 0;
      if (n >= 1 && n <= len) {
        e.preventDefault();
        this.choose(n - 1);
      }
      return;
    }
    if (e.key === 'z' || e.key === 'Z' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this.onAdvance();
    }
  }

  protected onAdvance(): void {
    if (this.hasChoices()) return;
    if (!this.revealed()) {
      this.shown.set(this.full);
      this.revealed.set(true);
      this.stop();
      return;
    }
    this.svc.advance();
  }

  protected choose(i: number): void {
    this.svc.choose(i);
  }

  private stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}
