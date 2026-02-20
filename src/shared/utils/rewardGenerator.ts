import type { CardBase } from '@/types/card.types';
import { CARD_DATABASE } from '@shared/constants/cards';

/**
 * Generate a set of random reward cards by shuffling the card database.
 * Deduplicated from inline useState initializers in DeckManagementScreen / RewardScreen.
 */
export function generateRewardCards(count: number): CardBase[] {
  const shuffled = [...CARD_DATABASE].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}
