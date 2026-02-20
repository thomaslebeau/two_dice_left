import { Application } from 'pixi.js';
import { SceneManager } from '@engine/SceneManager.ts';
import { GameStateManager } from '@engine/GameStateManager.ts';
import type { GameStateSnapshot } from '@engine/GameStateManager.ts';
import { InputManager } from '@/input/InputManager.ts';
import { GameState } from '@enums/GameState.enum';
import { colors } from './theme.ts';

import { createMainMenuScene } from '@/scenes/MainMenuScene.ts';
import { createCardSelectionScene } from '@/scenes/CardSelectionScene.ts';
import { createCombatScene } from '@/scenes/CombatScene.ts';
import { createRewardScene } from '@/scenes/RewardScene.ts';
import { createGameOverScene } from '@/scenes/GameOverScene.ts';

async function main() {
  // Wait for web fonts before creating any Pixi text
  await document.fonts.ready;

  const app = new Application();
  await app.init({
    background: colors.background,
    resizeTo: window,
    antialias: true,
  });
  document.body.appendChild(app.canvas);

  const game = new GameStateManager();
  const input = new InputManager();
  const scenes = new SceneManager(app);

  // Register all scenes
  scenes.register(GameState.MENU, createMainMenuScene(game, input));
  scenes.register(GameState.CARD_SELECTION, createCardSelectionScene(game, input));
  scenes.register(GameState.COMBAT, createCombatScene(game, input));
  scenes.register(GameState.REWARD, createRewardScene(game, input));
  scenes.register(GameState.GAMEOVER, createGameOverScene(game, input));

  // Wire game state changes to scene transitions with appropriate data
  game.onChange((snap: GameStateSnapshot) => {
    switch (snap.gameState) {
      case GameState.MENU:
        scenes.switchTo(GameState.MENU);
        break;

      case GameState.CARD_SELECTION:
        scenes.switchTo(GameState.CARD_SELECTION, {
          collection: snap.collection,
        });
        break;

      case GameState.COMBAT:
        scenes.switchTo(GameState.COMBAT, {
          playerCard: snap.playerCard,
          enemyCard: snap.enemyCard,
          combatNumber: snap.currentCombat,
        });
        break;

      case GameState.REWARD:
        scenes.switchTo(GameState.REWARD, {
          combatNumber: snap.currentCombat,
        });
        break;

      case GameState.GAMEOVER:
        scenes.switchTo(GameState.GAMEOVER, {
          victory: snap.victory ?? false,
          combatNumber: snap.currentCombat,
        });
        break;
    }
  });

  // Start on the menu
  scenes.switchTo(GameState.MENU);
}

main();
