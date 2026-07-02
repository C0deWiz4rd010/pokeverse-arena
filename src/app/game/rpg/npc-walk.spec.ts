import { describe, expect, it } from 'vitest';
import type { MapDef, NpcDef } from './rpg-types';
import { parseTiles } from './maps/legend';
import { canEnterRuntime, initNpcPositions, npcAtRuntime, stepWanderers } from './npc-walk';

const npc = (o: Partial<NpcDef>): NpcDef => ({
  id: 'walker',
  x: 2,
  y: 2,
  facing: 'down',
  sprite: 'boy',
  kind: 'talk',
  script: [],
  wander: 1,
  ...o,
});

const mk = (npcs: NpcDef[], rows = ['GGGGG', 'GGGGG', 'GGGGG', 'GGGGG', 'GGGGG']): MapDef => ({
  id: 'test',
  name: 'Test',
  width: rows[0].length,
  height: rows.length,
  outdoor: true,
  tiles: parseTiles(rows),
  warps: [],
  signs: [],
  npcs,
  items: [],
});

/** rand() replaying a fixed sequence (repeats the last value). */
const seq = (...vals: number[]) => {
  let i = 0;
  return () => vals[Math.min(i++, vals.length - 1)];
};

describe('wandering NPCs', () => {
  it('seeds runtime positions from the static defs', () => {
    const map = mk([npc({})]);
    expect(initNpcPositions(map)).toEqual({ walker: { x: 2, y: 2, facing: 'down' } });
  });

  it('steps a wanderer one tile and updates facing', () => {
    const map = mk([npc({})]);
    // act roll 0 (< chance) then dir roll 0.3 → DIRS[1] = 'down'
    const next = stepWanderers(map, initNpcPositions(map), { x: 0, y: 0 }, seq(0, 0.3));
    expect(next['walker']).toEqual({ x: 2, y: 3, facing: 'down' });
  });

  it('never leaves the home radius — blocked steps become a turn', () => {
    const map = mk([npc({ wander: 1 })]);
    let pos = { walker: { x: 2, y: 3, facing: 'down' as const } }; // already at radius edge
    pos = stepWanderers(map, pos, { x: 0, y: 0 }, seq(0, 0.3)); // tries down → y 4 (out of range)
    expect(pos['walker']).toEqual({ x: 2, y: 3, facing: 'down' }); // turned, not moved
  });

  it('never steps onto the player, another NPC, or unwalkable tiles', () => {
    const rows = ['GGGGG', 'GGGGG', 'GGTGG', 'GGGGG', 'GGGGG']; // tree right below home
    const other = npc({ id: 'other', x: 3, y: 1, wander: 0 });
    const map = mk([npc({ x: 2, y: 1 }), other], rows);
    const start = initNpcPositions(map);
    // down (0.3) is a tree; right (0.8) is the other NPC; player sits left.
    const afterDown = stepWanderers(map, start, { x: 0, y: 0 }, seq(0, 0.3));
    expect(afterDown['walker'].y).toBe(1);
    const afterRight = stepWanderers(map, start, { x: 0, y: 0 }, seq(0, 0.8));
    expect(afterRight['walker'].x).toBe(2);
    const afterLeft = stepWanderers(map, start, { x: 1, y: 1 }, seq(0, 0.6));
    expect(afterLeft['walker'].x).toBe(2); // player blocked the tile
  });

  it('statics never move, and runtime lookups follow the wanderer', () => {
    const map = mk([npc({}), npc({ id: 'static', x: 4, y: 4, wander: undefined })]);
    const moved = stepWanderers(map, initNpcPositions(map), { x: 0, y: 0 }, seq(0, 0.3));
    expect(moved['static']).toEqual({ x: 4, y: 4, facing: 'down' });
    // The walker now occupies (2,3); its home tile is free again.
    expect(npcAtRuntime(map, moved, 2, 3)?.id).toBe('walker');
    expect(npcAtRuntime(map, moved, 2, 2)).toBeUndefined();
    expect(canEnterRuntime(map, moved, 2, 2)).toBe(true);
    expect(canEnterRuntime(map, moved, 2, 3)).toBe(false);
  });
});
