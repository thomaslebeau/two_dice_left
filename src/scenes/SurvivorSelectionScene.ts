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
import { CARD_HEIGHT } from '@/sprites/CardSprite.ts';

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
  const lockedSprites: CardSprite[] = [];
  const lockedOverlays: Text[] = [];

  function clearLockedSprites() {
    for (const cs of lockedSprites) {
      cardContainer.removeChild(cs);
      cs.destroy();
    }
    lockedSprites.length = 0;
    for (const t of lockedOverlays) {
      cardContainer.removeChild(t);
      t.destroy();
    }
    lockedOverlays.length = 0;
  }

  function buildCards() {
    for (const cs of cardSprites) {
      cardContainer.removeChild(cs);
      cs.destroy();
    }
    cardSprites.length = 0;
    clearLockedSprites();

    if (!selector) return;

    for (const card of selector.availableCards) {
      const cs = new CardSprite(card);
      cs.eventMode = 'static';
      cs.cursor = 'pointer';
      cs.on('pointerdown', () => onCardClick(card));
      cardSprites.push(cs);
      cardContainer.addChild(cs);
    }

    // Build locked cards (dimmed, non-interactive, with condition overlay)
    for (const card of selector.lockedCards) {
      const cs = new CardSprite(card);
      cs.alpha = 0.4;
      cs.eventMode = 'none';
      lockedSprites.push(cs);
      cardContainer.addChild(cs);

      const conditionText = game.metaProgression.getUnlockConditionText(card.id);
      const overlay = new Text({
        text: conditionText,
        style: {
          fontFamily: fonts.body,
          fontSize: fonts.sizes.small,
          fill: colors.focus,
          align: 'center',
          wordWrap: true,
          wordWrapWidth: 140,
        },
      });
      overlay.anchor.set(0.5);
      lockedOverlays.push(overlay);
      cardContainer.addChild(overlay);
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
    const rl = getLayout(sw, sh);
    const gap = rl.isMobile ? spacing.xs : spacing.md;

    // Combine all card sprites (unlocked + locked) for unified grid layout
    const allSprites = [...cardSprites, ...lockedSprites];

    for (const cs of allSprites) {
      cs.scale.set(rl.cardScale);
    }

    if (rl.isMobile && allSprites.length > 3) {
      // Wrap into 2 rows: top row gets ceil(n/2), bottom row gets the rest
      const topCount = Math.ceil(allSprites.length / 2);
      const bottomCount = allSprites.length - topCount;
      const rowGap = gap;

      // Top row
      const topW = topCount * rl.cardW + (topCount - 1) * gap;
      const topStartX = (sw - topW) / 2;
      const topY = sh / 2 - rl.cardH - rowGap / 2;

      for (let i = 0; i < topCount; i++) {
        allSprites[i].position.set(topStartX + i * (rl.cardW + gap), topY);
      }

      // Bottom row
      const botW = bottomCount * rl.cardW + (bottomCount - 1) * gap;
      const botStartX = (sw - botW) / 2;
      const botY = sh / 2 + rowGap / 2;

      for (let i = 0; i < bottomCount; i++) {
        allSprites[topCount + i].position.set(botStartX + i * (rl.cardW + gap), botY);
      }
    } else {
      // Single row
      const totalW = allSprites.length * rl.cardW + (allSprites.length - 1) * gap;
      const startX = (sw - totalW) / 2;
      const startY = sh / 2 - rl.cardH / 2 + 10;

      for (let i = 0; i < allSprites.length; i++) {
        allSprites[i].position.set(startX + i * (rl.cardW + gap), startY);
      }
    }

    // Position locked card overlay texts at the center of each locked card
    for (let i = 0; i < lockedSprites.length; i++) {
      const cs = lockedSprites[i];
      lockedOverlays[i].position.set(
        cs.x + (rl.cardW / 2),
        cs.y + (CARD_HEIGHT * rl.cardScale / 2),
      );
      lockedOverlays[i].scale.set(rl.cardScale);
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
    clearLockedSprites();
  };

  root.onResize = (w: number, h: number) => {
    sw = w; sh = h;
    layout();
  };

  return root;
}
