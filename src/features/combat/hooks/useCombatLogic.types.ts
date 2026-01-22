import type { Card, EnemyCard } from '@/types/card.types';
import type { DiceResults, CombatCalculation, CombatEndResult } from '@/types/combat.types';

/**
 * Props for useCombatLogic hook
 */
export interface UseCombatLogicProps {
  playerCard: Card;
  enemyCard: EnemyCard;
  onCombatEnd: (result: CombatEndResult) => void;
  onCardUpdate?: (updatedPlayer: Card, updatedEnemy: EnemyCard) => void; // Called after each round to update HP in real-time
}

/**
 * Return type for useCombatLogic hook
 */
export interface UseCombatLogicReturn {
  roundNumber: number;
  diceKey: number;
  diceResults: DiceResults;
  showResults: boolean;
  roundResolved: boolean;
  combatFinished: boolean;
  currentPlayerCard: Card;
  currentEnemyCard: EnemyCard;
  combatResult: CombatCalculation | null;
  handleNextRound: () => void;
}
