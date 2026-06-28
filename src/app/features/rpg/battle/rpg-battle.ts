import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { RpgService } from '../rpg.service';
import { BattleService } from '../../battle/battle.service';
import { PokeApiClient } from '../../../core/api/pokeapi.client';
import {
  TeamBattle,
  abilityName,
  type Battler,
  type BattleEvent,
  type BattleMove,
  type SideIndex,
  type StatusCondition,
  type TeamAction,
} from '../../../game/engine';
import { TypeBadgeComponent } from '../../../core/ui/type-badge/type-badge';
import { StatusBadgeComponent } from '../../../core/ui/status-badge/status-badge';
import { MoveButtonComponent } from '../../../core/ui/move-button/move-button';
import { titleCase } from '../../../core/ui/format';
import { SeededRng } from '../../../core/utils/rng';
import { applyXp, xpYield } from '../../../game/rpg/xp';
import { firstAlive, makePartyMon } from '../../../game/rpg/party';
import { attemptCatch, type RpgBallId } from '../../../game/rpg/catch';
import { ITEMS, isBall } from '../../../game/rpg/items-catalog';
import type { ItemId, PartyMon } from '../../../game/rpg/rpg-types';

type LogTone = 'crit' | 'super' | 'resist' | 'faint' | 'win' | 'switch';
interface LogLine { readonly text: string; readonly tone?: LogTone; }
interface MoveSlot { readonly move: BattleMove; readonly pp: number; readonly maxPp: number | null; }
interface BagSlot { readonly id: ItemId; readonly name: string; readonly count: number; readonly ball: boolean; }
type Menu = 'main' | 'fight' | 'pokemon' | 'bag' | 'done';

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Classic RPG wild battle on the party-aware {@link TeamBattle} engine. Adds the
 * retro command menu (Fight / Pokémon / Run), distributes XP & level-ups, writes
 * HP back to the persisted party, and handles whiteouts. Catch/Bag arrive in P3.
 */
@Component({
  selector: 'pv-rpg-battle',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TypeBadgeComponent, StatusBadgeComponent, MoveButtonComponent],
  templateUrl: './rpg-battle.html',
  styleUrl: './rpg-battle.scss',
})
export class RpgBattleComponent {
  protected readonly svc = inject(RpgService);
  private readonly battleSvc = inject(BattleService);
  private readonly api = inject(PokeApiClient);
  protected readonly titleCase = titleCase;
  protected readonly abilityName = abilityName;

  protected readonly loading = signal(true);
  protected readonly menu = signal<Menu>('main');
  protected readonly busy = signal(false);
  protected readonly done = signal(false);
  protected readonly forcedSwitch = signal(false);

  protected readonly playerActive = signal<Battler | null>(null);
  protected readonly foeActive = signal<Battler | null>(null);
  protected readonly pHp = signal(0);
  protected readonly pMax = signal(1);
  protected readonly fHp = signal(0);
  protected readonly fMax = signal(1);
  protected readonly pStatus = signal<StatusCondition>('none');
  protected readonly fStatus = signal<StatusCondition>('none');
  protected readonly foeLevel = signal(1);
  protected readonly log = signal<LogLine[]>([]);
  protected readonly shakeSide = signal<SideIndex | null>(null);
  protected readonly flashSide = signal<SideIndex | null>(null);
  protected readonly resultLines = signal<string[]>([]);
  protected readonly playerWon = signal(false);

  private readonly version = signal(0);
  private tb: TeamBattle | null = null;
  private foeBaseExp = 64;
  private foeCatchRate = 120;
  private started = false;
  /** Wild battles allow catching/running; trainer battles (P5) won't. */
  protected readonly isWild = signal(true);

  protected readonly pHpPct = computed(() => (this.pHp() / this.pMax()) * 100);
  protected readonly fHpPct = computed(() => (this.fHp() / this.fMax()) * 100);
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
    effect(() => {
      const setup = this.svc.battleSetup();
      if (this.started || !setup) return;
      this.started = true;
      void this.begin();
    });
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
      const dto = await this.api.pokemon(setup.foeSpecies);
      this.foeBaseExp = dto.base_experience ?? 64;
      this.foeCatchRate = setup.foeCatchRate;
      const foe = await this.battleSvc.buildBattlerFromDto(dto, setup.foeLevel);
      this.svc.markSeen(foe.id);
      this.foeLevel.set(setup.foeLevel);

      const playerBattlers = await Promise.all(party.map((m) => this.battleSvc.buildBattler(m.species, m.level)));
      const startHpA = party.map((m) => m.currentHp);

      this.tb = new TeamBattle(playerBattlers, [foe], `rpg-${Date.now()}`, {
        aiTier: 'basic',
        startHpA,
      });
      // Lead with the first non-fainted party member.
      const lead = firstAlive(party);
      if (lead > 0) this.tb.forceSwitch(0, lead);

      this.loading.set(false);
      this.syncAll();
      this.append(`A wild ${titleCase(foe.name)} appeared!`);
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
  protected backToMain(): void { if (!this.forcedSwitch()) this.menu.set('main'); }

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
      this.svc.showToast('Save Revives for fainted Pokémon.');
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
    if (!tb || !this.isWild()) return;
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
    if (tb.state.finished) {
      await this.finalize(tb.state.winner === 0, false);
      return;
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

  protected async useMove(index: number): Promise<void> {
    if (this.busy() || this.done()) return;
    this.menu.set('main');
    await this.resolveTurn({ type: 'move', index });
  }

  protected async chooseSwitch(index: number): Promise<void> {
    const tb = this.tb;
    if (!tb || this.busy() || this.done()) return;
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

  /* ------------------------------------------------------------- engine */

  private async resolveTurn(action: TeamAction): Promise<void> {
    const tb = this.tb;
    if (!tb) return;
    this.busy.set(true);
    await this.playEvents(tb.takeTurn(action, tb.chooseAction(1)));
    this.syncAll();

    if (tb.state.finished) {
      await this.finalize(tb.state.winner === 0, false);
      return;
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

  private async playEvents(events: BattleEvent[]): Promise<void> {
    for (const ev of events) {
      switch (ev.kind) {
        case 'switch':
          this.syncSide(ev.side);
          this.append(ev.text, 'switch');
          await sleep(420);
          break;
        case 'move':
          this.append(`${titleCase(ev.attacker)} used ${titleCase(ev.move)}!`);
          await sleep(440);
          break;
        case 'miss':
          this.append(`${titleCase(ev.attacker)}'s attack missed!`);
          await sleep(360);
          break;
        case 'damage': {
          this.flashSide.set(ev.side);
          this.shakeSide.set(ev.side);
          if (ev.side === 0) this.pHp.set(ev.remainingHp);
          else this.fHp.set(ev.remainingHp);
          if (ev.crit) this.append('A critical hit!', 'crit');
          if (ev.effectiveness >= 2) this.append("It's super effective!", 'super');
          else if (ev.effectiveness > 0 && ev.effectiveness < 1) this.append("It's not very effective…", 'resist');
          await sleep(440);
          this.shakeSide.set(null);
          this.flashSide.set(null);
          break;
        }
        case 'heal':
          if (ev.side === 0) this.pHp.set(ev.remainingHp);
          else this.fHp.set(ev.remainingHp);
          if (ev.text) this.append(ev.text);
          await sleep(300);
          break;
        case 'faint':
          this.append(`${titleCase(ev.name)} fainted!`, 'faint');
          await sleep(560);
          break;
        case 'status-set':
        case 'cure':
        case 'weather':
        case 'terrain':
        case 'ability':
        case 'item':
        case 'stage-change':
        case 'status':
        case 'flinch':
          if (ev.text) this.append(ev.text);
          await sleep(280);
          break;
        default:
          break;
      }
    }
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
    const lines: string[] = [];
    const updated: PartyMon[] = [];

    for (let i = 0; i < party.length; i++) {
      const mon = { ...party[i] };
      mon.currentHp = Math.max(0, Math.min(mon.maxHp, finalHp[i] ?? mon.currentHp));
      if (mon.currentHp <= 0) mon.status = 'none';

      // XP to every participant that's still standing, on a win.
      if (won && mon.currentHp > 0) {
        const gain = xpYield(this.foeBaseExp, this.foeLevel());
        const r = applyXp(mon.xp, mon.level, gain);
        lines.push(`${titleCase(mon.nickname ?? mon.species)} gained ${gain} XP!`);
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
    this.resultLines.set(ran ? [] : lines);

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
    const updated = party.map((m, i) => ({
      ...m,
      currentHp: Math.max(0, Math.min(m.maxHp, finalHp[i] ?? m.currentHp)),
    }));
    this.svc.applyParty(updated);

    const mon = makePartyMon(foe.battler.name, foe.battler.id, this.foeLevel(), foe.maxHp);
    mon.currentHp = foe.currentHp;
    mon.status = foe.status;
    const where = this.svc.addCaught(mon);
    this.resultLines.set([
      `${titleCase(foe.battler.name)} was added to your ${where === 'party' ? 'team' : 'storage box'}!`,
    ]);
  }

  /** Leave the result overlay and return to the overworld. */
  protected close(): void {
    this.svc.endBattle();
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

  private syncSide(side: SideIndex): void {
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

  private append(text: string, tone?: LogTone): void {
    this.log.update((l) => [...l, { text, tone }]);
  }
}
