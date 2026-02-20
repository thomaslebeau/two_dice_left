import type { CardBase } from '@/types/card.types';
import { Rarity } from '@enums/Rarity.enum';

/**
 * Complete card database for the game
 */
export const CARD_DATABASE: CardBase[] = [
  {
    id: 1,
    name: "Guerrier Novice",
    rarity: Rarity.COMMON,
    maxHp: 10,
    attackMod: 0,
    defenseMod: 0,
    description: "Un guerrier basique",
  },
  {
    id: 2,
    name: "Écuyer",
    rarity: Rarity.COMMON,
    maxHp: 12,
    attackMod: 0,
    defenseMod: 1,
    description: "Défense +1",
  },
  {
    id: 3,
    name: "Bretteur",
    rarity: Rarity.COMMON,
    maxHp: 8,
    attackMod: 1,
    defenseMod: 0,
    description: "Attaque +1",
  },
  {
    id: 4,
    name: "Paladin",
    rarity: Rarity.RARE,
    maxHp: 15,
    attackMod: 0,
    defenseMod: 2,
    description: "Tank - Défense +2",
  },
  {
    id: 5,
    name: "Berserk",
    rarity: Rarity.RARE,
    maxHp: 8,
    attackMod: 2,
    defenseMod: -1,
    description: "Attaque +2, Défense -1",
  },
  {
    id: 6,
    name: "Assassin",
    rarity: Rarity.RARE,
    maxHp: 7,
    attackMod: 3,
    defenseMod: 0,
    description: "Frappe mortelle - Attaque +3",
  },
  {
    id: 7,
    name: "Garde Royal",
    rarity: Rarity.UNCOMMON,
    maxHp: 14,
    attackMod: 1,
    defenseMod: 1,
    description: "Équilibré - +1/+1",
  },
  {
    id: 8,
    name: "Chevalier Noir",
    rarity: Rarity.EPIC,
    maxHp: 12,
    attackMod: 2,
    defenseMod: 2,
    description: "Puissant - +2/+2",
  },
  {
    id: 9,
    name: "Recrue",
    rarity: Rarity.COMMON,
    maxHp: 6,
    attackMod: 0,
    defenseMod: 0,
    description: "Fragile mais rapide",
  },
  {
    id: 10,
    name: "Champion",
    rarity: Rarity.EPIC,
    maxHp: 20,
    attackMod: 1,
    defenseMod: 1,
    description: "Le héros - +1/+1, 20 HP",
  },
];

/**
 * Rarity color mapping
 */
export const RARITY_COLORS: Record<string, string> = {
  common: '#B0A894',
  uncommon: '#4A9E32',
  rare: '#D4A030',
  epic: '#A8E060',
};

/**
 * Max number of combats to win
 */
export const MAX_COMBATS = 5;
