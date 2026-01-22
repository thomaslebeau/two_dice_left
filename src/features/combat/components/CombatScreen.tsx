import React, { useEffect, useState } from "react";
import type { Card, EnemyCard } from "@/types/card.types";
import type { CombatEndResult } from "@/types/combat.types";
import { useFocusable } from "@/external_lib";
import { CardDisplay } from "@shared/components/CardDisplay/CardDisplay";
import { DiceDisplay } from "@shared/components/DiceDisplay/DiceDisplay";
import { useCombatLogic } from "../hooks/useCombatLogic";
import styles from "./CombatScreen.module.scss";

interface CombatScreenProps {
  playerDeck: Card[];
  enemyCard: EnemyCard;
  onCombatEnd: (result: CombatEndResult) => void;
  onCardUpdate: (updatedCard: Card) => void;
  combatNumber: number;
}

/**
 * Combat screen with drag and drop card combat
 */
interface CombatWrapperProps {
  selectedCard: Card;
  enemyCard: EnemyCard;
  onCombatEnd: (result: CombatEndResult) => void;
  onCardUpdate: (updatedCard: Card) => void;
  combatNumber: number;
  onRoundResolved: (resolved: boolean) => void;
  onCombatFinished: (finished: boolean) => void;
}

const CombatWrapper: React.FC<CombatWrapperProps> = ({
  selectedCard,
  enemyCard,
  onCombatEnd,
  onCardUpdate,
  combatNumber,
  onRoundResolved,
  onCombatFinished,
}) => {
  const {
    roundNumber,
    diceKey,
    diceResults,
    showResults,
    roundResolved,
    combatFinished,
    currentPlayerCard,
    currentEnemyCard,
    combatResult,
    handleNextRound,
  } = useCombatLogic({
    playerCard: selectedCard,
    enemyCard,
    onCombatEnd,
    onCardUpdate
  });

  // Notify parent of state changes
  useEffect(() => {
    onRoundResolved(roundResolved);
  }, [roundResolved, onRoundResolved]);

  useEffect(() => {
    onCombatFinished(combatFinished);
  }, [combatFinished, onCombatFinished]);

  const nextRoundButton = useFocusable({
    id: "combat-next-round",
    onActivate: handleNextRound,
    disabled: !roundResolved || combatFinished,
  });

  useEffect(() => {
    if (roundResolved && !combatFinished) {
      nextRoundButton.focus();
    }
  }, [roundResolved, combatFinished, nextRoundButton]);

  return (
    <>
      <h2 className={styles.header}>
        ⚔️ Combat #{combatNumber} - Round {roundNumber} ⚔️
      </h2>

      <DiceDisplay results={diceResults} diceKey={diceKey} />

      {showResults && combatResult && (
        <div className={styles.combatResults}>
          <div className={styles.playerResults}>
            <div className={`${styles.playerSection} ${styles.player}`}>
              <h3>🎮 Votre Carte</h3>
              <div className={styles.diceResult}>
                🗡️ Attaque: {diceResults.playerAttack} +{" "}
                {currentPlayerCard.attackMod} = {combatResult.playerAttack}
              </div>
              <div className={styles.diceResult}>
                🛡️ Défense: {diceResults.playerDefense} +{" "}
                {currentPlayerCard.defenseMod} = {combatResult.playerDefense}
              </div>
              <div
                className={styles.damageText}
                style={{
                  color:
                    combatResult.damageToPlayer > 0 ? "#FF6B6B" : "#4ADE80",
                }}
              >
                {combatResult.damageToPlayer > 0
                  ? `💔 -${combatResult.damageToPlayer} HP`
                  : "✅ Aucun dégât"}
              </div>
            </div>

            <div className={`${styles.playerSection} ${styles.ia}`}>
              <h3>🤖 Ennemi</h3>
              <div className={styles.diceResult}>
                🗡️ Attaque: {diceResults.enemyAttack} +{" "}
                {currentEnemyCard.attackMod} = {combatResult.enemyAttack}
              </div>
              <div className={styles.diceResult}>
                🛡️ Défense: {diceResults.enemyDefense} +{" "}
                {currentEnemyCard.defenseMod} = {combatResult.enemyDefense}
              </div>
              <div
                className={styles.damageText}
                style={{
                  color: combatResult.damageToEnemy > 0 ? "#4ADE80" : "#FF6B6B",
                }}
              >
                {combatResult.damageToEnemy > 0
                  ? `💥 -${combatResult.damageToEnemy} HP`
                  : "🛡️ Bloqué"}
              </div>
            </div>
          </div>

          {roundResolved && !combatFinished && (
            <button
              {...nextRoundButton.focusProps}
              className={`${styles.nextRoundButton} ${
                nextRoundButton.isFocused ? styles.focused : ""
              }`}
            >
              ⚔️ Round Suivant
            </button>
          )}

          {combatFinished && (
            <div className={styles.finalResult}>
              {currentEnemyCard.currentHp <= 0
                ? "🎉 VICTOIRE !"
                : "💀 DÉFAITE..."}
            </div>
          )}
        </div>
      )}
    </>
  );
};

export const CombatScreen: React.FC<CombatScreenProps> = ({
  playerDeck,
  enemyCard,
  onCombatEnd,
  onCardUpdate,
  combatNumber,
}) => {
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [draggedCard, setDraggedCard] = useState<Card | null>(null);
  const [isDropZoneActive, setIsDropZoneActive] = useState(false);
  const [roundResolved, setRoundResolved] = useState(false);
  const [combatFinished, setCombatFinished] = useState(false);

  // Drag handlers
  const handleDragStart = (card: Card) => {
    if (!card.isDead) {
      setDraggedCard(card);
    }
  };

  const handleDragEnd = () => {
    setDraggedCard(null);
    setIsDropZoneActive(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (draggedCard && !combatFinished) {
      setIsDropZoneActive(true);
    }
  };

  const handleDragLeave = () => {
    setIsDropZoneActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDropZoneActive(false);

    if (draggedCard && !draggedCard.isDead && !combatFinished) {
      // First card selection or changing card for next round
      setSelectedCard(draggedCard);
    }
  };

  return (
    <div className={styles.container}>
      {/* Enemy card in the center */}
      <div
        className={`${styles.enemyZone} ${isDropZoneActive ? styles.dropZoneActive : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <CardDisplay card={enemyCard} isPlayer={false} />
        {isDropZoneActive && (
          <div className={styles.dropIndicator}>
            ⚔️ Déposez votre carte ici pour attaquer !
          </div>
        )}
        {!selectedCard && !isDropZoneActive && (
          <div className={styles.waitingIndicator}>
            👆 Glissez une carte pour commencer le combat
          </div>
        )}
        {selectedCard && roundResolved && !combatFinished && !isDropZoneActive && (
          <div className={styles.waitingIndicator}>
            👇 Glissez une carte pour continuer le combat
          </div>
        )}
      </div>

      {selectedCard && (
        <CombatWrapper
          key={selectedCard.id}
          selectedCard={selectedCard}
          enemyCard={enemyCard}
          onCombatEnd={onCombatEnd}
          onCardUpdate={onCardUpdate}
          combatNumber={combatNumber}
          onRoundResolved={setRoundResolved}
          onCombatFinished={setCombatFinished}
        />
      )}

      {/* Player deck at the bottom */}
      <div className={styles.playerDeck}>
        {playerDeck.map((card, index) => (
          <div
            key={`${card.id}-${index}`}
            className={`${styles.deckCard} ${card.isDead ? styles.deadCard : ''} ${draggedCard?.id === card.id ? styles.dragging : ''}`}
            draggable={!card.isDead}
            onDragStart={() => handleDragStart(card)}
            onDragEnd={handleDragEnd}
          >
            <CardDisplay card={card} isPlayer={true} isDead={card.isDead} />
          </div>
        ))}
      </div>
    </div>
  );
};
