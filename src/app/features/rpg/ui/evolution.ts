import { ChangeDetectionStrategy, Component, OnDestroy, afterNextRender, inject, signal } from '@angular/core';
import { RpgService } from '../rpg.service';
import { officialArtwork } from '../../../core/api/pokeapi-endpoints';
import { titleCase } from '../../../core/ui/format';

const REDUCED =
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Plays the queued post-battle evolutions: pulse → white flash → reveal. */
@Component({
  selector: 'pv-evolution',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="evo" (click)="skip()">
      <img class="evo-sprite" [class.flash]="flash()" [class.pulse]="pulse()" [src]="art(spriteId())" [alt]="caption()" />
      <p class="evo-text">{{ caption() }}</p>
    </div>
  `,
  styleUrl: './evolution.scss',
})
export class EvolutionComponent implements OnDestroy {
  private readonly svc = inject(RpgService);
  protected readonly art = (id: number) => officialArtwork(id);
  protected readonly spriteId = signal(0);
  protected readonly caption = signal('');
  protected readonly flash = signal(false);
  protected readonly pulse = signal(false);

  private i = 0;
  private timers: ReturnType<typeof setTimeout>[] = [];
  private advancing = false;

  constructor() {
    afterNextRender(() => this.runEntry(0));
  }

  ngOnDestroy(): void {
    this.timers.forEach(clearTimeout);
  }

  private at(ms: number, fn: () => void): void {
    this.timers.push(setTimeout(fn, REDUCED ? Math.min(ms, 200) : ms));
  }

  private runEntry(i: number): void {
    const list = this.svc.evolutions();
    if (i >= list.length) {
      this.svc.finishEvolutions();
      return;
    }
    this.i = i;
    this.advancing = false;
    const e = list[i];
    this.spriteId.set(e.fromId);
    this.caption.set(`What? ${titleCase(e.from)} is evolving!`);
    this.flash.set(false);
    this.pulse.set(true);
    this.at(1300, () => this.flash.set(true));
    this.at(1900, () => {
      void this.svc.applyEvolution(e.uid, e.to, e.toId);
      this.spriteId.set(e.toId);
      this.flash.set(false);
      this.pulse.set(false);
      this.caption.set(`Congratulations! ${titleCase(e.from)} evolved into ${titleCase(e.to)}!`);
    });
    this.at(3600, () => this.next());
  }

  private next(): void {
    if (this.advancing) return;
    this.advancing = true;
    this.timers.forEach(clearTimeout);
    this.timers = [];
    this.runEntry(this.i + 1);
  }

  /** Tap to skip ahead (reveals/advances). */
  protected skip(): void {
    this.next();
  }
}
