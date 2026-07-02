/**
 * Quest log — the adventure's milestones as pure predicates over the save.
 * The field menu renders these as a checklist; the objective banner keeps
 * pointing at the next undone step. Data + predicates only, fully testable.
 */
import type { RpgSave } from './rpg-types';

export interface Quest {
  readonly id: string;
  readonly title: string;
  /** Where to go / what to do while the quest is open. */
  readonly hint: string;
  readonly done: (g: RpgSave) => boolean;
}

export const QUESTS: readonly Quest[] = [
  { id: 'starter', title: 'Choose your first Pokémon', hint: 'Prof. Oak has three partners waiting.', done: (g) => !!g.flags['starter'] },
  { id: 'first-battle', title: 'Survive a wild battle', hint: 'Step into the tall grass south of town.', done: (g) => !!g.flags['first-battle'] },
  { id: 'catch', title: 'Catch a wild Pokémon', hint: 'Weaken it first, then throw a Poké Ball.', done: (g) => g.caught.length >= 2 },
  { id: 'bugcatcher', title: 'Beat Bug Catcher Sam', hint: 'He guards the grass in Verdant Town.', done: (g) => !!g.flags['beat-bugcatcher'] },
  { id: 'badge1', title: 'Earn the Hive Badge', hint: 'Route 1 leads south to the Oakhaven Gym.', done: (g) => g.badges.includes('Hive Badge') },
  { id: 'rival', title: 'Defeat your rival', hint: 'Blue waits on the Stonehollow square.', done: (g) => !!g.flags['beat-rival'] },
  { id: 'badge2', title: 'Earn the Boulder Badge', hint: 'Route 2 and the cave lead to Stonehollow.', done: (g) => g.badges.includes('Boulder Badge') },
  { id: 'badge3', title: 'Earn the Knuckle Badge', hint: 'Past the ranger, Route 3 leads to Sunreach.', done: (g) => g.badges.includes('Knuckle Badge') },
  { id: 'party6', title: 'Assemble a full team of six', hint: 'Catch and carry six Pokémon at once.', done: (g) => g.party.length >= 6 },
  { id: 'dex10', title: 'Register 10 caught species', hint: 'The tall grass changes route to route.', done: (g) => g.caught.length >= 10 },
];

export interface QuestEntry {
  readonly quest: Quest;
  readonly done: boolean;
}

/** Every quest with its live done/undone state (done first? no — keep story order). */
export function questLog(g: RpgSave): QuestEntry[] {
  return QUESTS.map((quest) => ({ quest, done: quest.done(g) }));
}

export function questProgress(g: RpgSave): { done: number; total: number } {
  return { done: QUESTS.reduce((n, q) => n + (q.done(g) ? 1 : 0), 0), total: QUESTS.length };
}
