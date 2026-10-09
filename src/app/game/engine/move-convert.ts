/**
 * Maps a PokéAPI move onto the engine's {@link BattleMove}. Pure and synchronous so it can be
 * unit-tested with plain fixtures; the battle service only fetches data and calls this.
 */
import type { MoveDto } from '../../core/dto/pokeapi.dto';
import { isPokemonType, type PokemonType } from '../../core/utils/type-chart';
import type { BattleMove, DamageClass, MoveFlags, SecondaryEffect } from './battle-types';
import type { HazardKind } from './hazards';
import type { BoostableStat } from './stat-stages';
import type { StatusCondition } from './status';
import type { Terrain } from './terrain';
import type { Weather } from './weather';

/** PokéAPI ailment slugs the engine models as non-volatile conditions. */
const AILMENT: Record<string, StatusCondition> = {
  paralysis: 'paralysis',
  sleep: 'sleep',
  freeze: 'freeze',
  burn: 'burn',
  poison: 'poison',
};

const BOOSTABLE = new Set<string>(['attack', 'defense', 'special-attack', 'special-defense', 'speed', 'accuracy', 'evasion']);

/** Field-setting status moves, by name. */
const WEATHER: Record<string, Weather> = { 'rain-dance': 'rain', 'sunny-day': 'sun', sandstorm: 'sand', hail: 'hail', snowscape: 'snow' };
const TERRAIN: Record<string, Terrain> = { 'electric-terrain': 'electric', 'grassy-terrain': 'grassy', 'psychic-terrain': 'psychic', 'misty-terrain': 'misty' };
const HAZARD: Record<string, HazardKind> = { 'stealth-rock': 'stealth-rock', spikes: 'spikes', 'toxic-spikes': 'toxic-spikes' };

/** Damaging moves whose stat change hits the *user* (drops after the hit, or a self-boost). */
const SELF_STAT_MOVES = new Set([
  'close-combat', 'superpower', 'overheat', 'draco-meteor', 'leaf-storm', 'v-create', 'hammer-arm', 'psycho-boost',
  'fleur-cannon', 'clanging-scales', 'dragon-ascent', 'armor-cannon', 'make-it-rain', 'headlong-rush', 'shell-smash',
  'power-up-punch', 'flame-charge', 'ancient-power', 'silver-wind', 'ominous-wind', 'metal-claw', 'steel-wing',
  'meteor-mash', 'diamond-storm', 'charge-beam', 'fiery-dance', 'trailblaze', 'rapid-spin', 'spin-out', 'scale-shot',
]);

/** Physical moves that do NOT make contact (everything else physical does). */
const NON_CONTACT = new Set([
  'earthquake', 'rock-slide', 'rock-tomb', 'rock-blast', 'bullet-seed', 'pin-missile', 'icicle-spear', 'icicle-crash',
  'razor-leaf', 'stone-edge', 'bonemerang', 'bone-rush', 'bone-club', 'fissure', 'explosion', 'self-destruct',
  'poison-sting', 'twineedle', 'barrage', 'egg-bomb', 'spike-cannon', 'sacred-sword', 'smack-down', 'magnitude',
  'earth-power', 'bulldoze', 'fling', 'gunk-shot', 'sludge-bomb', 'cross-poison', 'poison-jab', 'thousand-arrows',
  'thousand-waves', 'present', 'dragon-darts', 'diamond-storm', 'steel-beam', 'sky-attack', 'sky-drop', 'head-charge',
]);

const SOUND = new Set([
  'growl', 'roar', 'sing', 'supersonic', 'screech', 'snore', 'hyper-voice', 'bug-buzz', 'boomburst', 'echoed-voice',
  'uproar', 'metal-sound', 'perish-song', 'round', 'chatter', 'relic-song', 'sparkling-aria', 'disarming-voice',
]);

function flagsFor(name: string, damageClass: DamageClass): MoveFlags | undefined {
  const flags: { contact?: boolean; sound?: boolean; punch?: boolean; bite?: boolean } = {};
  if (damageClass === 'physical' && !NON_CONTACT.has(name)) flags.contact = true;
  if (name.endsWith('-punch') || name === 'punch' || name === 'sucker-punch' || name === 'bullet-punch') flags.punch = true;
  if (name.endsWith('-fang') || name === 'bite' || name === 'crunch' || name === 'super-fang') flags.bite = true;
  if (SOUND.has(name)) flags.sound = true;
  return Object.keys(flags).length ? flags : undefined;
}

function boostsOf(dto: MoveDto): Partial<Record<BoostableStat, number>> | undefined {
  const out: Partial<Record<BoostableStat, number>> = {};
  for (const c of dto.stat_changes ?? []) {
    if (BOOSTABLE.has(c.stat.name) && c.change !== 0) out[c.stat.name as BoostableStat] = c.change;
  }
  return Object.keys(out).length ? out : undefined;
}

/** True for moves that act on the user (or its side) rather than on the opponent. */
function targetsUser(dto: MoveDto): boolean {
  const t = dto.target?.name ?? '';
  return t === 'user' || t === 'user-or-ally' || t === 'users-field' || t === 'user-and-allies';
}

export function convertMove(dto: MoveDto): BattleMove {
  const rawType = dto.type.name;
  const type: PokemonType = isPokemonType(rawType) ? rawType : 'normal';
  const damageClass = (dto.damage_class?.name ?? 'physical') as DamageClass;
  const meta = dto.meta;
  const name = dto.name;
  const power = dto.power ?? 0;
  const isStatusMove = damageClass === 'status' || power <= 0;
  const status = meta ? AILMENT[meta.ailment?.name ?? ''] : undefined;
  const boosts = boostsOf(dto);

  const move: BattleMove = {
    name,
    type,
    power,
    // API `accuracy: null` means the move never misses → 0 in the engine.
    accuracy: dto.accuracy ?? 0,
    damageClass: isStatusMove ? 'status' : damageClass,
    priority: dto.priority,
    pp: dto.pp ?? undefined,
    flags: flagsFor(name, isStatusMove ? 'status' : damageClass),
  };

  if (isStatusMove) {
    if (boosts) {
      move.boosts = boosts;
      move.target = targetsUser(dto) ? 'self' : 'opponent';
    }
    // A status move's ailment is guaranteed (ailment_chance 0 means "always" there).
    if (status) move.inflictStatus = status;
    if (meta && meta.healing > 0) move.healing = meta.healing / 100;
    if (WEATHER[name]) move.setsWeather = WEATHER[name];
    if (TERRAIN[name]) move.setsTerrain = TERRAIN[name];
    if (HAZARD[name]) move.setsHazard = HAZARD[name];
    return move;
  }

  // Damaging move: optional on-hit rider (ailment, stat change, flinch).
  const secondary: { chance: number; status?: StatusCondition; boosts?: Partial<Record<BoostableStat, number>>; boostTarget?: 'self' | 'opponent'; flinch?: boolean } = { chance: 0 };
  if (status && meta && meta.ailment_chance > 0) {
    secondary.chance = meta.ailment_chance;
    secondary.status = status;
  }
  if (meta && meta.flinch_chance > 0) {
    secondary.chance = secondary.chance || meta.flinch_chance;
    secondary.flinch = true;
  }
  if (boosts) {
    secondary.chance = secondary.chance || meta?.stat_chance || 100;
    secondary.boosts = boosts;
    secondary.boostTarget = SELF_STAT_MOVES.has(name) ? 'self' : 'opponent';
  }
  if (secondary.chance > 0) move.secondary = secondary as SecondaryEffect;

  const drainPct = meta?.drain ?? 0;
  if (drainPct > 0) move.drain = drainPct / 100;
  if (drainPct < 0) move.recoil = -drainPct / 100;
  if (meta?.min_hits && meta.max_hits) move.multiHit = [meta.min_hits, meta.max_hits];
  if (meta?.crit_rate) move.critStage = meta.crit_rate;
  return move;
}

/** Status moves worth carrying into a live fight (they do something the engine models). */
export function isUsefulStatusMove(m: BattleMove): boolean {
  return (
    m.damageClass === 'status' &&
    !!(m.boosts || m.inflictStatus || m.healing || m.setsWeather || m.setsTerrain || m.setsHazard)
  );
}
