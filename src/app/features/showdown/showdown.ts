import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { PokeApiClient } from '../../core/api/pokeapi.client';
import { endpoints, officialArtwork } from '../../core/api/pokeapi-endpoints';
import type { PokemonDto } from '../../core/dto/pokeapi.dto';
import { SaveService } from '../../core/storage/save.service';
import { HapticsService } from '../../core/haptics/haptics.service';
import { ToastService } from '../../core/ui/toast/toast.service';
import { PageHeaderComponent } from '../../core/ui/page-header/page-header';
import { TypeBadgeComponent } from '../../core/ui/type-badge/type-badge';
import { titleCase } from '../../core/ui/format';
import {
  SHOWDOWN_STATS,
  type ShowdownMon,
  type ShowdownStat,
  isCorrect,
  shareText,
  statValue,
} from '../../game/showdown/showdown-logic';

const MAX_ID = 1025;

type Phase = 'intro' | 'loading' | 'playing' | 'reveal' | 'over';

/**
 * Stat Showdown — a fast, swipe/tap "higher-or-lower" duel. Two Pokémon appear;
 * guess which wins the highlighted base stat. Correct picks build a streak, one
 * miss ends the run. Fully mobile-first: stacked cards on phones, side-by-side
 * on desktop, arrow keys on hardware keyboards.
 */
@Component({
  selector: 'pv-showdown',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeaderComponent, TypeBadgeComponent],
  host: { '(document:keydown)': 'onKey($event)' },
  template: `
    <pv-page-header title="Stat Showdown" subtitle="Higher or lower — guess the stronger stat" icon="dices" />

    @if (phase() === 'intro') {
      <section class="intro glass">
        <p class="lead">Two Pokémon. One stat. Pick the winner and stack your streak.</p>
        <ul class="rules">
          <li>🎯 Tap the Pokémon you think wins the highlighted stat.</li>
          <li>🔥 Every correct pick grows your streak.</li>
          <li>💥 One miss ends the run — ties always count for you.</li>
        </ul>
        <p class="best">Best streak: <strong>{{ best() }}</strong></p>
        <button class="btn btn-primary big" type="button" (click)="start()">Start Showdown</button>
      </section>
    }

    @if (phase() !== 'intro') {
      <div class="hud">
        <span class="chip">🔥 Streak <strong>{{ streak() }}</strong></span>
        <span class="chip">🏅 Best <strong>{{ best() }}</strong></span>
      </div>

      <div class="prompt">
        <span class="q">Which has the</span>
        <span class="stat-label">{{ stat().label }}?</span>
      </div>

      <div class="arena" [class.revealing]="phase() === 'reveal' || phase() === 'over'">
        @for (side of sides; track side) {
          @if (mon(side); as m) {
            <button
              class="card glass"
              type="button"
              [class.picked]="picked() === side"
              [class.win]="revealed() && sideWins(side)"
              [class.lose]="revealed() && !sideWins(side)"
              [disabled]="phase() !== 'playing'"
              (click)="pick(side)"
            >
              <img class="art" [src]="m.artwork" [alt]="m.name" loading="eager" decoding="async" />
              <span class="mon-name">{{ display(m.name) }}</span>
              <span class="types">
                @for (t of m.types; track t) { <pv-type-badge [type]="t" /> }
              </span>
              @if (revealed()) {
                <span class="value" [class.hi]="sideWins(side)">{{ valueOf(m) }}</span>
              } @else {
                <span class="tap-hint">Tap to pick</span>
              }
            </button>
          } @else {
            <div class="card glass skeleton"><span class="spin"></span></div>
          }
        }
        <div class="vs" aria-hidden="true">VS</div>
      </div>

      @if (phase() === 'over') {
        <section class="over glass">
          <h2>{{ streak() > 0 ? 'Run over!' : 'So close!' }}</h2>
          <p class="final">You reached a streak of <strong>{{ streak() }}</strong>.</p>
          @if (newBest()) { <p class="record">🏆 New personal best!</p> }
          <div class="over-actions">
            <button class="btn btn-primary" type="button" (click)="start()">Play again</button>
            <button class="btn" type="button" (click)="share()">Share</button>
          </div>
        </section>
      }
    }
  `,
  styleUrl: './showdown.scss',
})
export class ShowdownComponent {
  private readonly api = inject(PokeApiClient);
  private readonly save = inject(SaveService);
  private readonly haptics = inject(HapticsService);
  private readonly toast = inject(ToastService);

  protected readonly sides = ['left', 'right'] as const;

  protected readonly phase = signal<Phase>('intro');
  protected readonly left = signal<ShowdownMon | null>(null);
  protected readonly right = signal<ShowdownMon | null>(null);
  protected readonly stat = signal<ShowdownStat>(SHOWDOWN_STATS[0]);
  protected readonly streak = signal(0);
  protected readonly best = signal(this.save.read('showdown-best', 0));
  protected readonly picked = signal<'left' | 'right' | null>(null);
  protected readonly newBest = signal(false);

  private token = 0;

  protected mon(side: 'left' | 'right'): ShowdownMon | null {
    return side === 'left' ? this.left() : this.right();
  }

  protected revealed(): boolean {
    return this.phase() === 'reveal' || this.phase() === 'over';
  }

  protected sideWins(side: 'left' | 'right'): boolean {
    const l = this.left();
    const r = this.right();
    if (!l || !r) return false;
    const lv = statValue(l, this.stat().key);
    const rv = statValue(r, this.stat().key);
    if (lv === rv) return true; // tie: both glow
    return side === 'left' ? lv > rv : rv > lv;
  }

  protected valueOf(m: ShowdownMon): number {
    return statValue(m, this.stat().key);
  }

  protected display(name: string): string {
    return titleCase(name.replace(/-/g, ' '));
  }

  protected async start(): Promise<void> {
    this.streak.set(0);
    this.newBest.set(false);
    this.haptics.fire('select');
    await this.loadRound();
  }

  protected onKey(e: KeyboardEvent): void {
    if (this.phase() !== 'playing') return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); this.pick('left'); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); this.pick('right'); }
  }

  protected pick(side: 'left' | 'right'): void {
    if (this.phase() !== 'playing') return;
    const l = this.left();
    const r = this.right();
    if (!l || !r) return;

    this.picked.set(side);
    const correct = isCorrect(side, l, r, this.stat().key);
    this.phase.set('reveal');

    if (correct) {
      this.haptics.fire('success');
      this.streak.update((s) => s + 1);
      setTimeout(() => this.loadRound(), 1150);
    } else {
      this.haptics.fire('error');
      const isRecord = this.streak() > this.best();
      if (isRecord) {
        this.best.set(this.streak());
        this.save.write('showdown-best', this.streak());
        this.newBest.set(true);
      }
      setTimeout(() => this.phase.set('over'), 900);
    }
  }

  protected async share(): Promise<void> {
    const text = shareText(this.streak(), this.best());
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ text });
      } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        this.toast.show({ title: 'Copied to clipboard', icon: 'copy', kind: 'info' });
      }
    } catch {
      /* user dismissed the share sheet — nothing to do */
    }
  }

  private async loadRound(): Promise<void> {
    const run = ++this.token;
    this.phase.set('loading');
    this.picked.set(null);
    this.left.set(null);
    this.right.set(null);
    this.stat.set(SHOWDOWN_STATS[Math.floor(Math.random() * SHOWDOWN_STATS.length)]);

    const [a, b] = await Promise.all([this.fetchMon(), this.fetchMon()]);
    let second = b;
    let guard = 0;
    while (second.id === a.id && guard++ < 5) second = await this.fetchMon();

    if (run !== this.token) return; // a newer round superseded this one
    this.left.set(a);
    this.right.set(second);
    this.phase.set('playing');
  }

  private async fetchMon(): Promise<ShowdownMon> {
    for (let attempt = 0; attempt < 6; attempt++) {
      const id = 1 + Math.floor(Math.random() * MAX_ID);
      try {
        const dto = await this.api.get<PokemonDto>(endpoints.pokemon(id));
        return this.toMon(dto);
      } catch {
        /* transient miss — try another id */
      }
    }
    // Deterministic fallback so a round can always start.
    const dto = await this.api.get<PokemonDto>(endpoints.pokemon(25));
    return this.toMon(dto);
  }

  private toMon(dto: PokemonDto): ShowdownMon {
    const stats = {
      hp: 0,
      attack: 0,
      defense: 0,
      'special-attack': 0,
      'special-defense': 0,
      speed: 0,
    } as ShowdownMon['stats'];
    let bst = 0;
    for (const s of dto.stats) {
      const key = s.stat.name as keyof ShowdownMon['stats'];
      if (key in stats) stats[key] = s.base_stat;
      bst += s.base_stat;
    }
    return {
      id: dto.id,
      name: dto.name,
      artwork: officialArtwork(dto.id),
      types: dto.types.map((t) => t.type.name),
      stats,
      bst,
    };
  }
}
