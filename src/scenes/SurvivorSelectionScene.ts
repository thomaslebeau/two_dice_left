import { Container, Text } from 'pixi.js';
import type { Scene } from '@engine/SceneManager.ts';
import type { GameStateManager } from '@engine/GameStateManager.ts';
import type { InputManager } from '@/input/InputManager.ts';
import { CardSelector } from '@engine/CardSelector.ts';
import type { Card } from '@/types/card.types';
import { CardSprite, CARD_WIDTH } from '@/sprites/CardSprite.ts';
import { ButtonSprite } from '@/sprites/ButtonSprite.ts';
import { colors, fonts, spacing } from '@/theme.ts';
import { getLayout } from '@/layout.ts';

/**
 * Survivor selection scene (v5): pick 1 card for the entire run.
 */
export function createSurvivorSelectionScene(game: GameStateManager, input: InputManager): Scene {
  const root = new Container() as Scene;
  root.label = 'survivor_selection';

  let selector: CardSelector | null = null;
  let unsubscribe: (() => void) | null = null;
  let sw = 800, sh = 600;

  // Header
  const titleText = new Text({
    text: 'Choose Your Survivor',
    style: { fontFamily: fonts.heading, fontSize: fonts.sizes.h2, fontWeight: 'bold', fill: colors.text },
  });
  titleText.anchor.set(0.5, 0);
  root.addChild(titleText);

  const instructionText = new Text({
    text: 'Select your survivor for this run',
    style: { fontFamily: fonts.body, fontSize: fonts.sizes.small, fill: colors.text },
  });
  instructionText.anchor.set(0.5, 0);
  instructionText.alpha = 0.6;
  root.addChild(instructionText);

  // Buttons
  const backBtn = new ButtonSprite('Menu', { width: 100 });
  backBtn.onPress = () => game.handleBackToMenu();
  root.addChild(backBtn);

  const fightBtn = new ButtonSprite('Begin Run!', { width: 160 });
  fightBtn.onPress = () => {
    if (selector?.canFight && selector.selectedCard) {
      game.handleSurvivorChosen(selector.selectedCard);
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
      id: 'survivor-select-back',
      container: backBtn,
      onActivate: () => game.handleBackToMenu(),
    });
    input.register({
      id: 'survivor-select-fight',
      container: fightBtn,
      disabled: !selector?.canFight,
      onActivate: () => {
        if (selector?.canFight && selector.selectedCard) {
          game.handleSurvivorChosen(selector.selectedCard);
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
    const n = cardSprites.length;
    if (n === 0) return;

    const rl = getLayout(sw, sh);
    const gap = rl.isMobile ? spacing.xs : spacing.md;

    // Top area reserved for title/buttons
    const topReserved = sh * 0.18;
    // Bottom margin
    const bottomMargin = sh * 0.05;
    // Available height for cards
    const availH = sh - topReserved - bottomMargin;

    const CARD_HEIGHT = 230;
    const fitScaleH = availH * 0.85 / CARD_HEIGHT;

    let cardScale: number;
    if (n === 1) {
      // Single card: fill ~70% of screen width, up to 2x
      cardScale = Math.min(2.0, (sw * 0.7) / CARD_WIDTH, fitScaleH);
    } else {
      // Multiple cards: fit N cards horizontally, allow up to 1.5x on mobile
      const margin = spacing.lg * 2;
      const fitScaleW = (sw - margin - (n - 1) * gap) / (n * CARD_WIDTH);
      const maxScale = rl.isMobile ? 1.5 : 1.0;
      cardScale = Math.min(rl.cardScale, Math.max(0.5, fitScaleW), fitScaleH, maxScale);
    }

    const cardW = CARD_WIDTH * cardScale;
    const cardH = CARD_HEIGHT * cardScale;

    for (const cs of cardSprites) {
      cs.scale.set(cardScale);
    }

    if (rl.isMobile && n > 3) {
      // Wrap into 2 rows
      const topCount = Math.ceil(n / 2);
      const bottomCount = n - topCount;
      const rowGap = gap;

      const centerY = topReserved + availH / 2;

      // Top row
      const topW = topCount * cardW + (topCount - 1) * gap;
      const topStartX = (sw - topW) / 2;
      const topY = centerY - cardH - rowGap / 2;

      for (let i = 0; i < topCount; i++) {
        cardSprites[i].position.set(topStartX + i * (cardW + gap), topY);
      }

      // Bottom row
      const botW = bottomCount * cardW + (bottomCount - 1) * gap;
      const botStartX = (sw - botW) / 2;
      const botY = centerY + rowGap / 2;

      for (let i = 0; i < bottomCount; i++) {
        cardSprites[topCount + i].position.set(botStartX + i * (cardW + gap), botY);
      }
    } else {
      // Single row — centered in available area
      const totalW = n * cardW + (n - 1) * gap;
      const startX = (sw - totalW) / 2;
      const startY = topReserved + (availH - cardH) / 2;

      for (let i = 0; i < n; i++) {
        cardSprites[i].position.set(startX + i * (cardW + gap), startY);
      }
    }
  }

  function layout() {
    const rl = getLayout(sw, sh);

    titleText.style.fontSize = rl.fontSize.h2;
    instructionText.style.fontSize = rl.fontSize.small;

    // Buttons: top row
    backBtn.position.set(16, 16);
    fightBtn.position.set(sw - 16 - fightBtn.buttonWidth, 16);

    // Title below buttons
    titleText.position.set(sw / 2, 70);

    // Instruction below title
    instructionText.position.set(sw / 2, 70 + titleText.height + 8);

    layoutCards();
  }

  // -- Scene lifecycle --

  root.onEnter = () => {
    selector = new CardSelector(game.unlockedSurvivorIds);

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
