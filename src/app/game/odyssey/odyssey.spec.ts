import { describe, expect, it } from 'vitest';
import {
  BASE_STARTERS,
  BIOMES,
  WAVES_PER_BIOME,
  biomeForWave,
  coinsForWave,
  defaultOdysseyMeta,
  foeLevel,
  generateOdysseyRewards,
  generateOdysseyShop,
  levelGain,
  loopForWave,
  recordOdysseyRun,
  starterRoster,
  unlockSpecies,
  waveKind,
  waveSpec,
} from './odyssey';

describe('odyssey waves', () => {
  it('cycles biomes every 10 waves and loops after all eight', () => {
    expect(biomeForWave(1).id).toBe('meadow');
    expect(biomeForWave(10).id).toBe('meadow');
    expect(biomeForWave(11).id).toBe('forest');
    expect(biomeForWave(80).id).toBe('roost');
    expect(biomeForWave(81).id).toBe('meadow');
    expect(loopForWave(81)).toBe(1);
  });

  it('marks bosses on biome finales and elites every fifth wave', () => {
    expect(waveKind(10)).toBe('boss');
    expect(waveKind(5)).toBe('elite');
    expect(waveKind(15)).toBe('elite');
    expect(waveKind(3)).toBe('wild');
  });

  it('levels climb monotonically with waves and cap at 100', () => {
    expect(foeLevel(1)).toBeLessThan(foeLevel(30));
    for (let w = 2; w <= 120; w++) expect(foeLevel(w)).toBeGreaterThanOrEqual(foeLevel(w - 1));
    expect(foeLevel(999)).toBe(100);
  });

  it('is deterministic per seed and differs across seeds', () => {
    expect(waveSpec(7, 'seed-a')).toEqual(waveSpec(7, 'seed-a'));
    const a = Array.from({ length: 9 }, (_, i) => waveSpec(i + 1, 'seed-a').species[0]);
    const b = Array.from({ length: 9 }, (_, i) => waveSpec(i + 1, 'seed-b').species[0]);
    expect(a.join()).not.toBe(b.join());
  });

  it('boss waves field the biome guardian last with a low catch chance', () => {
    const s = waveSpec(10, 'x');
    expect(s.kind).toBe('boss');
    expect(s.species[s.species.length - 1]).toBe(BIOMES[0].boss);
    expect(s.catchChance).toBeLessThan(waveSpec(1, 'x').catchChance);
  });

  it('draws species from the wave biome pool', () => {
    for (let w = 1; w < WAVES_PER_BIOME; w++) {
      const s = waveSpec(w, 'pool-check');
      for (const id of s.species) expect([...s.biome.pool, s.biome.boss]).toContain(id);
    }
  });

  it('grants bigger level jumps for harder waves', () => {
    expect(levelGain('wild')).toBe(1);
    expect(levelGain('elite')).toBe(2);
    expect(levelGain('boss')).toBe(3);
  });

  it('offers three distinct seeded rewards', () => {
    const r = generateOdysseyRewards(4, 'r');
    expect(r).toHaveLength(3);
    expect(new Set(r.map((x) => x.kind)).size).toBe(3);
    expect(generateOdysseyRewards(4, 'r')).toEqual(r);
  });

  it('pays coins that scale with wave and kind', () => {
    expect(coinsForWave(1, 'wild')).toBeLessThan(coinsForWave(9, 'wild'));
    expect(coinsForWave(10, 'boss')).toBeGreaterThan(coinsForWave(10, 'elite'));
  });

  it('every biome guardian imposes a field condition', () => {
    for (const b of BIOMES) {
      expect(b.field.label.length).toBeGreaterThan(0);
      expect(!!b.field.weather || !!b.field.terrain).toBe(true);
    }
  });

  it('stocks a seeded trader with two distinct relics and rising prices', () => {
    const s = generateOdysseyShop(10, 'x');
    expect(s).toHaveLength(5);
    expect(generateOdysseyShop(10, 'x')).toEqual(s);
    const relics = s.filter((e) => e.kind === 'relic').map((e) => e.payload);
    expect(new Set(relics).size).toBe(2);
    const later = generateOdysseyShop(40, 'x');
    expect(later[0].cost).toBeGreaterThan(s[0].cost);
  });
});

describe('odyssey meta', () => {
  it('starts with the classic starter roster', () => {
    expect(starterRoster(defaultOdysseyMeta())).toEqual([...BASE_STARTERS]);
  });

  it('unlocks caught species permanently and deduplicates', () => {
    let m = unlockSpecies(defaultOdysseyMeta(), 143);
    m = unlockSpecies(m, 143);
    expect(m.unlocked).toEqual([143]);
    expect(m.totalCaught).toBe(2);
    expect(starterRoster(m)).toContain(143);
  });

  it('records the best wave across runs', () => {
    let m = recordOdysseyRun(defaultOdysseyMeta(), 12);
    m = recordOdysseyRun(m, 7);
    expect(m.bestWave).toBe(12);
    expect(m.runs).toBe(2);
  });
});
