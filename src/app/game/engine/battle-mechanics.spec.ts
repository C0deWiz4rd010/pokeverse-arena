import { describe, expect, it } from 'vitest';
import { Battle } from './battle';
import type { Battler, BattleEvent, BattleMove } from './battle-types';
import { computeMoveDamage } from './damage';
import { freshField } from './battle-types';
import { freshScreens, screenDamageFactor } from './field-effects';
import { itemById } from './items';
import { TeamBattle, type TeamAction } from './team-battle';
import { freshStages } from './stat-stages';
import { freshVolatiles, type BattleSide } from './battle-types';

const hit = (o: Partial<BattleMove> = {}): BattleMove => ({
  name: 'Hit',
  type: 'normal',
  power: 60,
  accuracy: 0,
  damageClass: 'physical',
  ...o,
});

const status = (name: string, o: Partial<BattleMove> = {}): BattleMove => ({
  name,
  type: 'normal',
  power: 0,
  accuracy: 0,
  damageClass: 'status',
  ...o,
});

function mon(o: Partial<Battler> = {}): Battler {
  return {
    id: 1,
    name: 'Mon',
    level: 50,
    types: ['normal'],
    stats: {
      hp: 400,
      attack: 100,
      defense: 100,
      'special-attack': 100,
      'special-defense': 100,
      speed: 100,
    },
    moves: [hit()],
    ...o,
  };
}

const text = (events: BattleEvent[]) =>
  events.map((e) => ('text' in e ? e.text : '')).filter((t) => t);
const has = (events: BattleEvent[], part: string) => text(events).some((t) => t.includes(part));
const damageTo = (events: BattleEvent[], side: 0 | 1) =>
  events
    .filter((e): e is Extract<BattleEvent, { kind: 'damage' }> => e.kind === 'damage')
    .filter((e) => e.side === side)
    .reduce((n, e) => n + e.amount, 0);

/** Fight one turn of a duel where both sides use the given move index. */
function duel(a: Battler, b: Battler, ai = 0, bi = 0, seed: string | number = 1) {
  const battle = new Battle(a, b, seed);
  return { battle, turn: (x = ai, y = bi) => battle.takeTurn(x, y) };
}

function side(o: Partial<BattleSide> & { battler: Battler }): BattleSide {
  return {
    currentHp: o.battler.stats.hp,
    maxHp: o.battler.stats.hp,
    pp: [],
    status: 'none',
    sleepTurns: 0,
    toxicCounter: 0,
    stages: freshStages(),
    volatiles: freshVolatiles(),
    itemUsed: false,
    ...o,
  };
}

describe('screens, Tailwind and Trick Room', () => {
  it('Reflect halves physical damage but not special, and crits bypass it', () => {
    const attacker = side({ battler: mon() });
    const defender = side({ battler: mon() });
    const screens = { ...freshScreens(), reflect: 5 };
    const base = { attacker, defender, field: freshField(), crit: false, roll: 1 };
    const phys = hit();
    const spec = hit({ damageClass: 'special' });
    const plain = computeMoveDamage({ ...base, move: phys }).damage;
    const screened = computeMoveDamage({ ...base, move: phys, defenderScreens: screens }).damage;
    expect(screened).toBeLessThan(plain * 0.6);
    expect(screened).toBeGreaterThan(plain * 0.4);
    expect(computeMoveDamage({ ...base, move: spec, defenderScreens: screens }).damage).toBe(
      computeMoveDamage({ ...base, move: spec }).damage,
    );
    expect(screenDamageFactor(screens, false, true)).toBe(1);
  });

  it('Reflect lasts five turns and the user is shielded', () => {
    const { battle, turn } = duel(
      mon({ moves: [status('Reflect', { setsScreen: 'reflect', target: 'self' })] }),
      mon({ moves: [hit()] }),
    );
    expect(has(turn(), 'Reflect raised on your side')).toBe(true);
    expect(battle.state.field.screens[0].reflect).toBe(4);
    for (let i = 0; i < 4; i++) turn(0, 0);
    expect(battle.state.field.screens[0].reflect).toBe(0);
  });

  it('Aurora Veil only works in snow', () => {
    const veil = status('Aurora Veil', { setsScreen: 'aurora-veil', target: 'self' });
    const snow = status('Snowscape', { setsWeather: 'snow', target: 'self' });
    const calm = duel(mon({ moves: [veil] }), mon());
    expect(has(calm.turn(), 'failed')).toBe(true);
    expect(calm.battle.state.field.screens[0]['aurora-veil']).toBe(0);

    const snowy = new Battle(mon({ moves: [snow, veil] }), mon(), 1);
    snowy.takeTurn(0, 0);
    snowy.takeTurn(1, 0);
    expect(snowy.state.field.screens[0]['aurora-veil']).toBeGreaterThan(0);
  });

  it('Tailwind lets a slower Pokémon move first', () => {
    const slow = mon({
      stats: { ...mon().stats, speed: 60 },
      moves: [status('Tailwind', { setsTailwind: true, target: 'self' }), hit()],
    });
    const fast = mon({ stats: { ...mon().stats, speed: 90 } });
    const { battle } = duel(slow, fast);
    battle.takeTurn(0, 0);
    const events = battle.takeTurn(1, 0);
    const order = events.filter((e) => e.kind === 'move').map((e) => e.side);
    expect(order).toEqual([0, 1]);
  });

  it('Trick Room reverses the order and a second use ends it', () => {
    const trick = status('Trick Room', { setsTrickRoom: true, target: 'self' });
    const slow = mon({ stats: { ...mon().stats, speed: 40 }, moves: [trick, hit()] });
    const fast = mon({ stats: { ...mon().stats, speed: 120 } });
    const { battle } = duel(slow, fast);
    battle.takeTurn(0, 0);
    expect(battle.state.field.trickRoom).toBeGreaterThan(0);
    const order = battle
      .takeTurn(1, 0)
      .filter((e) => e.kind === 'move')
      .map((e) => e.side);
    expect(order).toEqual([0, 1]); // slow first — it would have been last normally
    expect(has(battle.takeTurn(0, 0), 'returned to normal')).toBe(true);
    expect(battle.state.field.trickRoom).toBe(0);
  });
});

describe('Substitute, Taunt, Encore, Protect', () => {
  it('Substitute costs a quarter HP, soaks hits and then breaks', () => {
    const { battle, turn } = duel(
      mon({ moves: [status('Substitute', { substitute: true, target: 'self' })] }),
      mon({ moves: [hit({ power: 250 })] }),
    );
    const first = turn();
    expect(has(first, 'put in a substitute')).toBe(true);
    // The decoy took the hit: only the 25 % cost came off the HP bar.
    expect(damageTo(first, 0)).toBe(100);
    expect(battle.player.currentHp).toBe(300);
    expect(battle.player.volatiles.substitute).toBe(0); // the 250-power hit broke the 100 HP decoy
    expect(first.some((e) => e.kind === 'substitute' && !e.up)).toBe(true);
  });

  it('a Substitute shields from status moves but not from sound moves', () => {
    const thunderWave = status('Thunder Wave', {
      type: 'electric',
      inflictStatus: 'paralysis',
      target: 'opponent',
    });
    const sing = status('Sing', {
      inflictStatus: 'sleep',
      target: 'opponent',
      flags: { sound: true },
    });
    const sub = status('Substitute', { substitute: true, target: 'self' });
    const blocked = new Battle(mon({ moves: [sub] }), mon({ moves: [thunderWave] }), 1);
    blocked.takeTurn(0, 0);
    expect(blocked.player.status).toBe('none');

    const sound = new Battle(mon({ moves: [sub] }), mon({ moves: [sing] }), 1);
    sound.takeTurn(0, 0);
    expect(sound.player.status).toBe('sleep');
  });

  it('Taunt blocks status moves for three turns', () => {
    const taunt = status('Taunt', { taunt: true });
    const rest = status('Recover', { healing: 0.5, target: 'self' });
    const { battle, turn } = duel(mon({ moves: [rest, hit()] }), mon({ moves: [taunt, hit()] }));
    const first = turn(0, 0);
    expect(has(first, 'fell for the taunt')).toBe(true);
    expect(has(turn(0, 1), "can't use Recover")).toBe(true);
    turn(1, 1);
    expect(battle.player.volatiles.taunt).toBe(0);
    expect(has(turn(0, 1), "can't use")).toBe(false);
  });

  it('Encore forces the last move to repeat', () => {
    const encore = status('Encore', { encore: true });
    const boost = status('Swords Dance', { boosts: { attack: 1 }, target: 'self' });
    const { battle, turn } = duel(mon({ moves: [boost, hit()] }), mon({ moves: [encore] }));
    turn(0, 0); // player boosts (faster tie → either order is fine), foe encores
    turn(0, 0);
    const events = turn(1, 0); // asks for Hit but is encored into Swords Dance
    expect(events.some((e) => e.kind === 'move' && e.side === 0 && e.move === 'Swords Dance')).toBe(
      true,
    );
    expect(battle.player.volatiles.lastMove).toBe(0);
  });

  it('Protect blocks the foe and repeated use soon fails', () => {
    const protect = status('Protect', { protect: true, priority: 4, target: 'self' });
    const { battle, turn } = duel(mon({ moves: [protect] }), mon({ moves: [hit()] }));
    const first = turn();
    expect(damageTo(first, 0)).toBe(0);
    expect(has(first, 'protected itself')).toBe(true);
    expect(battle.player.currentHp).toBe(400);

    let failures = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const b = new Battle(mon({ moves: [protect] }), mon({ moves: [hit()] }), seed);
      b.takeTurn(0, 0);
      if (has(b.takeTurn(0, 0), 'failed')) failures++;
    }
    // The second Protect in a row works only one time in three.
    expect(failures).toBeGreaterThan(25);
    expect(failures).toBeLessThan(55);
  });
});

describe('damage moves with special rules', () => {
  it('Seismic Toss deals exactly the user level and ignores type immunity rules only for ghosts', () => {
    const toss = hit({ name: 'Seismic Toss', type: 'fighting', fixedDamage: 'level', power: 1 });
    const normal = duel(mon({ moves: [toss] }), mon());
    expect(damageTo(normal.turn(), 1)).toBe(50);
    const ghost = duel(mon({ moves: [toss] }), mon({ types: ['ghost'] }));
    expect(damageTo(ghost.turn(), 1)).toBe(0);
  });

  it('Super Fang halves the target current HP', () => {
    const fang = hit({ name: 'Super Fang', fractionDamage: 0.5, power: 1 });
    const { battle, turn } = duel(mon({ moves: [fang] }), mon());
    expect(damageTo(turn(), 1)).toBe(200);
    expect(battle.opponent.currentHp).toBe(200);
  });

  it('Knock Off removes the item without touching the original battler', () => {
    const knock = hit({ name: 'Knock Off', knockOff: true });
    const foe = mon({ item: 'leftovers' });
    const { battle, turn } = duel(mon({ moves: [knock] }), foe);
    expect(has(turn(), 'lost its Leftovers')).toBe(true);
    expect(battle.opponent.battler.item).toBeUndefined();
    expect(foe.item).toBe('leftovers');
  });

  it('Knock Off hits harder against an item holder', () => {
    const knock = hit({ name: 'Knock Off', knockOff: true });
    const withItem = duel(mon({ moves: [knock] }), mon({ item: 'sitrus-berry' }));
    const without = duel(mon({ moves: [knock] }), mon());
    expect(damageTo(withItem.turn(), 1)).toBeGreaterThan(damageTo(without.turn(), 1));
  });

  it('a recharge move costs the next turn', () => {
    const beam = hit({ name: 'Hyper Beam', power: 150, recharge: true });
    const { turn } = duel(mon({ moves: [beam] }), mon({ moves: [status('Wait', { boosts: {} })] }));
    turn();
    expect(has(turn(), 'must recharge')).toBe(true);
    expect(has(turn(), 'must recharge')).toBe(false);
  });

  it('a two-turn move charges first and strikes next turn — at once in sun', () => {
    const solar = hit({ name: 'Solar Beam', power: 120, charge: { skipWeather: 'sun' } });
    const idle = mon({ moves: [status('Wait', { boosts: {} })] });
    const slow = duel(mon({ moves: [solar] }), idle);
    const first = slow.turn();
    expect(has(first, 'charging up')).toBe(true);
    expect(damageTo(first, 1)).toBe(0);
    expect(damageTo(slow.turn(), 1)).toBeGreaterThan(0);

    const sunny = status('Sunny Day', { setsWeather: 'sun', target: 'self' });
    const battle = new Battle(mon({ moves: [sunny, solar] }), idle, 1);
    battle.takeTurn(0, 0);
    expect(damageTo(battle.takeTurn(1, 0), 1)).toBeGreaterThan(0);
  });

  it('uses Struggle (with recoil) when every move is out of PP', () => {
    const { battle, turn } = duel(
      mon({ moves: [hit({ name: 'Once', pp: 1 })] }),
      mon({ moves: [status('Wait', { boosts: {} })] }),
    );
    turn();
    expect(battle.player.pp[0]).toBe(0);
    const events = turn();
    expect(events.some((e) => e.kind === 'move' && e.move === 'Struggle')).toBe(true);
    expect(has(events, 'recoil')).toBe(true);
  });

  it('a Choice item locks the holder into the first move it used', () => {
    const { battle, turn } = duel(
      mon({ item: 'choice-band', moves: [hit({ name: 'First' }), hit({ name: 'Second' })] }),
      mon({ moves: [status('Wait', { boosts: {} })] }),
    );
    turn(0, 0);
    const events = turn(1, 0);
    expect(events.some((e) => e.kind === 'move' && e.side === 0 && e.move === 'First')).toBe(true);
    expect(battle.player.volatiles.lockedMove).toBe(0);
  });
});

describe('confusion', () => {
  const confuse = status('Confuse Ray', { inflictConfusion: true, target: 'opponent' });

  it('confuses for two to five turns, hurts itself sometimes and wears off', () => {
    let selfHits = 0;
    let snapped = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const b = new Battle(mon({ moves: [confuse] }), mon({ moves: [hit()] }), seed);
      b.takeTurn(0, 0);
      const turns = b.opponent.volatiles.confusionTurns;
      expect(turns).toBeGreaterThanOrEqual(1);
      expect(turns).toBeLessThanOrEqual(5);
      for (let t = 0; t < 6; t++) {
        const ev = b.takeTurn(0, 0);
        if (has(ev, 'hurt itself in its confusion')) selfHits++;
        if (has(ev, 'snapped out')) snapped++;
      }
    }
    expect(selfHits).toBeGreaterThan(0);
    expect(snapped).toBeGreaterThan(30);
  });

  it('cannot stack and a Substitute holder is immune', () => {
    const b = new Battle(mon({ moves: [confuse] }), mon(), 1);
    b.takeTurn(0, 0);
    expect(has(b.takeTurn(0, 0), 'became confused')).toBe(false);
    const sub = new Battle(
      mon({ moves: [confuse] }),
      mon({
        stats: { ...mon().stats, speed: 200 },
        moves: [status('Substitute', { substitute: true, target: 'self' })],
      }),
      1,
    );
    sub.takeTurn(0, 0);
    expect(sub.opponent.volatiles.confusionTurns).toBe(0);
  });
});

describe('new abilities', () => {
  it('Prankster lets a slower status move go first', () => {
    const wait = status('Wait', { boosts: {} });
    const slow = mon({
      ability: 'prankster',
      stats: { ...mon().stats, speed: 10 },
      moves: [wait],
    });
    const fast = mon({ stats: { ...mon().stats, speed: 200 } });
    const order = duel(slow, fast)
      .turn()
      .filter((e) => e.kind === 'move')
      .map((e) => e.side);
    expect(order).toEqual([0, 1]);
  });

  it('Moxie raises Attack after a KO', () => {
    const killer = mon({ ability: 'moxie', moves: [hit({ power: 250 })] });
    const prey = mon({ stats: { ...mon().stats, hp: 20 } });
    const events = duel(killer, prey).turn();
    expect(
      events.some((e) => e.kind === 'stage-change' && e.side === 0 && e.stat === 'attack'),
    ).toBe(true);
  });

  it('Clear Body shrugs off Intimidate', () => {
    const b = new Battle(mon({ ability: 'intimidate' }), mon({ ability: 'clear-body' }), 1);
    const events = b.takeTurn(0, 0);
    expect(has(events, 'Clear Body prevents stat loss')).toBe(true);
    expect(b.opponent.stages.attack).toBe(0);
  });

  it('Download boosts the stat the foe defends worse', () => {
    const weakSpDef = mon({ stats: { ...mon().stats, defense: 150, 'special-defense': 50 } });
    const b = new Battle(mon({ ability: 'download' }), weakSpDef, 1);
    b.takeTurn(0, 0);
    expect(b.player.stages['special-attack']).toBe(1);
  });

  it('Mold Breaker ignores Levitate', () => {
    const quake = hit({ name: 'Earthquake', type: 'ground' });
    const normal = duel(mon({ moves: [quake] }), mon({ ability: 'levitate' }));
    expect(damageTo(normal.turn(), 1)).toBe(0);
    const breaker = duel(
      mon({ ability: 'mold-breaker', moves: [quake] }),
      mon({ ability: 'levitate' }),
    );
    expect(damageTo(breaker.turn(), 1)).toBeGreaterThan(0);
  });

  it('Sheer Force gives up the secondary effect for more power', () => {
    const burn = hit({ name: 'Flamer', type: 'fire', secondary: { chance: 100, status: 'burn' } });
    const firstHit = (events: BattleEvent[]) =>
      events.find((e) => e.kind === 'damage' && e.side === 1);
    const forced = duel(mon({ ability: 'sheer-force', moves: [burn] }), mon());
    const forcedHit = firstHit(forced.turn());
    expect(forced.battle.opponent.status).toBe('none');
    const plain = duel(mon({ moves: [burn] }), mon());
    const plainHit = firstHit(plain.turn());
    expect(plain.battle.opponent.status).toBe('burn');
    expect((forcedHit as { amount: number }).amount).toBeGreaterThan(
      (plainHit as { amount: number }).amount,
    );
  });

  it('Tough Claws boosts contact moves only', () => {
    const base = { field: freshField(), crit: false, roll: 1, defender: side({ battler: mon() }) };
    const claws = side({ battler: mon({ ability: 'tough-claws' }) });
    const plain = side({ battler: mon() });
    const contact = hit({ flags: { contact: true } });
    expect(computeMoveDamage({ ...base, attacker: claws, move: contact }).damage).toBeGreaterThan(
      computeMoveDamage({ ...base, attacker: plain, move: contact }).damage,
    );
    expect(computeMoveDamage({ ...base, attacker: claws, move: hit() }).damage).toBe(
      computeMoveDamage({ ...base, attacker: plain, move: hit() }).damage,
    );
  });
});

describe('new items', () => {
  it('Weakness Policy sharply raises Attack and Sp. Atk once when hit super effectively', () => {
    const fighting = hit({ type: 'fighting', power: 40 });
    const b = new Battle(mon({ moves: [fighting] }), mon({ item: 'weakness-policy' }), 1);
    const events = b.takeTurn(0, 0);
    expect(has(events, 'Weakness Policy was triggered')).toBe(true);
    expect(b.opponent.stages.attack).toBe(2);
    expect(b.opponent.stages['special-attack']).toBe(2);
    expect(b.opponent.itemUsed).toBe(true);
  });

  it('Air Balloon dodges Ground moves until it pops', () => {
    const quake = hit({ name: 'Earthquake', type: 'ground' });
    const b = new Battle(mon({ moves: [quake, hit()] }), mon({ item: 'air-balloon' }), 1);
    expect(has(b.takeTurn(0, 0), 'floats away')).toBe(true);
    expect(b.opponent.currentHp).toBe(400);
    expect(has(b.takeTurn(1, 0), 'Air Balloon popped')).toBe(true);
    expect(damageTo(b.takeTurn(0, 0), 1)).toBeGreaterThan(0);
  });

  it('type-boosting items add 20 % to matching moves', () => {
    expect(itemById('charcoal')?.typeBoost).toEqual({ type: 'fire', factor: 1.2 });
    const fire = hit({ type: 'fire' });
    const base = { field: freshField(), crit: false, roll: 1, defender: side({ battler: mon() }) };
    const boosted = computeMoveDamage({
      ...base,
      attacker: side({ battler: mon({ item: 'charcoal' }) }),
      move: fire,
    }).damage;
    const plain = computeMoveDamage({
      ...base,
      attacker: side({ battler: mon() }),
      move: fire,
    }).damage;
    expect(boosted).toBeGreaterThan(plain);
  });
});

describe('party battles', () => {
  const mv = (index: number, tera = false): TeamAction => ({ type: 'move', index, tera });
  const rock = status('Stealth Rock', { setsHazard: 'stealth-rock' });

  it('Heavy-Duty Boots and Magic Guard skip hazard damage', () => {
    const lead = mon({ moves: [rock] });
    for (const bench of [mon({ item: 'heavy-duty-boots' }), mon({ ability: 'magic-guard' })]) {
      const tb = new TeamBattle([mon({ moves: [rock] })], [mon({ moves: [hit()] }), bench], 1);
      tb.takeTurn(mv(0), mv(0));
      const events = tb.forceSwitch(1, 1);
      expect(events.some((e) => e.kind === 'damage')).toBe(false);
    }
    const plain = new TeamBattle([lead], [mon({ moves: [hit()] }), mon()], 1);
    plain.takeTurn(mv(0), mv(0));
    expect(plain.forceSwitch(1, 1).some((e) => e.kind === 'damage')).toBe(true);
  });

  it('Terastallizing changes the defensive type, once per team, and boosts STAB', () => {
    const a = mon({ types: ['normal'], teraType: 'ghost', moves: [hit({ type: 'ghost' })] });
    const tb = new TeamBattle([a, mon()], [mon({ moves: [hit({ type: 'fighting' })] })], 1);
    const events = tb.takeTurn(mv(0, true), mv(0));
    expect(events.some((e) => e.kind === 'tera' && e.side === 0 && e.type === 'ghost')).toBe(true);
    expect(tb.active(0).terastallized).toBe('ghost');
    // Fighting does nothing to a Ghost: the Tera type replaced the Normal typing.
    expect(damageTo(events, 0)).toBe(0);
    expect(tb.canTerastallize(0)).toBe(false);
    expect(tb.takeTurn(mv(0, true), mv(0)).filter((e) => e.kind === 'tera')).toHaveLength(0);
  });

  it('a pivot move owes a switch that resets the user', () => {
    const uturn = hit({ name: 'U-turn', pivot: true, type: 'bug' });
    const tb = new TeamBattle(
      [mon({ moves: [uturn] }), mon({ name: 'Backup' })],
      [mon({ moves: [status('Wait', { boosts: {} })] })],
      1,
    );
    tb.takeTurn(mv(0), mv(0));
    expect(tb.mustSwitch(0)).toBe(true);
    expect(tb.mustSwitch(1)).toBe(false);
    const events = tb.forceSwitch(0, 1);
    expect(events.some((e) => e.kind === 'switch' && e.name === 'Backup')).toBe(true);
    expect(tb.mustSwitch(0)).toBe(false);
  });

  it('Leech Seed drains in party battles too', () => {
    const seed = status('Leech Seed', { leechSeed: true, type: 'grass' });
    const tb = new TeamBattle([mon({ moves: [seed] })], [mon({ moves: [hit()] })], 1);
    const events = tb.takeTurn(mv(0), mv(0));
    expect(has(events, 'sapped by Leech Seed')).toBe(true);
    const grass = new TeamBattle(
      [mon({ moves: [seed] })],
      [mon({ types: ['grass'], moves: [hit()] })],
      1,
    );
    expect(has(grass.takeTurn(mv(0), mv(0)), 'sapped')).toBe(false);
  });

  it('Magic Guard now blocks recoil and Rough Skin in party battles', () => {
    const recoil = hit({ recoil: 0.5, power: 100 });
    const tb = new TeamBattle(
      [mon({ ability: 'magic-guard', moves: [recoil] })],
      [mon({ moves: [status('Wait', { boosts: {} })] })],
      1,
    );
    tb.takeTurn(mv(0), mv(0));
    expect(tb.active(0).currentHp).toBe(400);
  });
});
