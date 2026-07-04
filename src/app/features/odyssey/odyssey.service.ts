import { Injectable, computed, inject, signal } from '@angular/core';
import { SeededRng, dailySeed } from '../../core/utils/rng';
import type { AiTier, Battler, ItemId } from '../../game/engine';
import type { BracketMatch, Trainer } from '../../game/tournament';
import { BattleService } from '../battle/battle.service';
import { PokeApiClient } from '../../core/api/pokeapi.client';
import { idFromUrl, officialArtwork } from '../../core/api/pokeapi-endpoints';
import { evolutionAt, levelUpEvolutions } from '../../game/rpg/evolution';
import type { PlayerMatchSetup } from '../tournaments/tournaments.service';
import type { MatchOutcome } from '../tournaments/tournament-match/tournament-match';
import {
  coinsForWave,
  generateOdysseyRewards,
  generateOdysseyShop,
  levelGain,
  loadOdysseyMeta,
  recordOdysseyRun,
  starterRoster,
  unlockSpecies,
  waveSpec,
  type OdysseyMeta,
  type OdysseyReward,
  type OdysseyShopEntry,
  type WaveSpec,
} from '../../game/odyssey/odyssey';
import { applyRelicsToTeam, coinMultiplier, relicById, type RelicId } from '../../game/spire/relics';

export type OdysseyPhase = 'hub' | 'starter' | 'wave' | 'battle' | 'catch' | 'reward' | 'shop' | 'lost';

const PARTY_CAP = 6;
const START_LEVEL = 15;
const START_BALLS = 5;

export interface DazeState {
  readonly dexId: number;
  readonly name: string;
  readonly sprite: string;
  readonly chance: number;
}

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
 * Odyssey run orchestration — an endless seeded march through cycling biomes.
 * Every victory dazes the lead foe for a catch attempt, the team levels (and
 * auto-evolves) between waves, and each caught species permanently joins the
 * starter roster ({@link OdysseyMeta}). Fights reuse `pv-tournament-match`.
 */
@Injectable({ providedIn: 'root' })
export class OdysseyService {
  private readonly battle = inject(BattleService);
  private readonly api = inject(PokeApiClient);

  readonly phase = signal<OdysseyPhase>('hub');
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly toast = signal<string | null>(null);

  readonly meta = signal<OdysseyMeta>(loadOdysseyMeta());
  readonly wave = signal(0);
  readonly balls = signal(0);
  readonly coins = signal(0);
  readonly relics = signal<RelicId[]>([]);
  readonly isDaily = signal(false);
  readonly spec = signal<WaveSpec | null>(null);
  readonly setup = signal<PlayerMatchSetup | null>(null);
  readonly rewards = signal<OdysseyReward[]>([]);
  readonly shop = signal<OdysseyShopEntry[]>([]);
  readonly daze = signal<DazeState | null>(null);
  /** Species (dex ids) newly unlocked during this run, for the summary. */
  readonly runUnlocks = signal<number[]>([]);

  private party: Battler[] = [];
  private hpFraction: number[] = [];
  private seed = '';
  private catchAttempt = 0;
  /** The foe team of the wave just fought (for the daze panel). */
  private lastFoe: Battler[] = [];
  /** The relic-boosted team built for the active fight (for HP read-back). */
  private activeTeam: Battler[] = [];

  readonly partyView = computed(() => {
    this.version();
    return this.party.map((m, i) => ({
      mon: m,
      hpPct: Math.round((this.hpFraction[i] ?? 0) * 100),
    }));
  });
  /** Bumped whenever the private party mutates so computeds refresh. */
  private readonly version = signal(0);

  readonly starters = computed(() => starterRoster(this.meta()));
  readonly relicList = computed(() => this.relics().map((id) => relicById(id)).filter((r) => !!r));

  /* --------------------------------------------------------------- setup */

  startNewRun(daily = false): void {
    this.seed = daily ? dailySeed('odyssey') : `ody-${Math.floor(Math.random() * 1e9)}`;
    this.isDaily.set(daily);
    this.error.set(null);
    this.toast.set(null);
    this.runUnlocks.set([]);
    this.phase.set('starter');
  }

  async pickStarter(dexId: number): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      const mon = await this.battle.buildBattler(dexId, START_LEVEL);
      this.party = [mon];
      this.hpFraction = [1];
      this.balls.set(START_BALLS);
      this.coins.set(0);
      this.relics.set([]);
      this.wave.set(0);
      this.version.update((v) => v + 1);
      await this.nextWave();
    } catch {
      this.error.set('Your starter overslept. Pick again.');
      this.phase.set('starter');
    } finally {
      this.busy.set(false);
    }
  }

  /* ---------------------------------------------------------------- waves */

  private async nextWave(): Promise<void> {
    const wave = this.wave() + 1;
    this.wave.set(wave);
    this.spec.set(waveSpec(wave, this.seed));
    this.phase.set('wave');
  }

  async fight(): Promise<void> {
    const spec = this.spec();
    if (!spec || this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      const foeTeam = (
        await Promise.all(spec.species.map((id) => this.battle.buildBattler(id, spec.level).catch(() => null)))
      ).filter((b): b is Battler => b !== null);
      if (!foeTeam.length) throw new Error('no foe');
      this.lastFoe = foeTeam;
      // Relics boost the live team for this fight; HP rides as fractions of the boosted max.
      const playerTeam = applyRelicsToTeam(this.party, this.relics());
      this.activeTeam = playerTeam;
      const startHp = playerTeam.map((m, i) => Math.max(1, Math.round((this.hpFraction[i] ?? 1) * m.stats.hp)));
      const player: Trainer = { id: 'player', name: 'You', title: 'Wanderer', avatar: avatar('Odyssey-You', true), team: playerTeam, isPlayer: true };
      const foeName = spec.kind === 'boss' ? `${spec.biome.name} Guardian` : spec.kind === 'elite' ? 'Elite Pack' : 'Wild Encounter';
      const foe: Trainer = { id: `w${spec.wave}`, name: foeName, title: spec.biome.name, avatar: avatar(`${spec.biome.id}-${spec.wave}`, spec.kind === 'boss'), team: foeTeam };
      const match: BracketMatch = { id: `ody-${spec.wave}`, round: 'final', slot: 0, a: player, b: foe, winner: null, played: false };
      const aiTier: AiTier = spec.wave < 10 ? 'basic' : spec.wave < 30 ? 'strong' : 'elite';
      // Guardians impose their biome's field condition from turn one.
      const field = spec.kind === 'boss' ? { weather: spec.biome.field.weather, terrain: spec.biome.field.terrain } : undefined;
      this.setup.set({ match, round: 'final', player, foe, playerTeam, foeTeam, aiTier, playerStartHp: startHp, field, accent: spec.biome.tint });
      this.phase.set('battle');
    } catch {
      this.error.set('The wave scattered. Try again.');
      this.phase.set('wave');
    } finally {
      this.busy.set(false);
    }
  }

  onBattleFinished(outcome: MatchOutcome): void {
    this.setup.set(null);
    const ref = this.activeTeam.length === this.party.length ? this.activeTeam : this.party;
    this.hpFraction = ref.map((m, i) => Math.max(0, Math.min(1, (outcome.playerFinalHp[i] ?? 0) / m.stats.hp)));
    this.version.update((v) => v + 1);
    if (!outcome.playerWon) {
      this.endRun();
      return;
    }
    void this.afterVictory();
  }

  private async afterVictory(): Promise<void> {
    const spec = this.spec()!;
    this.addCoins(coinsForWave(spec.wave, spec.kind));
    this.busy.set(true);
    try {
      await this.levelUpTeam(levelGain(spec.kind));
    } finally {
      this.busy.set(false);
    }
    // The defeated lead foe is dazed — one catch window while balls last.
    const dazed = this.lastFoe[this.lastFoe.length - 1];
    const dexId = dazed?.id ?? spec.species[spec.species.length - 1];
    this.catchAttempt = 0;
    this.daze.set({
      dexId,
      name: dazed?.name ?? `#${dexId}`,
      sprite: dazed?.sprite ?? officialArtwork(dexId),
      chance: spec.catchChance,
    });
    this.phase.set('catch');
  }

  /* ---------------------------------------------------------------- catch */

  throwBall(): void {
    const d = this.daze();
    if (!d || this.balls() <= 0) return;
    this.balls.update((b) => b - 1);
    const rng = new SeededRng(`${this.seed}-catch-${this.wave()}-${this.catchAttempt++}`);
    if (rng.chance(d.chance)) {
      void this.captureDazed(d);
      return;
    }
    this.toast.set(this.balls() > 0 ? 'It broke free! Throw again?' : 'It broke free — and that was your last ball.');
    if (this.balls() <= 0) this.finishCatch();
  }

  private async captureDazed(d: DazeState): Promise<void> {
    const wasNew = !this.meta().unlocked.includes(d.dexId);
    this.meta.set(unlockSpecies(this.meta(), d.dexId));
    if (wasNew) this.runUnlocks.update((u) => [...u, d.dexId]);
    if (this.party.length >= PARTY_CAP) {
      this.toast.set(`Caught! The team is full — it joins your starter roster${wasNew ? ' (new!)' : ''}.`);
      this.finishCatch();
      return;
    }
    this.busy.set(true);
    try {
      const spec = this.spec()!;
      const mon = await this.battle.buildBattler(d.dexId, Math.max(START_LEVEL, spec.level - 2));
      this.party = [...this.party, mon];
      this.hpFraction = [...this.hpFraction, 1];
      this.version.update((v) => v + 1);
      this.toast.set(`Caught! ${mon.name} joins the march${wasNew ? ' — new starter unlocked!' : ''}.`);
    } catch {
      this.toast.set('Caught! It joins your starter roster.');
    } finally {
      this.busy.set(false);
      this.finishCatch();
    }
  }

  skipCatch(): void {
    this.finishCatch();
  }

  private finishCatch(): void {
    this.daze.set(null);
    this.rewards.set(generateOdysseyRewards(this.wave(), this.seed));
    this.phase.set('reward');
  }

  /* -------------------------------------------------------------- rewards */

  async chooseReward(r: OdysseyReward): Promise<void> {
    switch (r.kind) {
      case 'heal':
        this.hpFraction = this.hpFraction.map((f) => Math.min(1, f + Number(r.payload)));
        this.version.update((v) => v + 1);
        break;
      case 'balls':
        this.balls.update((b) => b + Number(r.payload));
        break;
      case 'candy': {
        // The lowest-level member snacks first.
        const idx = this.party.reduce((lo, m, i) => (m.level < this.party[lo].level ? i : lo), 0);
        this.busy.set(true);
        try {
          await this.rebuildMember(idx, Math.min(100, this.party[idx].level + Number(r.payload)));
        } finally {
          this.busy.set(false);
        }
        break;
      }
      case 'item': {
        this.equipItem(r.payload as ItemId);
        break;
      }
      case 'coins':
        this.addCoins(Number(r.payload));
        break;
    }
    this.rewards.set([]);
    // A wandering trader camps beyond every fallen guardian.
    if (this.spec()?.kind === 'boss') {
      this.shop.set(generateOdysseyShop(this.wave(), this.seed));
      this.phase.set('shop');
      return;
    }
    await this.nextWave();
  }

  /* ----------------------------------------------------------------- shop */

  buy(entry: OdysseyShopEntry): void {
    if (this.coins() < entry.cost) return;
    this.coins.update((c) => c - entry.cost);
    switch (entry.kind) {
      case 'balls':
        this.balls.update((b) => b + Number(entry.payload));
        break;
      case 'heal':
        this.hpFraction = this.hpFraction.map((f) => Math.min(1, f + Number(entry.payload)));
        this.version.update((v) => v + 1);
        break;
      case 'relic':
        this.addRelic(entry.payload as RelicId);
        break;
      case 'item':
        this.equipItem(entry.payload as ItemId);
        break;
    }
    this.shop.update((s) => s.filter((e) => e !== entry));
  }

  async leaveShop(): Promise<void> {
    this.shop.set([]);
    await this.nextWave();
  }

  private addRelic(id: RelicId): void {
    if (this.relics().includes(id)) {
      this.addCoins(40);
      this.toast.set('Duplicate relic — the trader refunds 40 coins.');
      return;
    }
    this.relics.update((r) => [...r, id]);
    this.toast.set(`Relic gained: ${relicById(id)?.name}`);
  }

  private equipItem(item: ItemId): void {
    const idx = this.party.findIndex((m) => !m.item);
    const target = idx >= 0 ? idx : 0;
    this.party = this.party.map((m, i) => (i === target ? { ...m, item } : m));
    this.version.update((v) => v + 1);
  }

  private addCoins(n: number): void {
    if (n <= 0) return;
    this.coins.update((c) => c + Math.round(n * coinMultiplier(this.relics())));
  }

  /* --------------------------------------------------------------- growth */

  /** Raise every member by `gain` levels, evolving those that qualify. */
  private async levelUpTeam(gain: number): Promise<void> {
    for (let i = 0; i < this.party.length; i++) {
      await this.rebuildMember(i, Math.min(100, this.party[i].level + gain));
    }
  }

  private async rebuildMember(index: number, level: number): Promise<void> {
    const mon = this.party[index];
    let species = mon.name;
    try {
      const evo = await this.evolutionFor(mon.name, level);
      if (evo) {
        species = evo.to;
        this.toast.set(`✨ ${mon.name} evolved into ${evo.to}!`);
      }
    } catch {
      /* stay unevolved */
    }
    try {
      const rebuilt = await this.battle.buildBattler(species, level);
      this.party = this.party.map((m, i) => (i === index ? (mon.item ? { ...rebuilt, item: mon.item } : rebuilt) : m));
      this.version.update((v) => v + 1);
    } catch {
      /* keep the old build on network hiccups */
    }
  }

  private async evolutionFor(species: string, level: number): Promise<{ to: string; toId: number } | null> {
    const sp = await this.api.species(species);
    const chain = await this.api.evolutionChain(idFromUrl(sp.evolution_chain.url));
    return evolutionAt(levelUpEvolutions(chain), species, level);
  }

  /* ------------------------------------------------------------------ end */

  private endRun(): void {
    this.meta.set(recordOdysseyRun(this.meta(), this.wave()));
    this.phase.set('lost');
  }

  abandon(): void {
    if (this.phase() === 'hub' || this.phase() === 'starter') {
      this.phase.set('hub');
      return;
    }
    this.endRun();
  }

  backToHub(): void {
    this.phase.set('hub');
    this.spec.set(null);
    this.setup.set(null);
  }
}
