import { Container, Text } from 'pixi.js';
import type { Scene } from '@engine/SceneManager.ts';
import type { GameStateManager } from '@engine/GameStateManager.ts';
import type { InputManager } from '@/input/InputManager.ts';
import { ButtonSprite } from '@/sprites/ButtonSprite.ts';
import { VineBackground } from '@/sprites/VineBackground.ts';
import { colors, fonts } from '@/theme.ts';

/**
 * Main menu scene: vine background, title, subtitle, and start button.
 */
export function createMainMenuScene(game: GameStateManager, input: InputManager): Scene {
  const root = new Container() as Scene;
  root.label = 'menu';

  let sw = 800, sh = 600;

  // Vine background
  const vines = new VineBackground(sw, sh);
  root.addChild(vines);

  const title = new Text({
    text: 'Dice & Cards',
    style: {
      fontFamily: fonts.heading,
      fontSize: fonts.sizes.h1,
      fontWeight: 'bold',
      fill: colors.focus,
      align: 'center',
    },
  });
  title.anchor.set(0.5);
  root.addChild(title);

  const subtitle = new Text({
    text: '5 combats to win the run',
    style: {
      fontFamily: fonts.body,
      fontSize: fonts.sizes.body,
      fill: colors.text,
      align: 'center',
    },
  });
  subtitle.anchor.set(0.5);
  subtitle.alpha = 0.7;
  root.addChild(subtitle);

  const startBtn = new ButtonSprite('Start New Run', {
    width: 240,
    fontSize: fonts.sizes.h3,
  });
  startBtn.onPress = () => game.startNewRun();
  root.addChild(startBtn);

  // Focus indicator overlay (on top of everything)
  root.addChild(input.focusIndicator);

  function layout() {
    title.position.set(sw / 2, sh / 2 - 70);
    subtitle.position.set(sw / 2, sh / 2 - 20);
    startBtn.position.set(sw / 2 - startBtn.buttonWidth / 2, sh / 2 + 20);
  }

  root.onEnter = () => {
    input.unregisterAll();
    input.register({
      id: 'menu-start',
      container: startBtn,
      onActivate: () => game.startNewRun(),
    });
    layout();
  };

  root.onExit = () => {
    input.unregisterAll();
  };

  root.onUpdate = () => {
    vines.update();
  };

  root.onResize = (w: number, h: number) => {
    sw = w; sh = h;
    vines.resize(w, h);
    layout();
  };

  return root;
}
