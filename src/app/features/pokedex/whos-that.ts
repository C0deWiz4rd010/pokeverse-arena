import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { IconComponent } from '../../core/ui/icon/icon';
import { CryService } from '../../core/audio/cry.service';
import { titleCase } from '../../core/ui/format';
import { officialArtwork } from '../../core/api/pokeapi-endpoints';
import type { PokedexEntry } from '../../core/models/pokemon.model';

/** "Who's That Pokémon?" — guess the silhouette from three choices. */
@Component({
  selector: 'pv-whos-that',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="backdrop" (click)="close.emit()"></div>
    <div class="panel" role="dialog" aria-label="Who's That Pokémon?">
      <header class="head">
        <h2>Who’s That Pokémon?</h2>
        <button class="x" type="button" (click)="close.emit()" aria-label="Close"><pv-icon name="x" /></button>
      </header>

      <div class="score">
        <span>Streak <strong>{{ streak() }}</strong></span>
        <span>Best <strong>{{ best() }}</strong></span>
      </div>

      @if (answer(); as a) {
        <div class="silhouette" [class.revealed]="revealed()">
          <img [src]="art(a)" [alt]="revealed() ? a.name : 'Mystery Pokémon'" />
        </div>

        @if (revealed()) {
          <p class="verdict" [class.right]="lastCorrect()" [class.wrong]="!lastCorrect()">
            {{ lastCorrect() ? "It's " : 'It was ' }}<strong>{{ titleCase(a.name) }}</strong>{{ lastCorrect() ? '!' : '.' }}
          </p>
          <button class="btn next" type="button" (click)="newRound()">Next ›</button>
        } @else {
          <div class="options">
            @for (o of options(); track o.id) {
              <button class="opt" type="button" (click)="guess(o)">{{ titleCase(o.name) }}</button>
            }
          </div>
        }
      } @else {
        <p class="loading">Shuffling the tall grass…</p>
      }
    </div>
  `,
  styleUrl: './whos-that.scss',
})
export class WhosThatComponent {
  readonly pool = input.required<readonly PokedexEntry[]>();
  readonly close = output<void>();

  private readonly cry = inject(CryService);
  protected readonly titleCase = titleCase;

  protected readonly answer = signal<PokedexEntry | null>(null);
  protected readonly options = signal<PokedexEntry[]>([]);
  protected readonly revealed = signal(false);
  protected readonly lastCorrect = signal(false);
  protected readonly streak = signal(0);
  protected readonly best = signal(0);

  constructor() {
    this.newRound();
  }

  protected art(a: PokedexEntry): string {
    return officialArtwork(a.id);
  }

  protected newRound(): void {
    const pool = this.pool();
    if (pool.length < 3) return;
    const answer = pool[Math.floor(Math.random() * pool.length)];
    const opts = new Set<PokedexEntry>([answer]);
    let guard = 0;
    while (opts.size < 3 && guard++ < 50) opts.add(pool[Math.floor(Math.random() * pool.length)]);
    this.answer.set(answer);
    this.options.set(shuffle([...opts]));
    this.revealed.set(false);
  }

  protected guess(option: PokedexEntry): void {
    const answer = this.answer();
    if (!answer || this.revealed()) return;
    const correct = option.id === answer.id;
    this.lastCorrect.set(correct);
    this.revealed.set(true);
    if (correct) {
      this.cry.play(answer.id);
      const s = this.streak() + 1;
      this.streak.set(s);
      if (s > this.best()) this.best.set(s);
    } else {
      this.streak.set(0);
    }
  }
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
