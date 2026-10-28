import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { BattlerFactory } from '../../core/battle/battler-factory';
import type { EliteTrainer } from '../../game/arena/elite-four';
import { LEADER_LADDER, type GymLeader } from '../../game/arena/gym-leaders';
import type { Battler } from '../../game/engine';
import { TeamBuilderService } from '../team-builder/team-builder.service';
import { ArenaTeams, TEAM_SIZE } from './arena-teams.service';

const battler = (id: string | number, level: number): Battler => ({
  id: typeof id === 'number' ? id : 1,
  name: String(id),
  level,
  types: ['normal'],
  stats: {
    hp: 100,
    attack: 50,
    defense: 50,
    'special-attack': 50,
    'special-defense': 50,
    speed: 50,
  },
  moves: [{ name: 'Tackle', type: 'normal', power: 40, accuracy: 100, damageClass: 'physical' }],
  ability: 'blaze',
});

describe('ArenaTeams', () => {
  let saved: { id: number }[];
  let broken: Set<string>;
  let requested: (string | number)[];

  beforeEach(() => {
    saved = [];
    broken = new Set();
    requested = [];
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: BattlerFactory,
          useValue: {
            buildBattler: (id: string | number, level: number) => {
              requested.push(id);
              return broken.has(String(id))
                ? Promise.reject(new Error('404'))
                : Promise.resolve(battler(id, level));
            },
          },
        },
        { provide: TeamBuilderService, useValue: { team: () => saved } },
      ],
    });
  });

  const teams = () => TestBed.inject(ArenaTeams);

  it('applies badge multipliers to every stat and keeps the rest of the mon', () => {
    const team = [battler(1, 50)];
    const boosted = teams().applyBadgeBoosts(team, new Set(['normal'])); // normal badge → hp
    expect(boosted[0]!.stats.hp).toBeGreaterThan(100);
    expect(boosted[0]!.stats.attack).toBe(50);
    expect(boosted[0]!.name).toBe('1');
    expect(team[0]!.stats.hp).toBe(100); // input untouched
  });

  it('leaves stats unchanged without badges', () => {
    expect(teams().applyBadgeBoosts([battler(1, 50)], new Set())[0]!.stats.hp).toBe(100);
  });

  it('builds a leader team with the configured item/ability', async () => {
    const leader = LEADER_LADDER[0]!;
    const built = await teams().buildLeaderTeam(leader, 30, false);
    expect(built).toHaveLength(leader.team.length);
    expect(built.every((b) => b.level === 30)).toBe(true);
    expect(built.map((b) => b.item)).toEqual(leader.team.map((m) => m.item));
    leader.team.forEach((m, i) => {
      if (m.ability) expect(built[i]!.ability).toBe(m.ability);
      else expect(built[i]!.ability).toBe('blaze');
    });
  });

  it('brings the ace twice on a rematch', async () => {
    const leader = LEADER_LADDER[0]!;
    const built = await teams().buildLeaderTeam(leader, 30, true);
    const aceSpecies = leader.team[leader.team.length - 1]!.species;
    expect(built).toHaveLength(leader.team.length + 1);
    expect(built.filter((b) => b.name === aceSpecies).length).toBeGreaterThanOrEqual(2);
  });

  it('drops team members that fail to load', async () => {
    const leader: GymLeader = LEADER_LADDER[0]!;
    broken.add(leader.team[0]!.species);
    const built = await teams().buildLeaderTeam(leader, 30, false);
    expect(built).toHaveLength(leader.team.length - 1);
  });

  it('builds an Elite trainer team at the trainer level', async () => {
    const trainer = {
      team: [{ species: 'weavile', item: 'choice-band' }, { species: 'umbreon' }],
      level: 73,
    } as unknown as EliteTrainer;
    const built = await teams().buildEliteTeam(trainer);
    expect(built.map((b) => b.level)).toEqual([73, 73]);
    expect(built[0]!.item).toBe('choice-band');
  });

  it('uses the saved team-builder squad, capped at the team size', async () => {
    saved = [{ id: 10 }, { id: 11 }, { id: 12 }, { id: 13 }];
    const built = await teams().buildPlayerTeam(40);
    expect(requested).toEqual([10, 11, 12]);
    expect(built).toHaveLength(TEAM_SIZE);
    expect(built.every((b) => b.level === 40)).toBe(true);
  });

  it('rolls a random trio of distinct mons when nothing is saved', async () => {
    const built = await teams().buildPlayerTeam(40);
    expect(built).toHaveLength(TEAM_SIZE);
    expect(new Set(requested).size).toBe(TEAM_SIZE);
  });
});
