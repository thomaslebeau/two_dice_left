import { Container, Text } from 'pixi.js';
import type { Scene } from '@engine/SceneManager.ts';
import type { GameStateManager } from '@engine/GameStateManager.ts';
import type { InputManager } from '@/input/InputManager.ts';
import type { Card } from '@/types/card.types';
import { generateRewardCards } from '@shared/utils/rewardGenerator';
import { CardSprite, CARD_WIDTH } from '@/sprites/CardSprite.ts';
import { ButtonSprite } from '@/sprites/ButtonSprite.ts';
import { colors, fonts, spacing } from '@/theme.ts';
import { getLayout } from '@/layout.ts';

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
    text: 'Select a reward card, or skip',
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
    const rl = getLayout(sw, sh);
    const n = rewardSprites.length;

    titleText.style.fontSize = rl.fontSize.h1;
    subText.style.fontSize = rl.fontSize.body;
    instructionText.style.fontSize = rl.fontSize.small;

    // Header at top
    const titleY = sh * 0.04;
    titleText.position.set(sw / 2, titleY);
    subText.position.set(sw / 2, titleY + rl.fontSize.h1 + spacing.xs);
    instructionText.position.set(sw / 2, titleY + rl.fontSize.h1 + rl.fontSize.body + spacing.sm);

    // Cards — scaled to fit, allow bigger on mobile
    const gap = rl.isMobile ? spacing.xs : spacing.lg;
    const margin = spacing.lg * 2;
    const fitScale = n > 0 ? (sw - margin - (n - 1) * gap) / (n * CARD_WIDTH) : rl.cardScale;
    const maxScale = rl.isMobile ? 1.5 : 1.0;
    const cardScale = Math.min(Math.max(0.5, fitScale), maxScale);
    const cardW = CARD_WIDTH * cardScale;
    const CARD_HEIGHT = 230;
    const cardH = CARD_HEIGHT * cardScale;

    for (const cs of rewardSprites) {
      cs.scale.set(cardScale);
    }

    const totalW = n * cardW + (n - 1) * gap;
    const startX = (sw - totalW) / 2;
    // Center cards in middle zone
    const topReserved = sh * 0.18;
    const bottomReserved = sh * 0.15;
    const cardY = topReserved + (sh - topReserved - bottomReserved - cardH) / 2;

    for (let i = 0; i < n; i++) {
      rewardSprites[i].position.set(startX + i * (cardW + gap), cardY);
    }

    // Buttons below cards
    const btnY = cardY + cardH + spacing.lg;
    const btnGap = spacing.lg;
    const totalBtnW = pickBtn.buttonWidth + skipBtn.buttonWidth + btnGap;
    pickBtn.position.set(sw / 2 - totalBtnW / 2, btnY);
    skipBtn.position.set(sw / 2 - totalBtnW / 2 + pickBtn.buttonWidth + btnGap, btnY);
  }

  // --- Scene lifecycle ---

  root.onEnter = () => {
    subText.text = 'Run complete!';
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
