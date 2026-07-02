import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { RpgService, type EvoEntry } from '../rpg.service';
import { BattleService } from '../../battle/battle.service';
import { PokeApiClient } from '../../../core/api/pokeapi.client';
import { CryService } from '../../../core/audio/cry.service';
import {
  TeamBattle,
  abilityName,
  type Battler,
  type BattleMove,
  type SideIndex,
  type TeamAction,
} from '../../../game/engine';
import { TypeBadgeComponent } from '../../../core/ui/type-badge/type-badge';
import { StatusBadgeComponent } from '../../../core/ui/status-badge/status-badge';
import { MoveButtonComponent } from '../../../core/ui/move-button/move-button';
import { BattleFxComponent } from '../../battle/pixi/battle-fx';
import { BattlePresenterBase, sleep, type PresenterTimes } from '../../battle/battle-presenter';
import { animatedSprite } from '../../../core/api/pokeapi-endpoints';
import { titleCase } from '../../../core/ui/format';
import { SeededRng } from '../../../core/utils/rng';
import { applyXp, shareXp, xpYield } from '../../../game/rpg/xp';
import { firstAlive, makePartyMon } from '../../../game/rpg/party';
import { attemptCatch, type RpgBallId } from '../../../game/rpg/catch';
import { ITEMS, isBall } from '../../../game/rpg/items-catalog';
import type { ItemId, PartyMon } from '../../../game/rpg/rpg-types';

interface MoveSlot { readonly move: BattleMove; readonly pp: number; readonly maxPp: number | null; }
interface BagSlot { readonly id: ItemId; readonly name: string; readonly count: number; readonly ball: boolean; }
type Menu = 'main' | 'fight' | 'pokemon' | 'bag' | 'done';

const REDUCED =
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Classic RPG wild battle on the party-aware {@link TeamBattle} engine. Adds the
 * retro command menu (Fight / Pokémon / Run), distributes XP & level-ups, writes
 * HP back to the persisted party, and handles whiteouts. Catch/Bag arrive in P3.
 */
@Component({
  selector: 'pv-rpg-battle',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TypeBadgeComponent, StatusBadgeComponent, MoveButtonComponent, BattleFxComponent],
  templateUrl: './rpg-battle.html',
  styleUrl: './rpg-battle.scss',
})
export class RpgBattleComponent extends BattlePresenterBase {
  protected readonly svc = inject(RpgService);
  private readonly battleSvc = inject(BattleService);
  private readonly api = inject(PokeApiClient);
  private readonly cry = inject(CryService);
  protected readonly titleCase = titleCase;
  protected readonly abilityName = abilityName;

  protected readonly loading = signal(true);
  protected readonly menu = signal<Menu>('main');
  protected readonly done = signal(false);
  protected readonly forcedSwitch = signal(false);

  protected readonly foeLevel = signal(1);
  protected readonly resultLines = signal<string[]>([]);
  protected readonly playerWon = signal(false);

  /** Classic RPG pacing — a touch snappier than the arena match. */
  protected override readonly times: PresenterTimes = {
    switch: 420, move: 460, miss: 360, damage: 440, heal: 300, note: 280, stage: 280, faint: 640, end: 0,
  };

  private readonly version = signal(0);
  private tb: TeamBattle | null = null;
  private foeCatchRate = 120;
  private xpReward = 0;
  private trainerReward = 0;
  private trainerFlag: string | undefined;
  private trainerDefeat = '';
  private trainerBadge: string | undefined;
  private trainerEnding: string | undefined;
  private started = false;
  private pendingEvos: EvoEntry[] = [];
  /** Wild battles allow catching/running; trainer battles won't. */
  protected readonly isWild = signal(true);
  protected readonly trainerName = signal<string | null>(null);
  /** Picking a fainted member to revive (Bag → Revive → Pokémon list). */
  protected readonly reviveMode = signal(false);
  private pendingRevive: ItemId | null = null;
  /** Party indices that actually saw the field (earn full XP; bench needs EXP Share). */
  private readonly participants = new Set<number>();

  protected readonly fx = viewChild(BattleFxComponent);
  protected readonly foeAnim = computed(() => { const f = this.foeActive(); return f ? animatedSprite(f.id) : ''; });
  protected readonly playerAnim = computed(() => { const m = this.playerActive(); return m ? animatedSprite(m.id) : ''; });

  protected readonly playerAbility = computed(() => abilityName(this.playerActive()?.ability));

  protected readonly moveSlots = computed<MoveSlot[]>(() => {
    this.version();
    const side = this.tb?.active(0);
    if (!side) return [];
    return side.battler.moves.map((move, i) => ({
      move,
      pp: Number.isFinite(side.pp[i]) ? side.pp[i] : Infinity,
      maxPp: move.pp ?? null,
    }));
  });
  protected readonly bagSlots = computed<BagSlot[]>(() => {
    const bag = this.svc.bag();
    return (Object.keys(bag) as ItemId[])
      .filter((id) => (bag[id] ?? 0) > 0 && ITEMS[id]?.usableInBattle)
      .map((id) => ({ id, name: ITEMS[id].name, count: bag[id] ?? 0, ball: isBall(id) }));
  });

  protected readonly switchList = computed(() => {
    this.version();
    const tb = this.tb;
    if (!tb) return [];
    return tb.state.parties[0].map((s, i) => ({
      name: titleCase(s.battler.name),
      hp: s.currentHp,
      maxHp: s.maxHp,
      active: i === tb.state.active[0],
      fainted: s.currentHp <= 0,
      index: i,
    }));
  });

  constructor() {
    super();
    effect(() => {
      const setup = this.svc.battleSetup();
      if (this.started || !setup) return;
      this.started = true;
      void this.begin();
    });
  }

  /* --------------------------------------------------- presenter hooks */

  /** Track participants for XP and play the incomer's cry. */
  protected override onSwitched(side: SideIndex): void {
    if (side === 0) this.participants.add(this.tb!.state.active[0]);
    this.cry.play(this.tb!.active(side).battler.id, 0.3);
  }

  protected override onFainted(side: SideIndex): void {
    this.cry.play(this.tb!.active(side).battler.id, 0.25);
  }

  /** A brief hit-stop right on impact keeps hits feeling weighty. */
  protected override async onImpact(): Promise<void> {
    if (!REDUCED) await sleep(70);
  }

  protected syncSide(side: SideIndex): void {
    const s = this.tb?.active(side);
    if (!s) return;
    if (side === 0) {
      this.playerActive.set(s.battler);
      this.pMax.set(s.maxHp);
      this.pHp.set(s.currentHp);
      this.pStatus.set(s.status);
    } else {
      this.foeActive.set(s.battler);
      this.fMax.set(s.maxHp);
      this.fHp.set(s.currentHp);
      this.fStatus.set(s.status);
    }
    this.version.update((v) => v + 1);
  }

  @HostListener('document:keydown', ['$event'])
  protected onKey(e: KeyboardEvent): void {
    if (this.done() || this.busy() || this.loading()) return;
    if (this.menu() === 'fight') {
      const n = Number(e.key);
      const slots = this.moveSlots();
      if (n >= 1 && n <= slots.length && slots[n - 1].pp > 0) {
        e.preventDefault();
        void this.useMove(n - 1);
      } else if (e.key === 'Escape' || e.key === 'x') {
        this.menu.set('main');
      }
    }
  }

  /* ------------------------------------------------------------- setup */

  private async begin(): Promise<void> {
    const setup = this.svc.battleSetup();
    const party = this.svc.party();
    if (!setup || !party.length) {
      this.svc.endBattle();
      return;
    }
    try {
      const isTrainer = setup.kind === 'trainer';
      this.isWild.set(!isTrainer);

      let foeTeam: Battler[];
      if (isTrainer && setup.team?.length) {
        foeTeam = await Promise.all(setup.team.map((t) => this.battleSvc.buildBattler(t.species, t.level, { levelMoves: true })));
        this.trainerName.set(setup.trainerName ?? 'Trainer');
        this.trainerReward = setup.reward ?? 0;
        this.trainerFlag = setup.winFlag;
        this.trainerDefeat = setup.defeatText ?? '';
        this.trainerBadge = setup.badge;
        this.trainerEnding = setup.ending;
        this.xpReward = setup.team.reduce((s, t) => s + xpYield(64, t.level), 0);
        this.foeLevel.set(setup.team[0].level);
      } else {
        const dto = await this.api.pokemon(setup.foeSpecies);
        this.foeCatchRate = setup.foeCatchRate;
        const foe = await this.battleSvc.buildBattlerFromDto(dto, setup.foeLevel, { levelMoves: true });
        foeTeam = [foe];
        this.xpReward = xpYield(dto.base_experience ?? 64, setup.foeLevel);
        this.foeLevel.set(setup.foeLevel);
      }
      foeTeam.forEach((f) => this.svc.markSeen(f.id));

      const playerBattlers = await Promise.all(party.map(async (m) => {
        const b = await this.battleSvc.buildBattler(m.species, m.level, { levelMoves: true });
        return m.heldItem ? { ...b, item: m.heldItem } : b;
      }));
      const startHpA = party.map((m) => m.currentHp);

      this.tb = new TeamBattle(playerBattlers, foeTeam, `rpg-${Date.now()}`, {
        aiTier: isTrainer ? 'strong' : 'basic',
        startHpA,
        startStatusA: party.map((m) => m.status),
      });
      // Lead with the first non-fainted party member.
      const lead = firstAlive(party);
      if (lead > 0) this.tb.forceSwitch(0, lead);
      this.participants.clear();
      this.participants.add(this.tb.state.active[0]);

      this.loading.set(false);
      this.syncAll();
      this.pulseEnter(0);
      this.pulseEnter(1);
      this.cry.play(this.tb.active(1).battler.id, 0.4);
      if (isTrainer) this.append(`${this.trainerName()} wants to battle!`, 'switch');
      else this.append(`A wild ${titleCase(this.tb.active(1).battler.name)} appeared!`);
      this.append(`Go, ${titleCase(this.tb.active(0).battler.name)}!`);
    } catch {
      this.svc.showToast('The wild Pokémon fled before the battle began.');
      this.svc.endBattle();
    }
  }

  /* ------------------------------------------------------------- actions */

  protected openFight(): void { this.menu.set('fight'); }
  protected openPokemon(): void { this.menu.set('pokemon'); }
  protected openBag(): void { this.menu.set('bag'); }
  protected backToMain(): void {
    if (this.reviveMode()) {
      this.reviveMode.set(false);
      this.pendingRevive = null;
    }
    if (!this.forcedSwitch()) this.menu.set('main');
  }

  /** Use a bag item in battle: a ball attempts a catch, others heal/cure the active. */
  protected async useBagItem(id: ItemId): Promise<void> {
    if (this.busy() || this.done()) return;
    if (isBall(id)) {
      await this.throwBall(id as RpgBallId);
      return;
    }
    const tb = this.tb;
    const def = ITEMS[id];
    if (!tb) return;
    const me = tb.active(0);
    if (def.revive) {
      if (!tb.state.parties[0].some((s) => s.currentHp <= 0)) {
        this.svc.showToast('No fainted Pokémon to revive.');
        return;
      }
      this.pendingRevive = id;
      this.reviveMode.set(true);
      this.menu.set('pokemon');
      return;
    }
    if (def.heal !== undefined) {
      if (me.currentHp >= me.maxHp) { this.svc.showToast('HP is already full.'); return; }
      me.currentHp = Math.min(me.maxHp, me.currentHp + (def.heal === Infinity ? me.maxHp : def.heal));
    } else if (def.cure) {
      if (me.status === 'none' || (def.cure !== 'all' && me.status !== def.cure)) {
        this.svc.showToast('It would have no effect.');
        return;
      }
      me.status = 'none';
    } else {
      this.svc.showToast('You cannot use that now.');
      return;
    }
    this.svc.consumeItem(id);
    this.menu.set('main');
    this.busy.set(true);
    this.append(`You used a ${def.name}.`);
    this.syncAll();
    await sleep(420);
    await this.passTurn();
  }

  private async throwBall(ball: RpgBallId): Promise<void> {
    const tb = this.tb;
    if (!tb) return;
    if (!this.isWild()) {
      this.svc.showToast("You can't catch another Trainer's Pokémon!");
      return;
    }
    if (!this.svc.consumeItem(ball)) return;
    this.menu.set('main');
    this.busy.set(true);
    const foe = tb.active(1);
    this.append(`You threw a ${ITEMS[ball].name}!`);
    const hpPct = foe.currentHp / foe.maxHp;
    const caught = attemptCatch(this.foeCatchRate, hpPct, foe.status, ball, new SeededRng(`catch-${Date.now()}-${Math.random()}`));
    for (let i = 0; i < 3; i++) {
      this.append('…');
      await sleep(430);
    }
    if (caught) {
      this.append(`Gotcha! ${titleCase(foe.battler.name)} was caught!`, 'win');
      await sleep(500);
      await this.finalizeCaught();
    } else {
      this.append(`Oh no! ${titleCase(foe.battler.name)} broke free!`);
      await sleep(300);
      await this.passTurn();
    }
  }

  private async passTurn(): Promise<void> {
    const tb = this.tb;
    if (!tb) return;
    await this.playEvents(tb.takeTurn({ type: 'pass' }, tb.chooseAction(1)));
    this.syncAll();
    await this.afterResolve();
  }

  protected async useMove(index: number): Promise<void> {
    if (this.busy() || this.done()) return;
    this.menu.set('main');
    await this.resolveTurn({ type: 'move', index });
  }

  protected async chooseSwitch(index: number): Promise<void> {
    const tb = this.tb;
    if (!tb || this.busy() || this.done()) return;
    if (this.reviveMode()) {
      await this.reviveTarget(index);
      return;
    }
    if (index === tb.state.active[0] || tb.state.parties[0][index].currentHp <= 0) return;
    if (this.forcedSwitch()) {
      this.forcedSwitch.set(false);
      this.busy.set(true);
      await this.playEvents(tb.forceSwitch(0, index));
      this.syncAll();
      this.busy.set(false);
      this.menu.set('main');
      return;
    }
    this.menu.set('main');
    await this.resolveTurn({ type: 'switch', to: index });
  }

  protected run(): void {
    if (this.busy() || this.done()) return;
    this.append('Got away safely!');
    void this.finalize(false, true);
  }

  /** Revive a fainted bench member mid-battle; costs the turn like other items. */
  private async reviveTarget(index: number): Promise<void> {
    const tb = this.tb;
    const def = this.pendingRevive ? ITEMS[this.pendingRevive] : null;
    const side = tb?.state.parties[0][index];
    if (!tb || !side || !def?.revive || side.currentHp > 0) return;
    if (!this.svc.consumeItem(this.pendingRevive!)) return;
    this.reviveMode.set(false);
    this.pendingRevive = null;
    this.menu.set('main');
    this.busy.set(true);
    side.currentHp = Math.max(1, Math.floor(side.maxHp * def.revive));
    side.status = 'none';
    side.toxicCounter = 0;
    this.append(`${titleCase(side.battler.name)} was revived!`, 'switch');
    this.syncAll();
    await sleep(420);
    await this.passTurn();
  }

  /* ------------------------------------------------------------- engine */

  private async resolveTurn(action: TeamAction): Promise<void> {
    const tb = this.tb;
    if (!tb) return;
    this.busy.set(true);
    await this.playEvents(tb.takeTurn(action, tb.chooseAction(1)));
    this.syncAll();
    await this.afterResolve();
  }

  /** Shared post-turn handling: end, foe forced-switch, or player forced-switch. */
  private async afterResolve(): Promise<void> {
    const tb = this.tb;
    if (!tb) return;
    if (tb.state.finished) {
      await this.finalize(tb.state.winner === 0, false);
      return;
    }
    if (tb.mustSwitch(1)) {
      await sleep(350);
      await this.playEvents(tb.autoForceSwitch(1));
      this.syncAll();
      if (tb.state.finished) {
        await this.finalize(tb.state.winner === 0, false);
        return;
      }
    }
    if (tb.mustSwitch(0)) {
      this.forcedSwitch.set(true);
      this.menu.set('pokemon');
      this.append('Choose your next Pokémon!');
      this.busy.set(false);
      return;
    }
    this.busy.set(false);
  }

  /* ------------------------------------------------------------- finish */

  private async finalize(won: boolean, ran: boolean): Promise<void> {
    const tb = this.tb;
    this.done.set(true);
    this.menu.set('done');
    this.busy.set(false);
    this.playerWon.set(won);

    const party = this.svc.party();
    if (!tb || !party.length) {
      this.svc.endBattle();
      return;
    }

    const finalHp = tb.hp(0);
    const finalStatus = tb.state.parties[0].map((s) => s.status);
    const hasShare = (this.svc.bag()['exp-share'] ?? 0) > 0;
    const lines: string[] = [];
    const updated: PartyMon[] = [];

    for (let i = 0; i < party.length; i++) {
      const mon = { ...party[i] };
      mon.currentHp = Math.max(0, Math.min(mon.maxHp, finalHp[i] ?? mon.currentHp));
      // Status sticks after battle (burn/poison/…); fainting clears it.
      mon.status = mon.currentHp <= 0 ? 'none' : finalStatus[i] ?? mon.status;

      // XP on a win: participants earn the full yield, the bench needs an EXP Share.
      const gain = won && mon.currentHp > 0 ? shareXp(this.xpReward, this.participants.has(i), hasShare) : 0;
      if (gain > 0) {
        const r = applyXp(mon.xp, mon.level, gain);
        lines.push(`${titleCase(mon.nickname ?? mon.species)} gained ${gain} XP!${this.participants.has(i) ? '' : ' (EXP Share)'}`);
        mon.xp = r.xp;
        if (r.leveledTo.length) {
          mon.level = r.level;
          lines.push(`${titleCase(mon.nickname ?? mon.species)} grew to Lv${r.level}!`);
          // Recompute max HP at the new level and carry the gain into current HP.
          try {
            const rebuilt = await this.battleSvc.buildBattler(mon.species, mon.level);
            const newMax = rebuilt.stats.hp;
            mon.currentHp = Math.min(newMax, mon.currentHp + Math.max(0, newMax - mon.maxHp));
            mon.maxHp = newMax;
          } catch {
            /* keep old maxHp on failure */
          }
        }
      }
      updated.push(mon);
    }

    this.svc.applyParty(updated);

    // Trainer payout + win flag (+ badge).
    if (won && !this.isWild()) {
      if (this.trainerDefeat) lines.unshift(`${this.trainerName()}: ${this.trainerDefeat}`);
      if (this.trainerReward) lines.push(`You got ${this.trainerReward} ₽ for winning!`);
      if (this.trainerBadge) lines.push(`🏅 You earned the ${this.trainerBadge}!`);
      if (this.trainerEnding) lines.push(this.trainerEnding);
      this.svc.finishTrainer(this.trainerReward, this.trainerFlag, this.trainerBadge);
    }
    this.resultLines.set(ran ? [] : lines);

    // Queue level-up evolutions for any member that gained a level.
    this.pendingEvos = [];
    if (won) {
      for (let i = 0; i < updated.length; i++) {
        if (updated[i].level > party[i].level) {
          const step = await this.svc.evolutionFor(updated[i].species, updated[i].level);
          if (step) this.pendingEvos.push({ uid: updated[i].uid, from: updated[i].species, fromId: party[i].dexId, to: step.to, toId: step.toId, level: updated[i].level });
        }
      }
    }

    if (!won && !ran && !updated.some((m) => m.currentHp > 0)) {
      // Whiteout: short beat, then heal + respawn.
      this.append('You are out of usable Pokémon…', 'faint');
      await sleep(900);
      this.svc.whiteout();
    }
  }

  /** Caught the wild Pokémon: write back party HP, add the catch, show the result. */
  private async finalizeCaught(): Promise<void> {
    const tb = this.tb;
    this.done.set(true);
    this.menu.set('done');
    this.busy.set(false);
    this.playerWon.set(true);
    if (!tb) return;
    const foe = tb.active(1);
    const party = this.svc.party();
    const finalHp = tb.hp(0);
    const sides = tb.state.parties[0];
    const updated = party.map((m, i) => {
      const hp = Math.max(0, Math.min(m.maxHp, finalHp[i] ?? m.currentHp));
      return { ...m, currentHp: hp, status: hp <= 0 ? ('none' as const) : sides[i]?.status ?? m.status };
    });
    this.svc.applyParty(updated);

    const mon = makePartyMon(foe.battler.name, foe.battler.id, this.foeLevel(), foe.maxHp);
    mon.currentHp = foe.currentHp;
    mon.status = foe.status;
    const where = this.svc.addCaught(mon);
    this.resultLines.set([
      `${titleCase(foe.battler.name)} was added to your ${where === 'party' ? 'team' : 'storage box'}!`,
    ]);
  }

  /** Leave the result overlay → play any evolutions, else return to the overworld. */
  protected close(): void {
    if (this.pendingEvos.length) this.svc.startEvolutions(this.pendingEvos);
    else this.svc.endBattle();
  }

  /* ------------------------------------------------------------- sync */

  private syncAll(): void {
    const tb = this.tb;
    if (!tb) return;
    const me = tb.active(0);
    const foe = tb.active(1);
    this.playerActive.set(me.battler);
    this.foeActive.set(foe.battler);
    this.pMax.set(me.maxHp);
    this.fMax.set(foe.maxHp);
    this.pHp.set(me.currentHp);
    this.fHp.set(foe.currentHp);
    this.pStatus.set(me.status);
    this.fStatus.set(foe.status);
    this.version.update((v) => v + 1);
  }
}
