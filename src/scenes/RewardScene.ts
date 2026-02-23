import { Container, Text } from 'pixi.js';
import type { Scene } from '@engine/SceneManager.ts';
import type { GameStateManager } from '@engine/GameStateManager.ts';
import type { InputManager } from '@/input/InputManager.ts';
import type { UnlockResult } from '@/core/MetaProgression.ts';
import { ButtonSprite } from '@/sprites/ButtonSprite.ts';
import { colors, fonts, spacing } from '@/theme.ts';
import { getLayout } from '@/layout.ts';

export interface RewardData {
  runDurationSeconds: number;
  unlocks: UnlockResult[];
}

/**
 * Victory screen (v5): shows run summary + any new unlocks.
 */
export function createRewardScene(game: GameStateManager, input: InputManager): Scene {
  const root = new Container() as Scene;
  root.label = 'reward';

  let sw = 800, sh = 600;

  // Title
  const titleText = new Text({
    text: 'Run Complete!',
    style: { fontFamily: fonts.heading, fontSize: fonts.sizes.h1, fontWeight: 'bold', fill: colors.focus },
  });
  titleText.anchor.set(0.5, 0);
  root.addChild(titleText);

  // Duration
  const durationText = new Text({
    text: '',
    style: { fontFamily: fonts.body, fontSize: fonts.sizes.body, fill: colors.text },
  });
  durationText.anchor.set(0.5, 0);
  root.addChild(durationText);

  // Unlock info
  const unlockText = new Text({
    text: '',
    style: { fontFamily: fonts.heading, fontSize: fonts.sizes.h3, fontWeight: 'bold', fill: colors.focus },
  });
  unlockText.anchor.set(0.5, 0);
  root.addChild(unlockText);

  // Continue button
  const continueBtn = new ButtonSprite('Continue', { width: 180 });
  continueBtn.onPress = () => game.handleRewardContinue();
  root.addChild(continueBtn);

  // Focus indicator overlay
  root.addChild(input.focusIndicator);

  // --- Helpers ---

  function formatDuration(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  }

  function buildUnlockText(unlocks: UnlockResult[]): void {
    const survivors = unlocks.filter(u => u.type === 'survivor');
    const modifiers = unlocks.filter(u => u.type === 'diceModifier');
    const lines: string[] = [];

    for (const s of survivors) {
      lines.push(`New survivor unlocked: ${s.name}!`);
    }
    for (const m of modifiers) {
      lines.push(`New die unlocked: ${m.name}!`);
    }
    if (lines.length === 0) {
      lines.push('All survivors unlocked');
    }

    unlockText.text = lines.join('\n');
  }

  function layout(): void {
    const rl = getLayout(sw, sh);
    const cx = sw / 2;

    titleText.style.fontSize = rl.fontSize.h1;
    durationText.style.fontSize = rl.fontSize.body;
    unlockText.style.fontSize = rl.fontSize.h3;

    const titleY = sh * 0.2;
    titleText.position.set(cx, titleY);

    const durY = titleY + rl.fontSize.h1 + spacing.lg;
    durationText.position.set(cx, durY);

    const unlockY = durY + rl.fontSize.body + spacing.xl;
    unlockText.position.set(cx, unlockY);

    continueBtn.position.set(
      cx - continueBtn.buttonWidth / 2,
      sh - sh * 0.15,
    );
  }

  // --- Scene lifecycle ---

  root.onEnter = (data?: unknown) => {
    const d = data as RewardData | undefined;

    durationText.text = d ? formatDuration(d.runDurationSeconds) : '';
    buildUnlockText(d?.unlocks ?? []);

    input.unregisterAll();
    input.register({
      id: 'reward-continue',
      container: continueBtn,
      onActivate: () => game.handleRewardContinue(),
    });

    layout();
  };

  root.onExit = () => {
    input.unregisterAll();
  };

  root.onResize = (w: number, h: number) => {
    sw = w; sh = h;
    layout();
  };

  return root;
}
