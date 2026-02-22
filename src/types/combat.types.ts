import type { Card } from '@/types/card.types';
import type { RoundLogEntry } from '@/db/types.ts';

/**
 * Dice allocation for a single die (GDD v5 — future use)
 */
export interface DiceAllocation {
  target: 'attack' | 'defense';
  value: number;
}

/**
 * A single combat round with dice allocations (GDD v5 — future use)
 */
export interface CombatRound {
  roundNumber: number;
  playerAllocations: DiceAllocation[];
  enemyAllocations: DiceAllocation[];
}

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
