import type { Card } from '@/types/card.types';
import type { DiceResults, CombatCalculation } from '@/types/combat.types';

/**
 * Calculate combat results from dice rolls and card modifiers
 */
export const calculateCombatResult = (
  diceResults: DiceResults,
  playerCard: Card,
  enemyCard: Card
): CombatCalculation => {
  const playerAttackTotal = diceResults.playerAttack + playerCard.attackMod;
  const playerDefenseTotal = diceResults.playerDefense + playerCard.defenseMod;
  const enemyAttackTotal = diceResults.enemyAttack + enemyCard.attackMod;
  const enemyDefenseTotal = diceResults.enemyDefense + enemyCard.defenseMod;

  // Damage: direct subtraction (ATK - DEF, floored at 0)
  const damageToEnemy = Math.max(0, playerAttackTotal - enemyDefenseTotal);
  const damageToPlayer = Math.max(0, enemyAttackTotal - playerDefenseTotal);

  return {
    playerAttack: playerAttackTotal,
    playerDefense: playerDefenseTotal,
    enemyAttack: enemyAttackTotal,
    enemyDefense: enemyDefenseTotal,
    damageToEnemy,
    damageToPlayer,
  };
};

/**
 * Apply damage to cards and return updated versions
 */
export const applyDamage = (
  playerCard: Card,
  enemyCard: Card,
  calculation: CombatCalculation
): { updatedPlayer: Card; updatedEnemy: Card } => {
  const updatedPlayer: Card = {
    ...playerCard,
    currentHp: Math.max(0, playerCard.currentHp - calculation.damageToPlayer),
  };

  const updatedEnemy: Card = {
    ...enemyCard,
    currentHp: Math.max(0, enemyCard.currentHp - calculation.damageToEnemy),
  };

  return { updatedPlayer, updatedEnemy };
};

/**
 * Check if combat is finished
 */
export const isCombatFinished = (playerCard: Card, enemyCard: Card): boolean => {
  return playerCard.currentHp <= 0 || enemyCard.currentHp <= 0;
};

/**
 * Determine winner of combat
 */
export const getWinner = (playerCard: Card, enemyCard: Card): 'player' | 'enemy' | null => {
  if (enemyCard.currentHp <= 0) return 'player';
  if (playerCard.currentHp <= 0) return 'enemy';
  return null;
};
