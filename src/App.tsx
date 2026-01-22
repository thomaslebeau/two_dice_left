import React from "react";
// import { FocusProvider } from "./external_lib";
import { FocusProvider } from "./external_lib";
import "./external_lib/index.css";

import { GameState } from "@enums/GameState.enum";
import { MAX_COMBATS } from "@shared/constants/cards";
import { useGameState } from "@core/hooks/useGameState";

import { MainMenu } from "@features/menu/components/MainMenu";
import { DeckSelectionScreen } from "@features/deckSelection/components/DeckSelectionScreen";
import { CombatScreen } from "@features/combat/components/CombatScreen";
import { DeckManagementScreen } from "@features/deckManagement/components/DeckManagementScreen";
import { GameOverScreen } from "@features/gameOver/components/GameOverScreen";

import "@styles/globals.scss";
import styles from "./App.module.scss";

/**
 * Main application component
 * Manages routing between game screens based on game state
 */
const App: React.FC = () => {
  const {
    gameState,
    currentCombat,
    enemyCard,
    playerDeck,
    rewardCard,
    startNewRun,
    handleDeckConfirmed,
    handleCombatEnd,
    handleRewardContinue,
    handleRewardModifyDeck,
    handleBackToMenu,
    handleCardUpdate,
  } = useGameState();

  return (
    <FocusProvider
      enableHapticFeedback={true}
      navigationMode="spatial"
      joystickDeadzone={0.5}
      navigationDelay={150}
    >
      <div className={styles.gameScreen}>
        {gameState === GameState.MENU && (
          <h1 className={styles.title}>Dice and Card</h1>
        )}

        {gameState === GameState.MENU && <MainMenu startNewRun={startNewRun} />}

        {gameState === GameState.DECK_SELECTION && (
          <DeckSelectionScreen
            onDeckConfirmed={handleDeckConfirmed}
            onBackToMenu={handleBackToMenu}
            rewardCard={rewardCard || undefined}
            currentDeck={playerDeck.length > 0 ? playerDeck : undefined}
          />
        )}

        {gameState === GameState.COMBAT && playerDeck.length > 0 && enemyCard && (
          <CombatScreen
            playerDeck={playerDeck}
            enemyCard={enemyCard}
            onCombatEnd={handleCombatEnd}
            onCardUpdate={handleCardUpdate}
            combatNumber={currentCombat}
          />
        )}

        {gameState === GameState.REWARD && playerDeck && (
          <DeckManagementScreen
            currentDeck={playerDeck}
            onContinue={handleRewardContinue}
            onModifyDeck={handleRewardModifyDeck}
            combatNumber={currentCombat}
          />
        )}

        {gameState === GameState.GAMEOVER && (
          <GameOverScreen
            victory={currentCombat > MAX_COMBATS}
            combatNumber={currentCombat}
            onBackToMenu={handleBackToMenu}
          />
        )}
      </div>
    </FocusProvider>
  );
};

export default App;
