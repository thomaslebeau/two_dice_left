import { describe, it, expect } from 'vitest';
import { CardSelector } from '../CardSelector';
import { CARD_DATABASE } from '@shared/constants/cards';

describe('CardSelector', () => {
  describe('no args (backward-compatible)', () => {
    it('has all 8 cards available', () => {
      const selector = new CardSelector();
      expect(selector.availableCards.length).toBe(CARD_DATABASE.length);
    });

    it('has 0 locked cards', () => {
      const selector = new CardSelector();
      expect(selector.lockedCards.length).toBe(0);
    });

    it('snapshot includes lockedCards as empty array', () => {
      const selector = new CardSelector();
      expect(selector.snapshot().lockedCards).toEqual([]);
    });
  });

  describe('with unlockedIds', () => {
    it('partitions cards correctly', () => {
      const selector = new CardSelector([1, 2, 3]);
      expect(selector.availableCards.length).toBe(3);
      expect(selector.lockedCards.length).toBe(CARD_DATABASE.length - 3);
    });

    it('available cards have correct IDs', () => {
      const selector = new CardSelector([1, 2, 3]);
      const ids = selector.availableCards.map(c => c.id);
      expect(ids).toEqual([1, 2, 3]);
    });

    it('locked cards have correct IDs', () => {
      const selector = new CardSelector([1, 2, 3]);
      const ids = selector.lockedCards.map(c => c.id);
      expect(ids).toEqual([4, 5, 6, 7, 8]);
    });

    it('snapshot includes lockedCards', () => {
      const selector = new CardSelector([1, 2, 3]);
      const snap = selector.snapshot();
      expect(snap.lockedCards.length).toBe(CARD_DATABASE.length - 3);
    });
  });

  describe('selectCard with locked cards', () => {
    it('cannot select a locked card', () => {
      const selector = new CardSelector([1, 2, 3]);
      const lockedCard = selector.lockedCards[0]; // ID 4
      selector.selectCard(lockedCard);
      expect(selector.selectedCard).toBeNull();
    });

    it('can select an available card', () => {
      const selector = new CardSelector([1, 2, 3]);
      const availableCard = selector.availableCards[0]; // ID 1
      selector.selectCard(availableCard);
      expect(selector.selectedCard?.id).toBe(1);
    });

    it('toggle selection on available card', () => {
      const selector = new CardSelector([1, 2, 3]);
      const card = selector.availableCards[0];
      selector.selectCard(card);
      expect(selector.selectedCard?.id).toBe(card.id);
      selector.selectCard(card);
      expect(selector.selectedCard).toBeNull();
    });
  });
});
