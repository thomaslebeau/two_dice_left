import type { Card } from '@/types/card.types';

/**
 * DeckManagementScreen props
 */
export interface DeckManagementScreenProps {
  currentDeck: Card[]; // Current player deck
  onContinue: (selectedCard: Card | null) => void; // Callback when user chooses to continue (with or without card)
  onModifyDeck: (selectedCard: Card) => void; // Callback when user wants to modify deck
  combatNumber: number; // Current combat number
}
