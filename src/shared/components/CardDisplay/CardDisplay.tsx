import React from 'react';
import type { CardDisplayProps } from '@/types/card.types';
import { RARITY_COLORS } from '@shared/constants/cards';
import styles from './CardDisplay.module.scss';

/**
 * Card display component showing HP, stats, and rarity
 */
export const CardDisplay: React.FC<CardDisplayProps> = ({ card, isPlayer: _isPlayer = false, isDead = false }) => {
  const hpPercentage = (card.currentHp / card.maxHp) * 100;
  const rarityColor = RARITY_COLORS[card.rarity];

  return (
    <div
      className={`${styles.cardDisplay} ${isDead ? styles.dead : ''}`}
      style={{ borderColor: rarityColor }}
    >
      <div className={styles.cardName} style={{ color: rarityColor }}>
        {card.name}
        {card.quantity && card.quantity > 1 && (
          <span className={styles.quantity}> x{card.quantity}</span>
        )}
      </div>
      <div className={styles.cardHp}>
        ❤️ {card.currentHp}/{card.maxHp}
      </div>
      <div className={styles.progressBar}>
        <div className={styles.progressFill} style={{ width: `${hpPercentage}%` }}>
          {hpPercentage > 20 && `${Math.round(hpPercentage)}%`}
        </div>
      </div>
      <div className={styles.cardStats}>
        🗡️ Attaque: {card.attackMod >= 0 ? `+${card.attackMod}` : card.attackMod}
      </div>
      <div className={styles.cardStats}>
        🛡️ Défense: {card.defenseMod >= 0 ? `+${card.defenseMod}` : card.defenseMod}
      </div>
      <div className={styles.cardDescription}>{card.description}</div>
    </div>
  );
};
