import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { BattleService } from './battle.service';
import { Battle, type Battler, type BattleEvent, type SideIndex } from '../../game/engine';
import { TypeBadgeComponent } from '../../core/ui/type-badge/type-badge';
import { SpinnerComponent } from '../../core/ui/spinner/spinner';
import { PageHeaderComponent } from '../../core/ui/page-header/page-header';
import { PokedexService } from '../pokedex/pokedex.service';
import { titleCase } from '../../core/ui/format';
import { SeededRng } from '../../core/utils/rng';
import { pickWeather, WEATHER_INFO, type Weather } from './battle-weather';

type Phase = 'setup' | 'loading' | 'fighting' | 'done';

@Component({
  selector: 'pv-battle',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TypeBadgeComponent, SpinnerComponent, PageHeaderComponent],
  templateUrl: './battle.html',
  styleUrl: './battle.scss',
})
export class BattleComponent {
  private readonly svc = inject(BattleService);
  private readonly pokedex = inject(PokedexService);
  protected readonly titleCase = titleCase;

  protected readonly phase = signal<Phase>('setup');
  protected readonly error = signal<string | null>(null);
  protected readonly busy = signal(false);

  protected readonly playerInput = signal('');
  protected readonly names = this.pokedex.names;

  protected readonly player = signal<Battler | null>(null);
  protected readonly opponent = signal<Battler | null>(null);

  protected readonly playerHp = signal(0);
  protected readonly playerMaxHp = signal(1);
  protected readonly oppHp = signal(0);
  protected readonly oppMaxHp = signal(1);

  protected readonly log = signal<string[]>([]);
  protected readonly shakeSide = signal<SideIndex | null>(null);
  protected readonly flashSide = signal<SideIndex | null>(null);
  protected readonly winner = signal<SideIndex | null>(null);
  protected readonly weather = signal<Weather>('clear');
  protected readonly weatherInfo = computed(() => WEATHER_INFO[this.weather()]);

  /** Static index arrays used to render weather particles in the template. */
  protected readonly drops = Array.from({ length: 28 }, (_, i) => i);
  protected readonly flakes = Array.from({ length: 24 }, (_, i) => i);
  protected readonly grains = Array.from({ length: 30 }, (_, i) => i);
  protected readonly leaves = Array.from({ length: 12 }, (_, i) => i);

  private battle: Battle | null = null;

  protected readonly playerHpPct = computed(() => (this.playerHp() / this.playerMaxHp()) * 100);
  protected readonly oppHpPct = computed(() => (this.oppHp() / this.oppMaxHp()) * 100);
  protected readonly playerMoves = computed(() => this.player()?.moves ?? []);
  protected readonly outcomeWon = computed(() => this.winner() === 0);

  constructor() {
    void this.pokedex.ensureLoaded();
  }

  protected setPlayerInput(event: Event): void {
    this.playerInput.set((event.target as HTMLInputElement).value);
  }

  protected async start(): Promise<void> {
    const wanted = this.playerInput().trim().toLowerCase();
    this.phase.set('loading');
    this.error.set(null);
    try {
      const playerId = wanted || this.svc.randomId();
      const player = await this.svc.buildBattler(playerId);
      const opponent = await this.svc.buildBattler(this.svc.randomId(player.id));
      this.beginBattle(player, opponent);
    } catch {
      this.error.set('Could not load that Pokémon. Try another name or number.');
      this.phase.set('setup');
    }
  }

  protected async surpriseMe(): Promise<void> {
    this.playerInput.set('');
    await this.start();
  }

  private beginBattle(player: Battler, opponent: Battler): void {
    this.battle = new Battle(player, opponent, Date.now());
    this.player.set(player);
    this.opponent.set(opponent);
    this.playerMaxHp.set(this.battle.player.maxHp);
    this.oppMaxHp.set(this.battle.opponent.maxHp);
    this.playerHp.set(this.battle.player.maxHp);
    this.oppHp.set(this.battle.opponent.maxHp);
    this.winner.set(null);
    const rng = new SeededRng(`${player.id}-${opponent.id}`);
    const weather = pickWeather(player.types, opponent.types, (items) => rng.pick(items));
    this.weather.set(weather);
    const info = WEATHER_INFO[weather];
    this.log.set([
      `A wild ${titleCase(opponent.name)} appeared!`,
      `Go, ${titleCase(player.name)}!`,
      ...(weather === 'clear' ? [] : [`${info.icon} ${info.label}!`]),
    ]);
    this.phase.set('fighting');
  }

  protected async useMove(index: number): Promise<void> {
    if (!this.battle || this.busy() || this.phase() !== 'fighting') return;
    this.busy.set(true);
    const events = this.battle.takeTurn(index);
    await this.playEvents(events);
    this.busy.set(false);
    if (this.battle.state.finished) {
      this.winner.set(this.battle.state.winner);
      this.phase.set('done');
    }
  }

  protected rematch(): void {
    const player = this.player();
    const opponent = this.opponent();
    if (player && opponent) this.beginBattle(player, opponent);
  }

  protected newBattle(): void {
    this.battle = null;
    this.player.set(null);
    this.opponent.set(null);
    this.log.set([]);
    this.winner.set(null);
    this.phase.set('setup');
  }

  /* --------------------------------------------------- event presentation */

  private async playEvents(events: BattleEvent[]): Promise<void> {
    for (const ev of events) {
      switch (ev.kind) {
        case 'move':
          this.append(`${titleCase(ev.attacker)} used ${titleCase(ev.move)}!`);
          await sleep(600);
          break;
        case 'miss':
          this.append(`${titleCase(ev.attacker)}'s attack missed!`);
          await sleep(500);
          break;
        case 'damage': {
          this.flashSide.set(ev.side);
          this.shakeSide.set(ev.side);
          if (ev.side === 0) this.playerHp.set(ev.remainingHp);
          else this.oppHp.set(ev.remainingHp);
          const note = effectivenessNote(ev.effectiveness);
          if (ev.crit) this.append('A critical hit!');
          if (note) this.append(note);
          await sleep(550);
          this.shakeSide.set(null);
          this.flashSide.set(null);
          break;
        }
        case 'status':
          this.append(ev.text);
          await sleep(400);
          break;
        case 'faint':
          this.append(`${titleCase(ev.name)} fainted!`);
          await sleep(700);
          break;
        case 'end':
          this.append(ev.winner === 0 ? 'You won the battle! 🎉' : 'You were defeated…');
          await sleep(300);
          break;
        default:
          break;
      }
    }
  }

  private append(line: string): void {
    this.log.update((l) => [...l, line]);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function effectivenessNote(mult: number): string | null {
  if (mult === 0) return "It doesn't affect the foe…";
  if (mult >= 2) return "It's super effective!";
  if (mult > 0 && mult < 1) return "It's not very effective…";
  return null;
}
