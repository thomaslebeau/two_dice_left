import type { Rarity } from '@enums/Rarity.enum';

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
 * Enemy card with boss flag
 */
export interface EnemyCard extends Card {
  isBoss?: boolean;
}

