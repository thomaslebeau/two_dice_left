import type { Card } from '@/types/card.types';
import { CARD_DATABASE } from '@shared/constants/cards';

/**
 * Snapshot of the card selector state, emitted to listeners on every change.
 */
export interface CardSelectorSnapshot {
  availableCards: Card[];
  lockedCards: Card[];
  selectedCard: Card | null;
  canFight: boolean;
}

type CardSelectorListener = (snapshot: CardSelectorSnapshot) => void;

/**
 * Manages single card selection for survivor pick (v5).
 * Shows the full card database as the survivor pool.
 */
export class CardSelector {
  private _availableCards: Card[];
  private _lockedCards: Card[];
  private _selectedCard: Card | null = null;
  private listeners = new Set<CardSelectorListener>();

  constructor(unlockedIds?: number[]) {
    const allCards = CARD_DATABASE.map((card) => ({
      ...card,
      currentHp: card.maxHp,
    }));

    if (unlockedIds) {
      const idSet = new Set(unlockedIds);
      this._availableCards = allCards.filter(c => idSet.has(c.id));
      this._lockedCards = allCards.filter(c => !idSet.has(c.id));
    } else {
      this._availableCards = allCards;
      this._lockedCards = [];
    }
  }

  // --- Read-only accessors ---

  get availableCards(): Card[] { return this._availableCards; }
  get lockedCards(): Card[] { return this._lockedCards; }
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
      lockedCards: [...this._lockedCards],
      selectedCard: this._selectedCard,
      canFight: this.canFight,
    };
  }

  // --- Actions ---

  /**
   * Select a card for combat. Selecting the same card again deselects it.
   */
  selectCard(card: Card): void {
    // Prevent selecting locked cards
    if (this._lockedCards.some(c => c.id === card.id)) return;

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
