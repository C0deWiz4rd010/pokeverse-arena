import { describe, expect, it } from 'vitest';
import { currentVersion, migrateData, migrationsFor, type Migration } from './migrations';

const table: Record<string, readonly Migration[]> = {
  'rpg:save': [(d) => ({ ...(d as object), a: 1 }), (d) => ({ ...(d as object), b: 2 })],
};

describe('migrations', () => {
  it('derives the current version from the ladder length', () => {
    expect(currentVersion('rpg:save', table)).toBe(3);
    expect(currentVersion('other', table)).toBe(1);
  });

  it('applies the slot suffix fallback (rpg:save:2 → rpg:save)', () => {
    expect(migrationsFor('rpg:save:2', table).length).toBe(2);
  });

  it('runs only the steps newer than the stored version', () => {
    expect(migrateData('rpg:save', {}, 1, table)).toEqual({ a: 1, b: 2 });
    expect(migrateData('rpg:save', { a: 1 }, 2, table)).toEqual({ a: 1, b: 2 });
    expect(migrateData('rpg:save', { a: 1, b: 2 }, 3, table)).toEqual({ a: 1, b: 2 });
  });
});
