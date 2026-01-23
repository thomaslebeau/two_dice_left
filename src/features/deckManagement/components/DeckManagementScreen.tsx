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
      quantity: 1,
    }));
  });

  const [selectedRewardCard, setSelectedRewardCard] = useState<Card | null>(null);

  // Helper to check if player already has a card
  const getCardInDeck = (cardId: number): Card | undefined => {
    return currentDeck?.find((c) => c.id === cardId);
  };

  // Bouton Continuer (always enabled - adds card if selected, continues without if not)
  const continueButton = useFocusable({
    id: "deck-management-continue",
    onActivate: () => onContinue(selectedRewardCard),
    priority: 100,
  });

  // Bouton Modifier mon deck (disabled if no card selected)
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
              existingCard={getCardInDeck(card.id)}
            />
          ))}
        </div>
      </section>

      {/* Action Buttons */}
      <div className={styles.buttonGroup}>
        <button
          {...continueButton.focusProps}
          onClick={() => onContinue(selectedRewardCard)}
          className={`${styles.actionButton} ${styles.continueButton} ${
            continueButton.isFocused ? styles.focused : ""
          }`}
          aria-label="Continuer (ajouter la carte si sélectionnée)"
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
  existingCard?: Card;
}

const RewardCard: React.FC<RewardCardProps> = ({
  card,
  onSelect,
  isSelected,
  autoFocus,
  existingCard,
}) => {
  const cardFocus = useFocusable({
    id: `reward-card-${card.id}`,
    group: "reward-cards",
    onActivate: onSelect,
    autoFocus,
  });

  const rarityColor = RARITY_COLORS[card.rarity];
  const isDuplicate = !!existingCard;
  const newQuantity = existingCard ? (existingCard.quantity || 1) + 1 : 1;

  return (
    <div
      {...cardFocus.focusProps}
      className={`${styles.rewardCard} ${isSelected ? styles.selected : ""} ${
        cardFocus.isFocused ? styles.focused : ""
      }`}
      style={{ borderColor: isSelected ? "#00ff00" : rarityColor }}
      onClick={onSelect}
      aria-label={`${card.name} - ${card.currentHp} HP ${
        isDuplicate ? `(Doublon - deviendra x${newQuantity})` : "(Nouvelle carte)"
      } ${isSelected ? "(Sélectionnée)" : ""}`}
    >
      {isSelected && (
        <div className={styles.selectedBadge}>⭐ SÉLECTIONNÉE</div>
      )}
      {isDuplicate && (
        <div className={styles.duplicateBadge}>🔁 Doublon (x{newQuantity})</div>
      )}
      <CardDisplay card={card} />
    </div>
  );
};
