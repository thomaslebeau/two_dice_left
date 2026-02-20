import type { EnemyCard } from '@/types/card.types';
import { CARD_DATABASE } from '@shared/constants/cards';
import { Rarity } from '@enums/Rarity.enum';

/**
 * Generate an enemy card based on combat number
 * Difficulty scales from combat 1 to 5
 */
export const generateEnemy = (combatNumber: number): EnemyCard => {
  let enemyPool = CARD_DATABASE;
  let hpMultiplier = 1;
  let statBoost = 0;
  let isBoss = false;

  switch (combatNumber) {
    case 1:
      enemyPool = CARD_DATABASE.filter((c) => c.rarity === Rarity.COMMON);
      hpMultiplier = 0.2;
      statBoost = 0;
      break;

    case 2:
      enemyPool = CARD_DATABASE.filter(
        (c) => c.rarity === Rarity.COMMON || c.rarity === Rarity.UNCOMMON
      );
      hpMultiplier = 0.5;
      statBoost = 0;
      break;

    case 3:
      enemyPool = CARD_DATABASE.filter(
        (c) => c.rarity === Rarity.UNCOMMON || c.rarity === Rarity.RARE
      );
      hpMultiplier = 0.5;
      statBoost = 0;
      break;

    case 4:
      enemyPool = CARD_DATABASE.filter(
        (c) => c.rarity === Rarity.RARE || c.rarity === Rarity.EPIC
      );
      hpMultiplier = 0.5;
      statBoost = 0;
      break;

    case 5:
      enemyPool = CARD_DATABASE.filter((c) => c.rarity === Rarity.EPIC);
      hpMultiplier = 0.5;
      statBoost = 0;
      isBoss = true;
      break;

    default:
      enemyPool = CARD_DATABASE;
      hpMultiplier = 1.0;
      statBoost = 0;
  }

  // Fallback if pool is empty
  if (enemyPool.length === 0) {
    enemyPool = CARD_DATABASE;
  }

  const enemyBase = enemyPool[Math.floor(Math.random() * enemyPool.length)];

  return {
    ...enemyBase,
    name: isBoss ? `BOSS - ${enemyBase.name}` : enemyBase.name,
    maxHp: Math.floor(enemyBase.maxHp * hpMultiplier),
    currentHp: Math.floor(enemyBase.maxHp * hpMultiplier),
    attackMod: enemyBase.attackMod + statBoost,
    defenseMod: enemyBase.defenseMod + statBoost,
    description: isBoss
      ? `BOSS FINAL - ${enemyBase.description}`
      : enemyBase.description,
    isBoss,
  };
};
