import { useState, useCallback, useMemo } from 'react';
import type { Card } from '@/types/card.types';
import { CARD_DATABASE, MAX_CARD_QUANTITY } from '@shared/constants/cards';

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
  getSelectedCount: (cardId: number) => number;
  canStartCombat: boolean;
}

export const useDeckSelection = (params?: UseDeckSelectionParams): UseDeckSelectionReturn => {
  const { rewardCard, currentDeck } = params || {};

  // Build available cards list
  const availableCards = useMemo(() => {
    const baseCards = CARD_DATABASE.slice(0, 5).map((card) => {
      if (currentDeck) {
        // Count how many instances of this card exist in the deck (excluding dead cards)
        const instances = currentDeck.filter(c => c.id === card.id && !c.isDead);
        if (instances.length > 0) {
          // Use the first instance as the base, but set quantity to the count
          const firstInstance = instances[0];
          return {
            ...firstInstance,
            quantity: instances.length,
          };
        }
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
  // currentDeck already contains multiple instances of the same card if quantity > 1
  const [selectedCards, setSelectedCards] = useState<Card[]>(() => {
    if (currentDeck) {
      return currentDeck.filter(c => !c.isDead);
    }
    return [];
  });

  /**
   * Toggle card selection - allows selecting the same card multiple times (up to MAX_CARD_QUANTITY)
   * Each click adds a copy until MAX_CARD_QUANTITY is reached, then removes one copy
   */
  const toggleCardSelection = useCallback((card: Card) => {
    setSelectedCards(prev => {
      const selectedCount = prev.filter(c => c.id === card.id).length;

      // If we've selected all allowed copies of this card, remove one instance
      if (selectedCount >= MAX_CARD_QUANTITY) {
        const indexToRemove = prev.findIndex(c => c.id === card.id);
        if (indexToRemove !== -1) {
          return prev.filter((_, index) => index !== indexToRemove);
        }
        return prev;
      }

      // If we've reached the deck limit (5 cards), can't add more
      if (prev.length >= 5) {
        console.log('Maximum 5 cards already selected');
        return prev;
      }

      // Add another copy of this card
      return [...prev, { ...card }];
    });
  }, []);

  /**
   * Check if a card is selected (at least once)
   */
  const isCardSelected = useCallback(
    (cardId: number): boolean => {
      return selectedCards.some(c => c.id === cardId);
    },
    [selectedCards]
  );

  /**
   * Get how many copies of a card are selected
   */
  const getSelectedCount = useCallback(
    (cardId: number): number => {
      return selectedCards.filter(c => c.id === cardId).length;
    },
    [selectedCards]
  );

  /**
   * Get selection order (1-based index) for the FIRST instance of a card, or 0 if not selected
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
    getSelectedCount,
    canStartCombat,
  };
};
