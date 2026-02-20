import { Container, Text } from 'pixi.js';
import type { Scene } from '@engine/SceneManager.ts';
import type { GameStateManager } from '@engine/GameStateManager.ts';
import type { InputManager } from '@/input/InputManager.ts';
import type { Card } from '@/types/card.types';
import { generateRewardCards } from '@shared/utils/rewardGenerator';
import { CardSprite, CARD_WIDTH, CARD_HEIGHT } from '@/sprites/CardSprite.ts';
import { ButtonSprite } from '@/sprites/ButtonSprite.ts';
import { colors, fonts, spacing } from '@/theme.ts';

export interface RewardData {
  combatNumber: number;
}

/**
 * Reward scene (v2): pick 1 of 3 reward cards or skip.
 */
export function createRewardScene(game: GameStateManager, input: InputManager): Scene {
  const root = new Container() as Scene;
  root.label = 'reward';

  let sw = 800, sh = 600;
  let selectedReward: Card | null = null;
  const rewardSprites: CardSprite[] = [];

  // Header
  const titleText = new Text({
    text: 'Victory!',
    style: { fontFamily: fonts.heading, fontSize: fonts.sizes.h1, fontWeight: 'bold', fill: colors.focus },
  });
  titleText.anchor.set(0.5, 0);
  root.addChild(titleText);

  const subText = new Text({
    text: '',
    style: { fontFamily: fonts.body, fontSize: fonts.sizes.body, fill: colors.text },
  });
  subText.anchor.set(0.5, 0);
  root.addChild(subText);

  const instructionText = new Text({
    text: 'Select a card to add to your collection, or skip',
    style: { fontFamily: fonts.body, fontSize: fonts.sizes.small, fill: colors.text },
  });
  instructionText.anchor.set(0.5, 0);
  instructionText.alpha = 0.6;
  root.addChild(instructionText);

  // Card container
  const cardContainer = new Container();
  root.addChild(cardContainer);

  // Buttons
  const pickBtn = new ButtonSprite('Pick Card', { width: 160 });
  pickBtn.onPress = () => {
    if (selectedReward) game.handleRewardPicked(selectedReward);
  };
  pickBtn.setEnabled(false);
  root.addChild(pickBtn);

  const skipBtn = new ButtonSprite('Skip', { width: 120, color: colors.secondary });
  skipBtn.onPress = () => game.handleRewardSkipped();
  root.addChild(skipBtn);

  // Focus indicator overlay
  root.addChild(input.focusIndicator);

  // --- Helpers ---

  function registerFocusables() {
    input.unregisterAll();

    for (let i = 0; i < rewardSprites.length; i++) {
      const card = rewardSprites[i].card;
      input.register({
        id: `reward-card-${card.id}`,
        container: rewardSprites[i],
        onActivate: () => selectReward(card),
      });
    }

    input.register({
      id: 'reward-pick',
      container: pickBtn,
      disabled: selectedReward === null,
      onActivate: () => {
        if (selectedReward) game.handleRewardPicked(selectedReward);
      },
    });
    input.register({
      id: 'reward-skip',
      container: skipBtn,
      onActivate: () => game.handleRewardSkipped(),
    });
  }

  function buildRewardCards() {
    for (const cs of rewardSprites) {
      cardContainer.removeChild(cs);
      cs.destroy();
    }
    rewardSprites.length = 0;
    selectedReward = null;

    const rewards = generateRewardCards(3);
    for (const base of rewards) {
      const card: Card = { ...base, currentHp: base.maxHp };
      const cs = new CardSprite(card);
      cs.eventMode = 'static';
      cs.cursor = 'pointer';
      cs.on('pointerdown', () => selectReward(card));
      rewardSprites.push(cs);
      cardContainer.addChild(cs);
    }

    syncSelection();
    registerFocusables();
  }

  function selectReward(card: Card) {
    selectedReward = card;
    syncSelection();
  }

  function syncSelection() {
    for (const cs of rewardSprites) {
      const isSelected = selectedReward !== null && cs.card.id === selectedReward.id;
      cs.setSelected(isSelected, isSelected ? 1 : 0);
    }
    pickBtn.setEnabled(selectedReward !== null);
    registerFocusables();
  }

  function layout() {
    titleText.position.set(sw / 2, spacing.xl);
    subText.position.set(sw / 2, spacing.xl + 55);
    instructionText.position.set(sw / 2, spacing.xl + 80);

    // Cards
    const gap = spacing.lg;
    const totalW = rewardSprites.length * CARD_WIDTH + (rewardSprites.length - 1) * gap;
    const startX = (sw - totalW) / 2;
    const cardY = sh / 2 - CARD_HEIGHT / 2;

    for (let i = 0; i < rewardSprites.length; i++) {
      rewardSprites[i].position.set(startX + i * (CARD_WIDTH + gap), cardY);
    }

    // Buttons
    const btnY = sh / 2 + CARD_HEIGHT / 2 + spacing.xl;
    const btnGap = spacing.lg;
    const totalBtnW = pickBtn.buttonWidth + skipBtn.buttonWidth + btnGap;
    pickBtn.position.set(sw / 2 - totalBtnW / 2, btnY);
    skipBtn.position.set(sw / 2 - totalBtnW / 2 + pickBtn.buttonWidth + btnGap, btnY);
  }

  // --- Scene lifecycle ---

  root.onEnter = (data?: unknown) => {
    const d = data as RewardData | undefined;
    subText.text = `Combat ${d?.combatNumber ?? '?'} complete`;
    buildRewardCards();
    layout();
  };

  root.onExit = () => {
    input.unregisterAll();
    selectedReward = null;
  };

  root.onResize = (w: number, h: number) => {
    sw = w; sh = h;
    layout();
  };

  return root;
}
