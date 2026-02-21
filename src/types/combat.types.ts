import type { Card } from '@/types/card.types';
import type { RoundLogEntry } from '@/db/types.ts';

/**
 * Dice roll results for both players
 */
export interface DiceResults {
  playerAttack: number;
  playerDefense: number;
  enemyAttack: number;
  enemyDefense: number;
}

/**
 * Calculated combat results after applying modifiers
 */
export interface CombatCalculation {
  playerAttack: number;
  playerDefense: number;
  enemyAttack: number;
  enemyDefense: number;
  damageToEnemy: number;
  damageToPlayer: number;
}

/**
 * Combat end result
 */
export interface CombatEndResult {
  victory: boolean;
  playerCard: Card;
  roundsLog: readonly RoundLogEntry[];
}
