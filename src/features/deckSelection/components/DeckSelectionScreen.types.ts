import type { Card } from '@/types/card.types';

export interface DeckSelectionScreenProps {
  /**
   * Callback when 5 cards are selected and user confirms
   */
  onDeckConfirmed: (selectedCards: Card[]) => void;

  /**
   * Callback to return to main menu
   */
  onBackToMenu: () => void;

  /**
   * Optional reward card to add to the available cards pool
   * This card will be pre-selected if provided
   */
  rewardCard?: Card;

  /**
   * Optional current deck to restore selection when coming from reward screen
   */
  currentDeck?: Card[];
}
