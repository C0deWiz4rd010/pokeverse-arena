import { describe, expect, it } from 'vitest';
import {
  isGrounded,
  terrainBlocksPriority,
  terrainBlocksStatus,
  terrainDamageFactor,
  terrainHeal,
} from './terrain';

describe('terrain', () => {
  it('only grounds non-Flying types', () => {
    expect(isGrounded(['grass'])).toBe(true);
    expect(isGrounded(['flying'])).toBe(false);
    expect(isGrounded(['normal', 'flying'])).toBe(false);
  });

  it('boosts the matching move type for grounded attackers', () => {
    expect(terrainDamageFactor('electric', 'electric', true, true)).toBe(1.3);
    expect(terrainDamageFactor('electric', 'electric', false, true)).toBe(1);
    expect(terrainDamageFactor('grassy', 'grass', true, true)).toBe(1.3);
  });

  it('halves Dragon damage to grounded targets in misty terrain', () => {
    expect(terrainDamageFactor('misty', 'dragon', true, true)).toBe(0.5);
    expect(terrainDamageFactor('misty', 'dragon', true, false)).toBe(1);
  });

  it('electric terrain blocks sleep on grounded targets', () => {
    expect(terrainBlocksStatus('electric', 'sleep', true)).toBe(true);
    expect(terrainBlocksStatus('electric', 'sleep', false)).toBe(false);
  });

  it('misty terrain blocks all status on grounded targets', () => {
    expect(terrainBlocksStatus('misty', 'burn', true)).toBe(true);
    expect(terrainBlocksStatus('misty', 'paralysis', true)).toBe(true);
  });

  it('grassy terrain heals grounded Pokémon', () => {
    expect(terrainHeal('grassy', 160, true)).toBe(10);
    expect(terrainHeal('grassy', 160, false)).toBe(0);
    expect(terrainHeal('electric', 160, true)).toBe(0);
  });

  it('psychic terrain blocks priority on grounded targets', () => {
    expect(terrainBlocksPriority('psychic', 1, true)).toBe(true);
    expect(terrainBlocksPriority('psychic', 0, true)).toBe(false);
    expect(terrainBlocksPriority('psychic', 1, false)).toBe(false);
  });
});
