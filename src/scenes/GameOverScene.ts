import { Container, Text } from 'pixi.js';
import type { Scene } from '@engine/SceneManager.ts';
import type { GameStateManager } from '@engine/GameStateManager.ts';
import type { InputManager } from '@/input/InputManager.ts';
import { ButtonSprite } from '@/sprites/ButtonSprite.ts';
import { colors, fonts, spacing } from '@/theme.ts';

export interface GameOverData {
  victory: boolean;
  combatNumber: number;
}

/**
 * Game over scene showing victory/defeat and a back-to-menu button.
 */
export function createGameOverScene(game: GameStateManager, input: InputManager): Scene {
  const root = new Container() as Scene;
  root.label = 'gameover';

  const titleText = new Text({
    text: '',
    style: {
      fontFamily: fonts.heading,
      fontSize: fonts.sizes.h1,
      fontWeight: 'bold',
      fill: colors.focus,
      align: 'center',
    },
  });
  titleText.anchor.set(0.5);
  root.addChild(titleText);

  const descText = new Text({
    text: '',
    style: {
      fontFamily: fonts.body,
      fontSize: fonts.sizes.h3,
      fill: colors.text,
      align: 'center',
      wordWrap: true,
      wordWrapWidth: 600,
    },
  });
  descText.anchor.set(0.5);
  root.addChild(descText);

  const menuBtn = new ButtonSprite('Back to Menu', { width: 220 });
  menuBtn.onPress = () => game.handleBackToMenu();
  root.addChild(menuBtn);

  // Focus indicator overlay
  root.addChild(input.focusIndicator);

  let sw = 800, sh = 600;

  root.onEnter = (data?: unknown) => {
    const d = data as GameOverData | undefined;
    const victory = d?.victory ?? false;
    const combatNum = d?.combatNumber ?? 0;

    titleText.text = victory ? 'TOTAL VICTORY!' : 'DEFEAT...';
    titleText.style.fill = victory ? colors.focus : colors.damage;

    descText.text = victory
      ? `Congratulations! You defeated all enemies in ${combatNum} combats!`
      : `You were defeated at combat ${combatNum}...`;

    input.unregisterAll();
    input.register({
      id: 'gameover-menu',
      container: menuBtn,
      onActivate: () => game.handleBackToMenu(),
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

  function layout() {
    titleText.position.set(sw / 2, sh / 2 - 60);
    descText.position.set(sw / 2, sh / 2);
    menuBtn.position.set(sw / 2 - menuBtn.buttonWidth / 2, sh / 2 + spacing.xxl);
  }

  return root;
}
