import { Injectable, computed, inject, signal } from '@angular/core';
import { SeededRng, dailySeed } from '../../core/utils/rng';
import type { Battler, ItemId } from '../../game/engine';
import type { BracketMatch, Trainer } from '../../game/tournament';
import { fuseBattlers } from '../../game/fusion/fusion';
import {
  TOTAL_FLOORS,
  applyRelicsToTeam,
  generateFloorChoices,
  generateRewards,
  generateShop,
  loadMeta,
  recordChimeraWin,
  recordRun,
  relicById,
  type FoeSpec,
  type RelicId,
  type RewardOption,
  type RunPhase,
  type ShopEntry,
  type SpireMeta,
  type SpireNode,
} from '../../game/spire';
import { coinsEarned, equipFirstFree, grantRelic } from '../../game/run/run-economy';
import { parseSpireRun, type SpireRunSnapshot } from '../../game/run/run-snapshot';
import { BattlerFactory } from '../../core/battle/battler-factory';
import { SaveService } from '../../core/storage/save.service';
import type { MatchOutcome, PlayerMatchSetup } from '../../game/tournament';

const PLAYER_LEVEL = 65;
const PARTY_CAP = 6;
const DRAFT_POOL = 6;
const DEX_MAX = 1025;
const RUN_KEY = 'spire:run';

function avatar(seed: string, accent = false): string {
  const params = new URLSearchParams({
    seed,
    radius: '50',
    backgroundType: 'gradientLinear',
    backgroundColor: accent ? 'ffd166,ffb703,fb8500' : 'b6e3f4,c0aede,d1d4f9,ffd5dc',
  });
  return `https://api.dicebear.com/9.x/adventurer/svg?${params.toString()}`;
}

/**
 * Ascension Spire run orchestration: a seeded climb of {@link TOTAL_FLOORS}
 * floors. The party persists with carried HP (no full heal), the player drafts
 * rewards and relics, spends coins in shops, and the deepened battle engine powers
 * every fight via the shared match component. Meta-progression is persisted.
 */
@Injectable({ providedIn: 'root' })
export class SpireService {
  private readonly battle = inject(BattlerFactory);
  private readonly save = inject(SaveService);

  readonly phase = signal<RunPhase>('setup');
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  readonly floor = signal(0);
  readonly coins = signal(0);
  readonly relics = signal<RelicId[]>([]);
  readonly meta = signal<SpireMeta>(loadMeta());
  /** A run saved at the start of its latest floor — offered as "Continue run". */
  readonly savedRun = signal<SpireRunSnapshot | null>(parseSpireRun(this.save.read(RUN_KEY, null)));

  readonly draftPool = signal<Battler[]>([]);
  readonly choices = signal<SpireNode[]>([]);
  readonly rewards = signal<RewardOption[]>([]);
  readonly shop = signal<ShopEntry[]>([]);
  readonly setup = signal<PlayerMatchSetup | null>(null);
  readonly toast = signal<string | null>(null);

  /** Party members + carried HP fraction (0..1). */
  private readonly party = signal<Battler[]>([]);
  private readonly hpFraction = signal<number[]>([]);
  private seed = '';
  private pendingNode: SpireNode | null = null;
  /** The relic-boosted team built for the active fight (for HP read-back). */
  private activeTeam: Battler[] = [];
  /** The fused ace of a chimera boss fight — recruitable once beaten. */
  private pendingChimera: Battler | null = null;

  readonly relicList = computed(() =>
    this.relics()
      .map((id) => relicById(id))
      .filter((r) => !!r),
  );
  readonly partyView = computed(() =>
    this.party().map((m, i) => ({ mon: m, hpPct: Math.round((this.hpFraction()[i] ?? 0) * 100) })),
  );
  readonly totalFloors = TOTAL_FLOORS;

  /* --------------------------------------------------------------- setup */

  async newRun(daily = false): Promise<void> {
    this.seed = daily ? dailySeed('spire') : `spire-${Math.floor(Math.random() * 1e9)}`;
    this.phase.set('setup');
    this.busy.set(true);
    this.error.set(null);
    try {
      const rng = new SeededRng(`${this.seed}-draft`);
      const ids = new Set<number>();
      while (ids.size < DRAFT_POOL) ids.add(rng.int(1, DEX_MAX));
      const pool = await Promise.all(
        [...ids].map((id) => this.battle.buildBattler(id, PLAYER_LEVEL)),
      );
      this.draftPool.set(pool);
    } catch {
      this.error.set('Could not prepare the spire. Try again.');
    } finally {
      this.busy.set(false);
    }
  }

  confirmStarters(picks: Battler[]): void {
    if (picks.length === 0) return;
    this.party.set(picks.slice(0, 3));
    this.hpFraction.set(this.party().map(() => 1));
    this.coins.set(0);
    this.relics.set([]);
    this.floor.set(0);
    this.toast.set(null);
    this.advanceFloor();
  }

  /* ---------------------------------------------------------------- map */

  private advanceFloor(): void {
    this.pendingChimera = null;
    const next = this.floor() + 1;
    if (next > TOTAL_FLOORS) {
      this.endRun(true);
      return;
    }
    this.floor.set(next);
    this.choices.set(generateFloorChoices(next, this.seed, this.meta().ascension));
    this.phase.set('map');
    this.persistRun();
  }

  /** Pick up the saved run at the start of the floor it was saved on. */
  resumeRun(): void {
    const run = this.savedRun();
    if (!run) return;
    this.seed = run.seed;
    this.party.set(run.party);
    this.hpFraction.set(run.hpFraction);
    this.coins.set(run.coins);
    this.relics.set(run.relics);
    this.floor.set(run.floor);
    this.choices.set(run.choices);
    this.pendingChimera = null;
    this.pendingNode = null;
    this.setup.set(null);
    this.toast.set(null);
    this.error.set(null);
    this.phase.set('map');
  }

  private persistRun(): void {
    const snapshot: SpireRunSnapshot = {
      seed: this.seed,
      floor: this.floor(),
      coins: this.coins(),
      relics: this.relics(),
      party: this.party(),
      hpFraction: this.hpFraction(),
      choices: this.choices(),
    };
    this.save.write(RUN_KEY, snapshot);
    this.savedRun.set(snapshot);
  }

  private clearSavedRun(): void {
    this.save.remove(RUN_KEY);
    this.savedRun.set(null);
  }

  async chooseNode(node: SpireNode): Promise<void> {
    this.toast.set(null);
    switch (node.type) {
      case 'battle':
      case 'elite':
      case 'boss':
        await this.startBattle(node);
        break;
      case 'rest':
        this.healParty(0.5);
        this.toast.set('Your party rests and recovers.');
        this.advanceFloor();
        break;
      case 'treasure':
        this.grantTreasure();
        this.advanceFloor();
        break;
      case 'event':
        this.runEvent();
        this.advanceFloor();
        break;
      case 'shop':
        this.shop.set(generateShop(this.floor(), this.seed));
        this.phase.set('shop');
        break;
    }
  }

  /* -------------------------------------------------------------- battle */

  private async startBattle(node: SpireNode): Promise<void> {
    const foeSpec = node.foe!;
    this.busy.set(true);
    this.error.set(null);
    try {
      const foeTeam = await this.buildFoe(foeSpec);
      this.pendingChimera = foeSpec.fusion ? (foeTeam[foeTeam.length - 1] ?? null) : null;
      const playerTeam = applyRelicsToTeam(this.party(), this.relics());
      this.activeTeam = playerTeam;
      const startHp = playerTeam.map((m, i) =>
        Math.max(1, Math.round((this.hpFraction()[i] ?? 1) * m.stats.hp)),
      );
      const player: Trainer = {
        id: 'player',
        name: 'You',
        title: 'Climber',
        avatar: avatar('Spire-Ace', true),
        team: playerTeam,
        isPlayer: true,
      };
      const foeTitle = foeSpec.fusion
        ? 'Chimera Keeper'
        : foeSpec.boss
          ? 'Floor Guardian'
          : 'Challenger';
      const foe: Trainer = {
        id: foeSpec.name,
        name: foeSpec.name,
        title: foeTitle,
        avatar: avatar(foeSpec.name, foeSpec.boss),
        team: foeTeam,
      };
      const match: BracketMatch = {
        id: `spire-${this.floor()}`,
        round: 'final',
        slot: 0,
        a: player,
        b: foe,
        winner: null,
        played: false,
      };
      this.pendingNode = node;
      const foeAce = this.pendingChimera
        ? `"Behold ${this.pendingChimera.name} — my forbidden splice!"`
        : undefined;
      this.setup.set({
        match,
        round: 'final',
        player,
        foe,
        playerTeam,
        foeTeam,
        aiTier: foeSpec.aiTier,
        playerStartHp: startHp,
        foeAce,
      });
      this.phase.set('battle');
    } catch {
      this.error.set('The challenger never showed. Try the floor again.');
      this.phase.set('map');
    } finally {
      this.busy.set(false);
    }
  }

  onBattleFinished(outcome: MatchOutcome): void {
    this.setup.set(null);
    // Read carried HP back as fractions of the (relic-boosted) max HP.
    this.hpFraction.set(
      this.activeTeam.map((m, i) =>
        Math.max(0, Math.min(1, (outcome.playerFinalHp[i] ?? 0) / m.stats.hp)),
      ),
    );
    if (!outcome.playerWon) {
      this.endRun(false);
      return;
    }
    const boss = this.pendingNode?.type === 'boss';
    const elite = this.pendingNode?.type === 'elite';
    const base = 25 + this.floor() * 6 + (boss ? 80 : elite ? 30 : 0);
    this.addCoins(base);
    let rewards = generateRewards(this.floor(), `${this.seed}-r${this.floor()}`, this.relics());
    if (this.pendingChimera) {
      // A beaten chimera can be tamed — the rarest draft in the Spire.
      this.meta.set(recordChimeraWin(this.meta()));
      this.addCoins(60);
      rewards = [
        {
          kind: 'chimera',
          label: `Tame ${this.pendingChimera.name}`,
          icon: 'flask-conical',
          blurb: 'The defeated chimera joins your party.',
          payload: 0,
        },
        ...rewards,
      ];
    }
    this.rewards.set(rewards);
    this.phase.set('reward');
  }

  /* -------------------------------------------------------------- rewards */

  chooseReward(option: RewardOption): void {
    this.applyReward(option);
    this.rewards.set([]);
    this.advanceFloor();
  }

  skipReward(): void {
    this.rewards.set([]);
    this.advanceFloor();
  }

  private applyReward(option: RewardOption): void {
    switch (option.kind) {
      case 'coins':
        this.addCoins(Number(option.payload));
        break;
      case 'heal':
        this.healParty(Number(option.payload));
        break;
      case 'relic':
        this.addRelic(option.payload as RelicId);
        break;
      case 'item':
        this.equipItem(option.payload as ItemId);
        break;
      case 'mon':
        void this.recruit(Number(option.payload));
        break;
      case 'chimera':
        this.recruitChimera();
        break;
    }
  }

  /* ----------------------------------------------------------------- shop */

  buy(entry: ShopEntry): void {
    if (this.coins() < entry.cost) return;
    this.coins.update((c) => c - entry.cost);
    switch (entry.kind) {
      case 'item':
        this.equipItem(entry.payload as ItemId);
        break;
      case 'relic':
        this.addRelic(entry.payload as RelicId);
        break;
      case 'heal':
        this.healParty(Number(entry.payload));
        break;
      case 'mon':
        void this.recruit(Number(entry.payload));
        break;
    }
    // Mark as bought by removing from the stock.
    this.shop.update((s) => s.filter((e) => e !== entry));
  }

  leaveShop(): void {
    this.shop.set([]);
    this.advanceFloor();
  }

  /* --------------------------------------------------------------- abandon */

  abandon(): void {
    if (
      this.phase() === 'battle' ||
      this.phase() === 'map' ||
      this.phase() === 'reward' ||
      this.phase() === 'shop'
    ) {
      this.endRun(false);
    } else {
      this.phase.set('setup');
    }
  }

  backToHub(): void {
    this.phase.set('setup');
    this.draftPool.set([]);
  }

  /* --------------------------------------------------------------- helpers */

  private endRun(cleared: boolean): void {
    this.clearSavedRun();
    this.meta.set(recordRun(this.meta(), this.floor(), this.coins(), cleared));
    this.phase.set(cleared ? 'won' : 'lost');
  }

  private healParty(fraction: number): void {
    this.hpFraction.set(this.hpFraction().map((f) => Math.min(1, f + fraction)));
  }

  private addCoins(n: number): void {
    const gain = coinsEarned(n, this.relics());
    if (gain > 0) this.coins.update((c) => c + gain);
  }

  private addRelic(id: RelicId): void {
    const grant = grantRelic(this.relics(), id);
    if (grant.duplicate) {
      this.addCoins(grant.refund); // duplicate relic refunds a little
      return;
    }
    this.relics.set([...grant.relics]);
    this.toast.set(`Relic gained: ${relicById(id)?.name}`);
  }

  private equipItem(item: ItemId): void {
    const { party, index } = equipFirstFree(this.party(), item);
    this.party.set(party);
    this.toast.set(`${party[index]!.name} is now holding an item.`);
  }

  /** Add the beaten chimera boss ace to the party, fully healed and itemless. */
  private recruitChimera(): void {
    const chimera = this.pendingChimera;
    this.pendingChimera = null;
    if (!chimera) return;
    if (this.party().length >= PARTY_CAP) {
      this.addCoins(90);
      this.toast.set('Party full — the chimera dissolves into coins.');
      return;
    }
    this.party.set([...this.party(), { ...chimera, item: undefined }]);
    this.hpFraction.set([...this.hpFraction(), 1]);
    this.toast.set(`${chimera.name} was tamed and joined your party!`);
  }

  private async recruit(dex: number): Promise<void> {
    if (this.party().length >= PARTY_CAP) {
      this.addCoins(60);
      this.toast.set('Party full — recruit converted to coins.');
      return;
    }
    try {
      const mon = await this.battle.buildBattler(dex, PLAYER_LEVEL);
      this.party.set([...this.party(), mon]);
      this.hpFraction.set([...this.hpFraction(), 1]);
      this.toast.set(`${mon.name} joined your party!`);
    } catch {
      /* recruit failed silently */
    }
  }

  private grantTreasure(): void {
    const rng = new SeededRng(`treasure-${this.seed}-${this.floor()}`);
    this.addCoins(40 + this.floor() * 8);
    const relics = [
      'lucky-coin',
      'leftovers-aura',
      'swift-feather',
      'guardian-shell',
      'focus-charm',
    ] as RelicId[];
    this.addRelic(rng.pick(relics));
  }

  private runEvent(): void {
    const rng = new SeededRng(`event-${this.seed}-${this.floor()}`);
    const roll = rng.int(0, 2);
    if (roll === 0) {
      this.healParty(0.35);
      this.toast.set('A hidden spring restores your party.');
    } else if (roll === 1) {
      this.addCoins(60);
      this.toast.set('You find a cache of coins.');
    } else {
      this.equipItem(rng.pick(['leftovers', 'sitrus-berry', 'life-orb', 'choice-scarf']));
      this.toast.set('A wandering merchant gifts you an item.');
    }
  }

  private async buildFoe(spec: FoeSpec): Promise<Battler[]> {
    const built = await Promise.all(
      spec.species.map((id) => this.battle.buildBattler(id, spec.level).catch(() => null)),
    );
    const team = built.filter((b): b is Battler => b !== null);
    if (spec.fusion) {
      // The keeper's ace: both donors are built two levels hot, then spliced.
      const [head, body] = await Promise.all([
        this.battle.buildBattler(spec.fusion.head, spec.level + 2),
        this.battle.buildBattler(spec.fusion.body, spec.level + 2),
      ]);
      team.push(fuseBattlers(head, body));
    }
    if (!team.length) throw new Error('no foe');
    return team;
  }
}
