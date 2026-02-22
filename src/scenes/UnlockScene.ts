import { Container, Text } from 'pixi.js';
import type { Scene } from '@engine/SceneManager.ts';
import type { GameStateManager } from '@engine/GameStateManager.ts';
import type { InputManager } from '@/input/InputManager.ts';
import type { UnlockResult } from '@/core/MetaProgression.ts';
import type { Card } from '@/types/card.types';
import { CARD_DATABASE } from '@shared/constants/cards';
import { CardSprite } from '@/sprites/CardSprite.ts';
import { ButtonSprite } from '@/sprites/ButtonSprite.ts';
import { colors, fonts, spacing } from '@/theme.ts';
import { getLayout } from '@/layout.ts';

export interface UnlockData {
  unlocks: UnlockResult[];
}

/**
 * Unlock notification scene — shown after a run when new items are unlocked.
 */
export function createUnlockScene(game: GameStateManager, input: InputManager): Scene {
  const root = new Container() as Scene;
  root.label = 'unlock';

  let sw = 800, sh = 600;
  const unlockSprites: CardSprite[] = [];

  // Title
  const titleText = new Text({
    text: 'NEW UNLOCK!',
    style: {
      fontFamily: fonts.heading,
      fontSize: fonts.sizes.h1,
      fontWeight: 'bold',
      fill: colors.focus,
    },
  });
  titleText.anchor.set(0.5, 0);
  root.addChild(titleText);

  // Unlock items container
  const itemsContainer = new Container();
  root.addChild(itemsContainer);

  // Continue button
  const continueBtn = new ButtonSprite('Continue', { width: 180 });
  continueBtn.onPress = () => game.handleUnlockDismissed();
  root.addChild(continueBtn);

  // Focus indicator overlay
  root.addChild(input.focusIndicator);

  // --- Helpers ---

  function clearItems() {
    for (const cs of unlockSprites) {
      itemsContainer.removeChild(cs);
      cs.destroy();
    }
    unlockSprites.length = 0;
    // Remove all text children from itemsContainer
    while (itemsContainer.children.length > 0) {
      const child = itemsContainer.children[0];
      itemsContainer.removeChild(child);
      child.destroy();
    }
  }

  function buildItems(unlocks: UnlockResult[]) {
    clearItems();

    let yOff = 0;
    const cx = sw / 2;
    const rl = getLayout(sw, sh);
    const cardDisplayScale = Math.min(1.0, (sw * 0.5) / 160);

    for (const unlock of unlocks) {
      if (unlock.type === 'survivor') {
        // Find the card data and create a CardSprite
        const cardBase = CARD_DATABASE.find(c => c.id === unlock.id);
        if (cardBase) {
          const card: Card = { ...cardBase, currentHp: cardBase.maxHp };
          const cs = new CardSprite(card);
          cs.scale.set(cardDisplayScale);
          cs.position.set(cx - (160 * cardDisplayScale) / 2, yOff);
          unlockSprites.push(cs);
          itemsContainer.addChild(cs);
          yOff += 230 * cardDisplayScale + spacing.sm;
        }

        // Name + description text
        const nameText = new Text({
          text: unlock.name,
          style: {
            fontFamily: fonts.heading,
            fontSize: rl.fontSize.h3,
            fontWeight: 'bold',
            fill: colors.focus,
          },
        });
        nameText.anchor.set(0.5, 0);
        nameText.position.set(cx, yOff);
        itemsContainer.addChild(nameText);
        yOff += nameText.height + spacing.xs;

        const descText = new Text({
          text: unlock.description,
          style: {
            fontFamily: fonts.body,
            fontSize: rl.fontSize.body,
            fill: colors.text,
          },
        });
        descText.anchor.set(0.5, 0);
        descText.position.set(cx, yOff);
        itemsContainer.addChild(descText);
        yOff += descText.height + spacing.lg;
      } else {
        // Dice modifier unlock — gold accent text
        const modNameText = new Text({
          text: unlock.name,
          style: {
            fontFamily: fonts.heading,
            fontSize: rl.fontSize.h3,
            fontWeight: 'bold',
            fill: 0xD4A030,
          },
        });
        modNameText.anchor.set(0.5, 0);
        modNameText.position.set(cx, yOff);
        itemsContainer.addChild(modNameText);
        yOff += modNameText.height + spacing.xs;

        const modDescText = new Text({
          text: unlock.description,
          style: {
            fontFamily: fonts.body,
            fontSize: rl.fontSize.body,
            fill: colors.text,
          },
        });
        modDescText.anchor.set(0.5, 0);
        modDescText.position.set(cx, yOff);
        itemsContainer.addChild(modDescText);
        yOff += modDescText.height + spacing.lg;
      }
    }
  }

  function layout() {
    const rl = getLayout(sw, sh);

    titleText.style.fontSize = rl.fontSize.h1;
    titleText.position.set(sw / 2, sh * 0.06);

    // Center items container vertically
    const titleBottom = sh * 0.06 + titleText.height + spacing.lg;
    const btnTop = sh - sh * 0.08 - continueBtn.buttonHeight;
    const availableH = btnTop - titleBottom;
    const itemsH = itemsContainer.height;
    const itemsY = titleBottom + Math.max(0, (availableH - itemsH) / 2);
    itemsContainer.position.set(0, itemsY);

    continueBtn.position.set(
      sw / 2 - continueBtn.buttonWidth / 2,
      btnTop,
    );
  }

  // --- Scene lifecycle ---

  root.onEnter = (data?: unknown) => {
    const d = data as UnlockData | undefined;
    const unlocks = d?.unlocks ?? [];

    input.unregisterAll();
    input.register({
      id: 'unlock-continue',
      container: continueBtn,
      onActivate: () => game.handleUnlockDismissed(),
    });

    buildItems(unlocks);
    layout();
  };

  root.onExit = () => {
    input.unregisterAll();
    clearItems();
  };

  root.onResize = (w: number, h: number) => {
    sw = w; sh = h;
    layout();
  };

  return root;
}
