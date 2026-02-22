import type { Rarity } from '@enums/Rarity.enum';
import type { AllocationPattern } from '@/core/DiceAllocator.ts';

/**
 * Base card structure from database
 */
export interface CardBase {
  id: number;
  name: string;
  rarity: Rarity;
  maxHp: number;
  attackMod: number;
  defenseMod: number;
  description: string;
}

/**
 * Card instance in game (with current HP)
 */
export interface Card extends CardBase {
  currentHp: number;
  isDead?: boolean;
  position?: number; // Combat order position (1-5)
}

/**
 * Base enemy template in the database, including dice allocation AI.
 */
export interface EnemyBase extends CardBase {
  allocationPattern: AllocationPattern;
}

/**
 * Enemy card instance in game
 */
export interface EnemyCard extends Card {
  isBoss?: boolean;
  allocationPattern: AllocationPattern;
}

