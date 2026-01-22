import React, { useState } from "react";
import { useFocusable } from "@/external_lib";
import type { DeckManagementScreenProps } from "../types/deckManagement.types";
import { CardDisplay } from "@shared/components/CardDisplay/CardDisplay";
import { RARITY_COLORS, CARD_DATABASE } from "@shared/constants/cards";
import type { Card } from "@/types/card.types";
import styles from "./DeckManagementScreen.module.scss";

export const DeckManagementScreen: React.FC<DeckManagementScreenProps> = ({
  currentDeck,
  onContinue,
  onModifyDeck,
  combatNumber,
}) => {
  // Generate 3 random reward cards once on mount
  const [rewardCards] = useState<Card[]>(() => {
    const shuffled = [...CARD_DATABASE].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 3).map((card) => ({
      ...card,
      currentHp: card.maxHp,
    }));
  });

  const [selectedRewardCard, setSelectedRewardCard] = useState<Card | null>(null);

  // Count alive cards in current deck
  const aliveCards = currentDeck.filter(c => !c.isDead);
  const hasMaxCards = aliveCards.length >= 5;

  // Bouton Continuer (disabled if deck is full)
  const continueButton = useFocusable({
    id: "deck-management-continue",
    onActivate: () => selectedRewardCard && !hasMaxCards && onContinue(selectedRewardCard),
    disabled: !selectedRewardCard || hasMaxCards,
    priority: 100,
  });

  // Bouton Modifier mon deck
  const modifyDeckButton = useFocusable({
    id: "deck-management-modify",
    onActivate: () => selectedRewardCard && onModifyDeck(selectedRewardCard),
    disabled: !selectedRewardCard,
    priority: 100,
  });

  return (
    <div className={styles.container}>
      {/* Header */}
      <h2 className={styles.header}>🎉 Victoire ! 🎉</h2>
      <p className={styles.subheader}>Combat {combatNumber} terminé</p>

      {/* Reward Cards Section */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>
          Choisissez votre récompense
        </h3>
        <p className={styles.sectionInstructions}>
          Sélectionnez 1 carte parmi les 3 proposées
        </p>
        <div className={styles.rewardGrid}>
          {rewardCards.map((card, index) => (
            <RewardCard
              key={card.id}
              card={card}
              onSelect={() => setSelectedRewardCard(card)}
              isSelected={selectedRewardCard?.id === card.id}
              autoFocus={index === 0}
            />
          ))}
        </div>
      </section>

      {/* Info message if deck is full */}
      {hasMaxCards && (
        <div className={styles.infoMessage}>
          ⚠️ Votre deck est complet (5 cartes vivantes). Utilisez "Modifier mon deck" pour ajouter cette carte.
        </div>
      )}

      {/* Action Buttons */}
      <div className={styles.buttonGroup}>
        <button
          {...continueButton.focusProps}
          onClick={() => selectedRewardCard && !hasMaxCards && onContinue(selectedRewardCard)}
          className={`${styles.actionButton} ${styles.continueButton} ${
            !selectedRewardCard || hasMaxCards ? styles.disabled : ""
          } ${continueButton.isFocused ? styles.focused : ""}`}
          disabled={!selectedRewardCard || hasMaxCards}
          aria-label="Continuer avec la carte sélectionnée"
        >
          Continuer
        </button>

        <button
          {...modifyDeckButton.focusProps}
          onClick={() => selectedRewardCard && onModifyDeck(selectedRewardCard)}
          className={`${styles.actionButton} ${styles.modifyButton} ${
            !selectedRewardCard ? styles.disabled : ""
          } ${modifyDeckButton.isFocused ? styles.focused : ""}`}
          disabled={!selectedRewardCard}
          aria-label="Modifier mon deck avec la carte sélectionnée"
        >
          Modifier mon deck
        </button>
      </div>
    </div>
  );
};

// ==================== SUB-COMPONENTS ====================

/**
 * Reward Card
 */
interface RewardCardProps {
  card: Card;
  onSelect: () => void;
  isSelected: boolean;
  autoFocus?: boolean;
}

const RewardCard: React.FC<RewardCardProps> = ({
  card,
  onSelect,
  isSelected,
  autoFocus,
}) => {
  const cardFocus = useFocusable({
    id: `reward-card-${card.id}`,
    group: "reward-cards",
    onActivate: onSelect,
    autoFocus,
  });

  const rarityColor = RARITY_COLORS[card.rarity];

  return (
    <div
      {...cardFocus.focusProps}
      className={`${styles.rewardCard} ${isSelected ? styles.selected : ""} ${
        cardFocus.isFocused ? styles.focused : ""
      }`}
      style={{ borderColor: isSelected ? "#00ff00" : rarityColor }}
      onClick={onSelect}
      aria-label={`${card.name} - ${card.currentHp} HP (Nouvelle carte) ${
        isSelected ? "(Sélectionnée)" : ""
      }`}
    >
      {isSelected && (
        <div className={styles.selectedBadge}>⭐ SÉLECTIONNÉE</div>
      )}
      <CardDisplay card={card} />
    </div>
  );
};
