import { describe, expect, it } from 'vitest';
import { addHazard, freshHazards, resolveSwitchInHazards } from './hazards';

describe('hazards — layers', () => {
  it('caps Stealth Rock at one layer', () => {
    let state = freshHazards();
    const first = addHazard(state, 'stealth-rock');
    expect(first.added).toBe(true);
    state = first.state;
    expect(addHazard(state, 'stealth-rock').added).toBe(false);
  });

  it('stacks spikes up to three layers', () => {
    let state = freshHazards();
    for (let i = 0; i < 3; i++) state = addHazard(state, 'spikes').state;
    expect(state.spikes).toBe(3);
    expect(addHazard(state, 'spikes').added).toBe(false);
  });
});

describe('hazards — switch-in', () => {
  it('Stealth Rock scales with Rock effectiveness', () => {
    const state = { ...freshHazards(), 'stealth-rock': 1 };
    // Fire is weak to Rock (2x): 1/8 * 2 = 1/4 of 160 = 40.
    const fire = resolveSwitchInHazards(state, 'Mon', ['fire'], 160);
    expect(fire.damage).toBe(40);
    // Fighting resists Rock (0.5x): 1/8 * 0.5 = 1/16 of 160 = 10.
    const fighting = resolveSwitchInHazards(state, 'Mon', ['fighting'], 160);
    expect(fighting.damage).toBe(10);
    // Water is neutral to Rock (1x): 1/8 of 160 = 20.
    const water = resolveSwitchInHazards(state, 'Mon', ['water'], 160);
    expect(water.damage).toBe(20);
  });

  it('spikes only hit grounded Pokémon', () => {
    const state = { ...freshHazards(), spikes: 1 };
    expect(resolveSwitchInHazards(state, 'Mon', ['normal'], 160).damage).toBe(20); // 1/8
    expect(resolveSwitchInHazards(state, 'Mon', ['flying'], 160).damage).toBe(0);
  });

  it('toxic spikes poison grounded non-Poison types', () => {
    const one = { ...freshHazards(), 'toxic-spikes': 1 };
    expect(resolveSwitchInHazards(one, 'Mon', ['normal'], 160).status).toBe('poison');
    const two = { ...freshHazards(), 'toxic-spikes': 2 };
    expect(resolveSwitchInHazards(two, 'Mon', ['normal'], 160).status).toBe('toxic');
  });

  it('grounded Poison types absorb toxic spikes', () => {
    const state = { ...freshHazards(), 'toxic-spikes': 2 };
    const r = resolveSwitchInHazards(state, 'Mon', ['poison'], 160);
    expect(r.clearsToxicSpikes).toBe(true);
    expect(r.status).toBe('none');
  });
});
