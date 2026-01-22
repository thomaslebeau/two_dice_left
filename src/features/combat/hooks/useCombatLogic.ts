import { useState, useEffect } from 'react';
import type { UseCombatLogicProps, UseCombatLogicReturn } from './useCombatLogic.types';
import type { DiceResults } from '@/types/combat.types';
import { rollDice } from '@shared/constants/dice';
import { calculateCombatResult, applyDamage } from '@shared/utils/combatCalculations';

/**
 * Hook managing combat round logic, dice rolls, and damage calculation
 */
export const useCombatLogic = ({
  playerCard,
  enemyCard,
  onCombatEnd,
  onCardUpdate,
}: UseCombatLogicProps): UseCombatLogicReturn => {
  const [roundNumber, setRoundNumber] = useState(1);
  const [diceKey, setDiceKey] = useState(0);
  const [diceResults, setDiceResults] = useState<DiceResults>(() => ({
    playerAttack: rollDice(),
    playerDefense: rollDice(),
    enemyAttack: rollDice(),
    enemyDefense: rollDice(),
  }));
  const [showResults, setShowResults] = useState(false);
  const [roundResolved, setRoundResolved] = useState(false);
  const [combatFinished, setCombatFinished] = useState(false);

  const [currentPlayerCard, setCurrentPlayerCard] = useState(playerCard);
  const [currentEnemyCard, setCurrentEnemyCard] = useState(enemyCard);

  // Show results after dice animation (2100ms to match rolling animation duration)
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowResults(true);
    }, 2100);
    return () => clearTimeout(timer);
  }, [diceKey]);

  // Resolve round when results are shown
  useEffect(() => {
    if (showResults && !roundResolved && !combatFinished) {
      setTimeout(() => {
        const calculation = calculateCombatResult(
          diceResults,
          currentPlayerCard,
          currentEnemyCard
        );

        const { updatedPlayer, updatedEnemy } = applyDamage(
          currentPlayerCard,
          currentEnemyCard,
          calculation
        );

        setCurrentPlayerCard(updatedPlayer);
        setCurrentEnemyCard(updatedEnemy);

        // Update HP in parent state immediately after each round
        if (onCardUpdate) {
          onCardUpdate(updatedPlayer, updatedEnemy);
        }

        if (updatedPlayer.currentHp <= 0 || updatedEnemy.currentHp <= 0) {
          setCombatFinished(true);
          setTimeout(() => {
            onCombatEnd({
              victory: updatedEnemy.currentHp <= 0,
              playerCard: updatedPlayer,
            });
          }, 2000);
        }

        setRoundResolved(true);
      }, 1000);
    }
  }, [showResults, roundResolved, combatFinished, diceResults, currentPlayerCard, currentEnemyCard, onCombatEnd, onCardUpdate]);

  const handleNextRound = () => {
    setRoundNumber((prev) => prev + 1);
    setDiceResults({
      playerAttack: rollDice(),
      playerDefense: rollDice(),
      enemyAttack: rollDice(),
      enemyDefense: rollDice(),
    });
    setShowResults(false);
    setRoundResolved(false);
    setDiceKey((prev) => prev + 1);
  };

  let combatResult = null;
  if (showResults) {
    combatResult = calculateCombatResult(
      diceResults,
      currentPlayerCard,
      currentEnemyCard
    );
  }

  return {
    roundNumber,
    diceKey,
    diceResults,
    showResults,
    roundResolved,
    combatFinished,
    currentPlayerCard,
    currentEnemyCard,
    combatResult,
    handleNextRound,
  };
};
