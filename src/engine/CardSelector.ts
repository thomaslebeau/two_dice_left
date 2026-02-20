import type { Card } from '@/types/card.types';
import { CARD_DATABASE } from '@shared/constants/cards';

/**
 * Snapshot of the card selector state, emitted to listeners on every change.
 */
export interface CardSelectorSnapshot {
  availableCards: Card[];
  selectedCard: Card | null;
  canFight: boolean;
}

/**
 * Configuration passed when creating a CardSelector.
 */
export interface CardSelectorConfig {
  collection: Card[];
}

type CardSelectorListener = (snapshot: CardSelectorSnapshot) => void;

/**
 * Manages single card selection for combat (v2).
 * Shows the player's collection or the starter pool, and lets them pick one.
 */
export class CardSelector {
  private _availableCards: Card[];
  private _selectedCard: Card | null = null;
  private listeners = new Set<CardSelectorListener>();

  constructor(config?: CardSelectorConfig) {
    const collection = config?.collection ?? [];

    if (collection.length > 0) {
      // Show alive cards from collection
      this._availableCards = collection.filter((c) => !c.isDead);
    } else {
      // First combat: show starter pool (first 5 cards from database)
      this._availableCards = CARD_DATABASE.slice(0, 5).map((card) => ({
        ...card,
        currentHp: card.maxHp,
      }));
    }
  }

  // --- Read-only accessors ---

  get availableCards(): Card[] { return this._availableCards; }
  get selectedCard(): Card | null { return this._selectedCard; }
  get canFight(): boolean { return this._selectedCard !== null; }

  // --- Subscription ---

  onChange(listener: CardSelectorListener): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  private emit(): void {
    const snap = this.snapshot();
    for (const listener of this.listeners) {
      listener(snap);
    }
  }

  snapshot(): CardSelectorSnapshot {
    return {
      availableCards: [...this._availableCards],
      selectedCard: this._selectedCard,
      canFight: this.canFight,
    };
  }

  // --- Actions ---

  /**
   * Select a card for combat. Selecting the same card again deselects it.
   */
  selectCard(card: Card): void {
    if (this._selectedCard?.id === card.id) {
      this._selectedCard = null;
    } else {
      this._selectedCard = card;
    }
    this.emit();
  }

  /**
   * Check if a card is currently selected.
   */
  isCardSelected(cardId: number): boolean {
    return this._selectedCard?.id === cardId;
  }

  /**
   * Clean up listeners.
   */
  destroy(): void {
    this.listeners.clear();
  }
}
