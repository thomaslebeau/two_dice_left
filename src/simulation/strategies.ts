import type { Card, EnemyCard } from '../types/card.types.ts';
import { filterAliveCards } from '../shared/utils/cardDeathUtils.ts';

export interface PlayerStrategy {
  name: string;
  chooseCard(collection: Card[], combatNumber: number, enemyCard: EnemyCard): Card;
  chooseReward(rewards: Card[], collection: Card[], combatNumber: number): Card | null;
}

export const prudentStrategy: PlayerStrategy = {
  name: 'Prudent',

  chooseCard(collection, _combatNumber, _enemyCard) {
    const alive = filterAliveCards(collection);
    return alive.reduce((best, c) => c.currentHp > best.currentHp ? c : best, alive[0]);
  },

  chooseReward(rewards, collection, _combatNumber) {
    const avgMaxHp = collection.reduce((sum, c) => sum + c.maxHp, 0) / collection.length;
    const best = rewards.reduce((b, c) => c.maxHp > b.maxHp ? c : b, rewards[0]);
    if (best.maxHp < avgMaxHp) return null;
    return best;
  },
};

export const aggressiveStrategy: PlayerStrategy = {
  name: 'Aggressive',

  chooseCard(collection, _combatNumber, _enemyCard) {
    const alive = filterAliveCards(collection);
    return alive.reduce((best, c) => {
      if (c.attackMod > best.attackMod) return c;
      // Tiebreaker: lowest HP (expendable)
      if (c.attackMod === best.attackMod && c.currentHp < best.currentHp) return c;
      return best;
    }, alive[0]);
  },

  chooseReward(rewards, _collection, _combatNumber) {
    return rewards.reduce((best, c) => c.attackMod > best.attackMod ? c : best, rewards[0]);
  },
};

export const economistStrategy: PlayerStrategy = {
  name: 'Economist',

  chooseCard(collection, combatNumber, _enemyCard) {
    const alive = filterAliveCards(collection);
    if (combatNumber <= 2) {
      // Sacrifice the weakest
      return alive.reduce((worst, c) => c.maxHp < worst.maxHp ? c : worst, alive[0]);
    }
    // Pick highest combined stats
    const score = (c: Card) => c.attackMod + c.defenseMod;
    return alive.reduce((best, c) => score(c) > score(best) ? c : best, alive[0]);
  },

  chooseReward(rewards, _collection, _combatNumber) {
    // Always take — pick highest overall stat sum
    const score = (c: Card) => c.attackMod + c.defenseMod + c.maxHp / 10;
    return rewards.reduce((best, c) => score(c) > score(best) ? c : best, rewards[0]);
  },
};

export const naiveStrategy: PlayerStrategy = {
  name: 'Naive',

  chooseCard(collection, _combatNumber, _enemyCard) {
    const alive = filterAliveCards(collection);
    return alive[Math.floor(Math.random() * alive.length)];
  },

  chooseReward(rewards, _collection, _combatNumber) {
    if (Math.random() < 0.5) return null;
    return rewards[Math.floor(Math.random() * rewards.length)];
  },
};

export const ALL_STRATEGIES: PlayerStrategy[] = [
  prudentStrategy,
  aggressiveStrategy,
  economistStrategy,
  naiveStrategy,
];
