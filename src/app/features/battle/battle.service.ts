// The battler factory moved to core/battle. This alias keeps the Adventure (RPG) code, which
// still injects `BattleService`, working without touching it.
export { BattlerFactory as BattleService } from '../../core/battle/battler-factory';
