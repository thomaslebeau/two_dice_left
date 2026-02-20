import { Container, Text } from 'pixi.js';
import type { Scene } from '@engine/SceneManager.ts';
import type { GameStateManager } from '@engine/GameStateManager.ts';
import type { InputManager } from '@/input/InputManager.ts';
import { CardSelector } from '@engine/CardSelector.ts';
import type { Card } from '@/types/card.types';
import { CardSprite, CARD_WIDTH, CARD_HEIGHT } from '@/sprites/CardSprite.ts';
import { ButtonSprite } from '@/sprites/ButtonSprite.ts';
import { colors, fonts, spacing } from '@/theme.ts';

export interface CardSelectionData {
  collection: Card[];
}

/**
 * Card selection scene (v2): pick 1 card for the next combat.
 */
export function createCardSelectionScene(game: GameStateManager, input: InputManager): Scene {
  const root = new Container() as Scene;
  root.label = 'card_selection';

  let selector: CardSelector | null = null;
  let unsubscribe: (() => void) | null = null;
  let sw = 800, sh = 600;

  // Header
  const titleText = new Text({
    text: 'Choose Your Fighter',
    style: { fontFamily: fonts.heading, fontSize: fonts.sizes.h2, fontWeight: 'bold', fill: colors.text },
  });
  titleText.anchor.set(0.5, 0);
  root.addChild(titleText);

  const instructionText = new Text({
    text: 'Select a card for combat',
    style: { fontFamily: fonts.body, fontSize: fonts.sizes.small, fill: colors.text },
  });
  instructionText.anchor.set(0.5, 0);
  instructionText.alpha = 0.6;
  root.addChild(instructionText);

  // Buttons
  const backBtn = new ButtonSprite('Menu', { width: 100 });
  backBtn.onPress = () => game.handleBackToMenu();
  root.addChild(backBtn);

  const fightBtn = new ButtonSprite('Fight!', { width: 140 });
  fightBtn.onPress = () => {
    if (selector?.canFight && selector.selectedCard) {
      game.handleCardChosen(selector.selectedCard);
    }
  };
  fightBtn.setEnabled(false);
  root.addChild(fightBtn);

  // Card grid container
  const cardContainer = new Container();
  root.addChild(cardContainer);

  // Focus indicator overlay
  root.addChild(input.focusIndicator);

  // -- Internal helpers --

  const cardSprites: CardSprite[] = [];

  function buildCards() {
    for (const cs of cardSprites) {
      cardContainer.removeChild(cs);
      cs.destroy();
    }
    cardSprites.length = 0;

    if (!selector) return;

    for (const card of selector.availableCards) {
      const cs = new CardSprite(card);
      cs.eventMode = 'static';
      cs.cursor = 'pointer';
      cs.on('pointerdown', () => onCardClick(card));
      cardSprites.push(cs);
      cardContainer.addChild(cs);
    }

    syncSelection();
    layoutCards();
    registerFocusables();
  }

  function onCardClick(card: Card) {
    selector?.selectCard(card);
  }

  function registerFocusables() {
    input.unregisterAll();

    for (let i = 0; i < cardSprites.length; i++) {
      const card = selector?.availableCards[i];
      if (!card) continue;
      input.register({
        id: `card-${card.id}`,
        container: cardSprites[i],
        onActivate: () => onCardClick(card),
      });
    }

    input.register({
      id: 'card-select-back',
      container: backBtn,
      onActivate: () => game.handleBackToMenu(),
    });
    input.register({
      id: 'card-select-fight',
      container: fightBtn,
      disabled: !selector?.canFight,
      onActivate: () => {
        if (selector?.canFight && selector.selectedCard) {
          game.handleCardChosen(selector.selectedCard);
        }
      },
    });
  }

  function syncSelection() {
    if (!selector) return;

    for (const cs of cardSprites) {
      const isSelected = selector.isCardSelected(cs.card.id);
      cs.setSelected(isSelected, isSelected ? 1 : 0);
    }

    fightBtn.setEnabled(selector.canFight);

    // Re-register to update disabled states
    registerFocusables();
  }

  function layoutCards() {
    const gap = spacing.md;
    const totalW = cardSprites.length * CARD_WIDTH + (cardSprites.length - 1) * gap;
    const startX = (sw - totalW) / 2;
    const startY = sh / 2 - CARD_HEIGHT / 2 + 10;

    for (let i = 0; i < cardSprites.length; i++) {
      cardSprites[i].position.set(startX + i * (CARD_WIDTH + gap), startY);
    }
  }

  function layout() {
    titleText.position.set(sw / 2, spacing.lg);
    backBtn.position.set(spacing.lg, spacing.lg);
    fightBtn.position.set(sw - spacing.lg - fightBtn.buttonWidth, spacing.lg);

    instructionText.position.set(sw / 2, spacing.lg + 40);

    layoutCards();
  }

  // -- Scene lifecycle --

  root.onEnter = (data?: unknown) => {
    const d = data as CardSelectionData | undefined;

    selector = new CardSelector({
      collection: d?.collection ?? [],
    });

    unsubscribe = selector.onChange(() => syncSelection());
    buildCards();
    layout();
  };

  root.onExit = () => {
    input.unregisterAll();
    unsubscribe?.();
    unsubscribe = null;
    selector?.destroy();
    selector = null;
  };

  root.onResize = (w: number, h: number) => {
    sw = w; sh = h;
    layout();
  };

  return root;
}
