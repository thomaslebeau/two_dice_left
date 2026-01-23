import { useState, useCallback, useMemo } from 'react';
import type { Card } from '@/types/card.types';
import { CARD_DATABASE } from '@shared/constants/cards';

interface UseDeckSelectionParams {
  rewardCard?: Card;
  currentDeck?: Card[];
}

interface UseDeckSelectionReturn {
  availableCards: Card[];
  selectedCards: Card[];
  toggleCardSelection: (card: Card) => void;
  isCardSelected: (cardId: number) => boolean;
  getSelectionOrder: (cardId: number) => number;
  canStartCombat: boolean;
}

export const useDeckSelection = (params?: UseDeckSelectionParams): UseDeckSelectionReturn => {
  const { rewardCard, currentDeck } = params || {};

  // Build available cards list
  const availableCards = useMemo(() => {
    const baseCards = CARD_DATABASE.slice(0, 5).map((card) => {
      // If this card exists in currentDeck, use its current state (including reduced HP and quantity)
      const existingCard = currentDeck?.find(c => c.id === card.id);
      if (existingCard) {
        return existingCard;
      }

      // Otherwise, create new card with full HP and quantity 1
      return {
        ...card,
        currentHp: card.maxHp,
        quantity: 1,
      };
    });

    // Add reward card if provided and not already in the list
    if (rewardCard && !baseCards.some(c => c.id === rewardCard.id)) {
      return [...baseCards, { ...rewardCard, quantity: rewardCard.quantity || 1 }];
    }

    return baseCards;
  }, [rewardCard, currentDeck]);

  // Initialize selected cards with current deck (excluding dead cards) if provided
  const [selectedCards, setSelectedCards] = useState<Card[]>(() => {
    if (currentDeck) {
      return currentDeck.filter(c => !c.isDead);
    }
    return [];
  });

  /**
   * Toggle card selection (select/deselect)
   */
  const toggleCardSelection = useCallback((card: Card) => {
    setSelectedCards(prev => {
      const isAlreadySelected = prev.some(c => c.id === card.id);

      if (isAlreadySelected) {
        // Deselect
        return prev.filter(c => c.id !== card.id);
      } else {
        // Select (max 5)
        if (prev.length >= 5) {
          console.log('Maximum 5 cards already selected');
          return prev;
        }
        return [...prev, card];
      }
    });
  }, []);

  /**
   * Check if a card is selected
   */
  const isCardSelected = useCallback(
    (cardId: number): boolean => {
      return selectedCards.some(c => c.id === cardId);
    },
    [selectedCards]
  );

  /**
   * Get selection order (1-based index) for a card, or 0 if not selected
   */
  const getSelectionOrder = useCallback(
    (cardId: number): number => {
      const index = selectedCards.findIndex(c => c.id === cardId);
      return index === -1 ? 0 : index + 1; // 1-based index
    },
    [selectedCards]
  );

  /**
   * Can start combat only if exactly 5 cards are selected
   */
  const canStartCombat = selectedCards.length === 5;

  return {
    availableCards,
    selectedCards,
    toggleCardSelection,
    isCardSelected,
    getSelectionOrder,
    canStartCombat,
  };
};
