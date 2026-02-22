import type { EnemyCard, EnemyBase } from '@/types/card.types';
import { ENEMY_DATABASE } from '@shared/constants/enemies';
import { Rarity } from '@enums/Rarity.enum';

interface TierConfig {
  rarities: Rarity[];
  hpMultiplier: number;
  statBoost: number;
  isBoss: boolean;
}

interface TierBoost {
  attack: number;
  defense: number;
}

const TIER_CONFIG: Record<number, TierConfig> = {
  1: { rarities: [Rarity.COMMON], hpMultiplier: 0.25, statBoost: 0, isBoss: false },
  2: { rarities: [Rarity.COMMON, Rarity.UNCOMMON], hpMultiplier: 0.45, statBoost: 0, isBoss: false },
  3: { rarities: [Rarity.UNCOMMON, Rarity.RARE], hpMultiplier: 0.6, statBoost: 0, isBoss: false },
  4: { rarities: [Rarity.RARE, Rarity.EPIC], hpMultiplier: 0.75, statBoost: 0, isBoss: false },
  5: { rarities: [Rarity.EPIC], hpMultiplier: 0.9, statBoost: 0, isBoss: true },
};

// Only the boss gets a stat boost — earlier tiers rely on rarity pools and HP scaling
const TIER_BOOST: Record<number, TierBoost> = {
  1: { attack: 0, defense: 0 },
  2: { attack: 0, defense: 0 },
  3: { attack: 0, defense: 0 },
  4: { attack: 1, defense: 0 },
  5: { attack: 1, defense: 1 },
};

/**
 * Generate an enemy card based on combat number.
 * Draws from the dedicated ENEMY_DATABASE (mutant plants).
 * Difficulty scales: HP multiplier, stat boost, boss flag.
 */
export const generateEnemy = (combatNumber: number): EnemyCard => {
  const tier = TIER_CONFIG[combatNumber] ?? {
    rarities: [Rarity.COMMON],
    hpMultiplier: 1.0,
    statBoost: 0,
    isBoss: false,
  };

  let pool: EnemyBase[] = ENEMY_DATABASE.filter((c) => tier.rarities.includes(c.rarity));
  if (pool.length === 0) {
    pool = ENEMY_DATABASE;
  }

  const base = pool[Math.floor(Math.random() * pool.length)];
  const scaledHp = Math.max(1, Math.floor(base.maxHp * tier.hpMultiplier));

  const boost = TIER_BOOST[combatNumber] ?? { attack: 0, defense: 0 };

  return {
    ...base,
    name: tier.isBoss ? `BOSS — ${base.name}` : base.name,
    maxHp: scaledHp,
    currentHp: scaledHp,
    attackMod: base.attackMod + boost.attack,
    defenseMod: base.defenseMod + boost.defense,
    description: tier.isBoss ? `BOSS FINAL — ${base.description}` : base.description,
    isBoss: tier.isBoss,
    allocationPattern: base.allocationPattern,
  };
};
