import { Container, Text } from 'pixi.js';
import type { Scene } from '@engine/SceneManager.ts';
import type { GameStateManager } from '@engine/GameStateManager.ts';
import type { InputManager } from '@/input/InputManager.ts';
import { CardSelector } from '@engine/CardSelector.ts';
import type { Card } from '@/types/card.types';
import { CardSprite } from '@/sprites/CardSprite.ts';
import { ButtonSprite } from '@/sprites/ButtonSprite.ts';
import { colors, fonts, spacing } from '@/theme.ts';
import { getLayout } from '@/layout.ts';

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
    const rl = getLayout(sw, sh);
    const gap = rl.isMobile ? spacing.xs : spacing.md;

    for (const cs of cardSprites) {
      cs.scale.set(rl.cardScale);
    }

    if (rl.isMobile && cardSprites.length > 3) {
      // Wrap into 2 rows: top row gets ceil(n/2), bottom row gets the rest
      const topCount = Math.ceil(cardSprites.length / 2);
      const bottomCount = cardSprites.length - topCount;
      const rowGap = gap;

      // Top row
      const topW = topCount * rl.cardW + (topCount - 1) * gap;
      const topStartX = (sw - topW) / 2;
      const topY = sh / 2 - rl.cardH - rowGap / 2;

      for (let i = 0; i < topCount; i++) {
        cardSprites[i].position.set(topStartX + i * (rl.cardW + gap), topY);
      }

      // Bottom row
      const botW = bottomCount * rl.cardW + (bottomCount - 1) * gap;
      const botStartX = (sw - botW) / 2;
      const botY = sh / 2 + rowGap / 2;

      for (let i = 0; i < bottomCount; i++) {
        cardSprites[topCount + i].position.set(botStartX + i * (rl.cardW + gap), botY);
      }
    } else {
      // Single row
      const totalW = cardSprites.length * rl.cardW + (cardSprites.length - 1) * gap;
      const startX = (sw - totalW) / 2;
      const startY = sh / 2 - rl.cardH / 2 + 10;

      for (let i = 0; i < cardSprites.length; i++) {
        cardSprites[i].position.set(startX + i * (rl.cardW + gap), startY);
      }
    }
  }

  function layout() {
    const { fontScale } = getLayout(sw, sh);

    titleText.style.fontSize = fonts.sizes.h2 * fontScale;
    instructionText.style.fontSize = fonts.sizes.small * fontScale;

    titleText.position.set(sw / 2, spacing.lg);
    backBtn.position.set(spacing.lg, spacing.lg);
    fightBtn.position.set(sw - spacing.lg - fightBtn.buttonWidth, spacing.lg);

    instructionText.position.set(sw / 2, spacing.lg + 40 * fontScale);

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
