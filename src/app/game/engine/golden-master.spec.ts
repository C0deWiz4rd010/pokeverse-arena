import { describe, expect, it } from 'vitest';
import { SeededRng } from '../../core/utils/rng';
import { Battle } from './battle';
import type { BattleEvent } from './battle-types';
import { hash, makeMon } from './golden-fixtures';
import { TeamBattle } from './team-battle';

/**
 * Replay guard for the battle engines: a fixed set of seeded random matchups is fought to the
 * end and the whole event log is hashed. Refactors of the engine internals must keep every hash
 * identical; an intended mechanics change regenerates them (set `PRINT` to true once).
 */
const PRINT = false;

function duel(seed: number): string {
  const rng = new SeededRng(`gm-duel-${seed}`);
  const battle = new Battle(makeMon(rng, 1), makeMon(rng, 2), `gm-${seed}`, undefined, 'strong');
  const log: BattleEvent[] = [];
  for (let t = 0; t < 40 && !battle.state.finished; t++) {
    log.push(...battle.takeTurn(battle.autoPlayerMove()));
  }
  return hash(log);
}

function team(seed: number): string {
  const rng = new SeededRng(`gm-team-${seed}`);
  const a = [makeMon(rng, 1), makeMon(rng, 2), makeMon(rng, 3)];
  const b = [makeMon(rng, 4), makeMon(rng, 5), makeMon(rng, 6)];
  const tb = new TeamBattle(a, b, `gm-t-${seed}`, { aiTier: 'strong' });
  const log: BattleEvent[] = [];
  for (let t = 0; t < 60 && !tb.state.finished; t++) {
    for (const side of [0, 1] as const) {
      if (tb.mustSwitch(side)) log.push(...tb.autoForceSwitch(side));
    }
    log.push(...tb.takeTurn(tb.chooseAction(0), tb.chooseAction(1)));
  }
  return hash(log);
}

const EXPECTED = {
  duel: [
    '8c7f7110:17',
    'fc8584ed:14',
    '4830b018:24',
    'bddfbd2a:176',
    '1953b43b:14',
    'e479a12:86',
    '629b5ea3:26',
    '831b70ea:20',
    'e23ee3a6:16',
    '323e1dc9:22',
    '9b6e9bf7:35',
    'c9369985:137',
    '90d00e76:61',
    '7bbfc855:15',
    '90254d1a:32',
    '6c43ad2e:7',
    '8809599f:14',
    '7eee5526:46',
    '5cfbf931:33',
    '7d6b25f3:14',
    '47bf0735:21',
    'd133aec7:30',
    '71851341:14',
    'bb8a9b7c:76',
    '7d014c5e:224',
    'e5ace4aa:10',
    '30605a71:20',
    '24b4d9c9:13',
    '79d8c956:16',
    '6fa67a88:30',
    'cd9111d0:25',
    'bc023b4d:23',
    '661d2025:23',
    'bf77669b:7',
    'e890d2ee:15',
    '83714928:32',
    'f8fdcd94:23',
    '7e96788b:7',
    'c10090fa:34',
    'c722d599:14',
  ],
  team: [
    '6f0ef773:63',
    '844f8674:64',
    'bd3544d3:207',
    '766fe86c:49',
    '2a03df5f:60',
    'd1d62c46:273',
    '416b42ee:50',
    '72578ca3:51',
    'b7eed531:34',
    '2e15de96:56',
    'd48c3e96:120',
    '7397074:261',
    'c77470e5:63',
    'ad8675d:89',
    '1487b3db:61',
    '1a34e4ab:60',
    'bc2bd18:86',
    '14f83b3b:301',
    '9c9ba2d1:75',
    '7402395b:91',
    'b443f5ab:58',
    'd4b536e6:100',
    '8baf189f:265',
    'ccd9c438:129',
    '278f9fd9:290',
    '3ca866d4:43',
    'b0958c48:98',
    '5e6d555d:227',
    'b97a234c:104',
    'd7f10c69:270',
    'ef813eb:75',
    'a889d815:95',
    '451890a:93',
    '27000199:80',
    '2f558723:117',
    'afa13350:61',
    '611df283:40',
    '825bb70e:80',
    'f3b83015:39',
    '36c119c:104',
  ],
} as const;

const SEEDS = Array.from({ length: 40 }, (_, i) => i + 1);

describe('golden master', () => {
  it('prints hashes (only when PRINT is on)', () => {
    if (!PRINT) return;
    throw new Error('HASHES ' + JSON.stringify({ duel: SEEDS.map(duel), team: SEEDS.map(team) }));
  });

  it('replays every 1-v-1 duel identically', () => {
    expect(SEEDS.map(duel)).toEqual(EXPECTED.duel);
  });

  it('replays every 3-v-3 team battle identically', () => {
    expect(SEEDS.map(team)).toEqual(EXPECTED.team);
  });
});
