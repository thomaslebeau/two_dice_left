import type { Database } from 'sql.js';

/**
 * Any object that provides a sql.js Database and persistence methods.
 * Implemented by DatabaseManager (browser/IndexedDB) and HeadlessDatabaseManager (Node.js/fs).
 */
export interface DbProvider {
  readonly db: Database;
  scheduleSave(): void;
  saveNow(): void | Promise<void>;
}

/**
 * Data captured for a single combat round, pushed by CombatEngine.
 */
export interface RoundLogEntry {
  roundNumber: number;
  playerAttackRoll: number;
  playerDefenseRoll: number;
  enemyAttackRoll: number;
  enemyDefenseRoll: number;
  playerAttackTotal: number;
  playerDefenseTotal: number;
  enemyAttackTotal: number;
  enemyDefenseTotal: number;
  damageToPlayer: number;
  damageToEnemy: number;
  playerHpAfter: number;
  enemyHpAfter: number;
}

/**
 * Full combat log data passed to the repository for insertion.
 */
export interface CombatLogData {
  runId: number;
  combatNumber: number;
  playerCardId: number;
  playerCardName: string;
  playerStartHp: number;
  playerAttackMod: number;
  playerDefenseMod: number;
  enemyCardName: string;
  enemyStartHp: number;
  enemyAttackMod: number;
  enemyDefenseMod: number;
  totalRounds: number;
  victory: boolean;
  rounds: readonly RoundLogEntry[];
}
