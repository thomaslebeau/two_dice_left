import { Application } from 'pixi.js';
import { SceneManager } from '@engine/SceneManager.ts';
import { GameStateManager } from '@engine/GameStateManager.ts';
import type { GameStateSnapshot } from '@engine/GameStateManager.ts';
import { InputManager } from '@/input/InputManager.ts';
import { DatabaseManager } from '@/db/DatabaseManager.ts';
import { GameState } from '@enums/GameState.enum';
import { colors } from './theme.ts';

import { createMainMenuScene } from '@/scenes/MainMenuScene.ts';
import { createSurvivorSelectionScene } from '@/scenes/SurvivorSelectionScene.ts';
import { createCombatScene } from '@/scenes/CombatScene.ts';
import { createEventScene } from '@/scenes/EventScene.ts';
import { createRewardScene } from '@/scenes/RewardScene.ts';
import { createGameOverScene } from '@/scenes/GameOverScene.ts';
import { createUnlockScene } from '@/scenes/UnlockScene.ts';

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

  // Initialize combat logging database (non-blocking — game works without it)
  try {
    const dbManager = new DatabaseManager();
    await dbManager.init();
    game.setDatabase(dbManager);
    console.log('[CombatLog] Database initialized');
  } catch (err) {
    console.warn('[CombatLog] Database init failed, logging disabled:', err);
  }

  const input = new InputManager();
  const scenes = new SceneManager(app);

  // Register all scenes
  scenes.register(GameState.MENU, createMainMenuScene(game, input));
  scenes.register(GameState.SURVIVOR_SELECTION, createSurvivorSelectionScene(game, input));
  scenes.register(GameState.COMBAT, createCombatScene(game, input));
  scenes.register(GameState.EVENT, createEventScene(game, input));
  scenes.register(GameState.REWARD, createRewardScene(game, input));
  scenes.register(GameState.GAMEOVER, createGameOverScene(game, input));
  scenes.register(GameState.UNLOCK, createUnlockScene(game, input));

  // Wire game state changes to scene transitions with appropriate data
  game.onChange((snap: GameStateSnapshot) => {
    switch (snap.gameState) {
      case GameState.MENU:
        scenes.switchTo(GameState.MENU);
        break;

      case GameState.SURVIVOR_SELECTION:
        scenes.switchTo(GameState.SURVIVOR_SELECTION);
        break;

      case GameState.COMBAT:
        scenes.switchTo(GameState.COMBAT, {
          playerCard: snap.playerCard,
          enemyCard: snap.enemyCard,
          combatNumber: snap.currentCombat,
          eventAtkBonus: snap.atkBonus,
          eventDefBonus: snap.defBonus,
          diceModifiers: snap.diceModifiers,
        });
        break;

      case GameState.EVENT:
        scenes.switchTo(GameState.EVENT, {
          combatNumber: snap.currentCombat,
          currentEvent: snap.currentEvent,
          survivor: snap.survivor,
          atkBonus: snap.atkBonus,
          defBonus: snap.defBonus,
          diceModifiers: snap.diceModifiers,
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

      case GameState.UNLOCK:
        scenes.switchTo(GameState.UNLOCK, {
          unlocks: snap.pendingUnlocks,
        });
        break;
    }
  });

  // Start on the menu
  scenes.switchTo(GameState.MENU);
}

main();
