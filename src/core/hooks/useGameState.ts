import { useState } from 'react';
import type { UseGameStateReturn } from './useGameState.types';
import type { Card } from '@/types/card.types';
import type { CombatEndResult } from '@/types/combat.types';
import { GameState } from '@enums/GameState.enum';
import { MAX_COMBATS } from '@shared/constants/cards';
import { generateEnemy } from '@shared/utils/enemyGenerator';
import { useAliveCards } from '@/shared/hooks/useAliveCards';
import {
  markCardAsDeadInDeck,
  markCardAsDeadIfNeeded,
} from '@/shared/utils/cardDeathUtils';

/**
 * Central game state management hook
 */
export const useGameState = (): UseGameStateReturn => {
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [currentCombat, setCurrentCombat] = useState(1);
  const [playerCard, setPlayerCard] = useState<Card | null>(null);
  const [enemyCard, setEnemyCard] = useState<ReturnType<typeof generateEnemy> | null>(null);
  const [playerDeck, setPlayerDeck] = useState<Card[]>([]);
  const [rewardCard, setRewardCard] = useState<Card | null>(null); // Temporary reward card

  // Use the alive cards hook to get card statistics
  const { aliveCards, deadCards, aliveCardsCount, deadCardsCount } = useAliveCards(playerDeck);

  /**
   * Start a new run
   * Transition: MENU → DECK_SELECTION
   */
  const startNewRun = () => {
    console.log('Starting new run...');

    // Reset states
    setPlayerDeck([]);
    setPlayerCard(null);
    setEnemyCard(null);
    setCurrentCombat(0);

    // Go to deck selection
    setGameState(GameState.DECK_SELECTION);
  };

  /**
   * Handler for deck confirmation (5 cards)
   * Transition: DECK_SELECTION → COMBAT
   */
  const handleDeckConfirmed = (selectedCards: Card[]) => {
    console.log('Deck confirmed:', selectedCards);

    // Assign positions 1-5 based on selection order
    const deckWithPositions = selectedCards.map((card, index) => ({
      ...card,
      position: index + 1, // Position 1-5
    }));

    // Store the deck
    setPlayerDeck(deckWithPositions);

    // Clear the reward card
    setRewardCard(null);

    // The first card (position 1) becomes the active card
    setPlayerCard(deckWithPositions[0]);

    // If we're coming from a reward (currentCombat > 0), continue to next combat
    // Otherwise, start the first combat
    if (currentCombat > 0) {
      const nextCombat = currentCombat + 1;
      setCurrentCombat(nextCombat);
      startCombat(deckWithPositions[0], nextCombat);
    } else {
      setCurrentCombat(1);
      startCombat(deckWithPositions[0], 1);
    }
  };

  const startCombat = (_pCard: Card, combatNum: number) => {
    const enemy = generateEnemy(combatNum);
    setEnemyCard(enemy);
    setGameState(GameState.COMBAT);
  };

  const handleCombatEnd = ({ victory, playerCard: updatedPlayerCard }: CombatEndResult) => {
    // Check if the player card should be marked as dead
    const finalPlayerCard = markCardAsDeadIfNeeded(updatedPlayerCard);
    setPlayerCard(finalPlayerCard);

    // Update the deck with the potentially dead card
    if (finalPlayerCard.isDead) {
      setPlayerDeck((prevDeck) => markCardAsDeadInDeck(prevDeck, finalPlayerCard.id));
    }

    if (!victory) {
      setGameState(GameState.GAMEOVER);
      return;
    }

    if (currentCombat >= MAX_COMBATS) {
      setGameState(GameState.GAMEOVER);
    } else {
      setGameState(GameState.REWARD);
    }
  };

  /**
   * Helper: Get next combat card by position
   * Always selects the first ALIVE card by position order
   * Position 1 fights first, if dead → Position 2, etc.
   */
  const getNextCombatCard = (deck: Card[]): Card | null => {
    const aliveSortedCards = deck
      .filter((c) => !c.isDead)
      .sort((a, b) => (a.position || 0) - (b.position || 0));

    return aliveSortedCards[0] || null;
  };

  /**
   * Handler when user chooses to continue
   * If a card is selected, it's added to the deck
   * If no card is selected, continues with current deck
   * Transition: REWARD → COMBAT
   */
  const handleRewardContinue = (selectedCard: Card | null) => {
    console.log('Continuing with selected card:', selectedCard);

    let updatedDeck = playerDeck;

    // If a card was selected, add it to the deck
    if (selectedCard) {
      // Find next available position
      const aliveCardsInDeck = playerDeck.filter(c => !c.isDead);
      const usedPositions = aliveCardsInDeck.map(c => c.position || 0);
      let nextPosition = 1;
      while (usedPositions.includes(nextPosition)) {
        nextPosition++;
      }

      const cardWithPosition = { ...selectedCard, position: nextPosition };
      updatedDeck = [...playerDeck, cardWithPosition];
      setPlayerDeck(updatedDeck);
    }

    // Clear reward card
    setRewardCard(null);

    // Select the first alive card by position
    const nextCard = getNextCombatCard(updatedDeck);

    if (!nextCard) {
      // No alive cards left
      setGameState(GameState.GAMEOVER);
      return;
    }

    const nextCombat = currentCombat + 1;
    setPlayerCard(nextCard);
    setCurrentCombat(nextCombat);
    startCombat(nextCard, nextCombat);
  };

  /**
   * Handler when user chooses to modify deck with reward card
   * Transition: REWARD → DECK_SELECTION
   */
  const handleRewardModifyDeck = (selectedCard: Card) => {
    console.log('Modifying deck with reward card:', selectedCard);

    // Store the reward card temporarily
    setRewardCard(selectedCard);

    // Go to deck selection screen
    setGameState(GameState.DECK_SELECTION);
  };

  const handleBackToMenu = () => {
    setGameState(GameState.MENU);
    setCurrentCombat(1);
    setPlayerCard(null);
    setEnemyCard(null);
  };

  /**
   * Mark a card as dead in the player deck
   * @param cardId - The ID of the card to mark as dead
   */
  const markCardAsDead = (cardId: number) => {
    setPlayerDeck((prevDeck) => markCardAsDeadInDeck(prevDeck, cardId));
  };

  return {
    gameState,
    currentCombat,
    playerCard,
    enemyCard,
    playerDeck,
    rewardCard,
    aliveCards,
    deadCards,
    aliveCardsCount,
    deadCardsCount,
    startNewRun,
    handleDeckConfirmed,
    handleCombatEnd,
    handleRewardContinue,
    handleRewardModifyDeck,
    handleBackToMenu,
    markCardAsDead,
  };
};
