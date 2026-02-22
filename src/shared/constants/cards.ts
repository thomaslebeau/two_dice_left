import type { CardBase } from '@/types/card.types';
import { Rarity } from '@enums/Rarity.enum';

/**
 * Player card database — post-apocalyptic survivors
 * Starting collection: IDs 1–5 (3 Common + 2 Uncommon)
 * Reward pool: all 8 (shuffled)
 */
export const CARD_DATABASE: CardBase[] = [
  {
    id: 1,
    name: "Le Récupérateur",
    rarity: Rarity.COMMON,
    maxHp: 12,
    attackMod: 0,
    defenseMod: 1,
    description: "Survivant robuste — DEF +1",
  },
  {
    id: 2,
    name: "La Sentinelle",
    rarity: Rarity.COMMON,
    maxHp: 13,
    attackMod: 0,
    defenseMod: 1,
    description: "Garde vigilante — DEF +1",
  },
  {
    id: 3,
    name: "Le Bricoleur",
    rarity: Rarity.COMMON,
    maxHp: 10,
    attackMod: 1,
    defenseMod: 1,
    description: "Ingénieux — +1/+1",
  },
  {
    id: 4,
    name: "La Coureuse",
    rarity: Rarity.UNCOMMON,
    maxHp: 8,
    attackMod: 2,
    defenseMod: 1,
    description: "Rapide et agile — ATK +2, DEF +1",
  },
  {
    id: 5,
    name: "Le Mécanicien",
    rarity: Rarity.UNCOMMON,
    maxHp: 11,
    attackMod: 1,
    defenseMod: 1,
    description: "Équilibré — +1/+1",
  },
  {
    id: 6,
    name: "Le Forgeron",
    rarity: Rarity.RARE,
    maxHp: 10,
    attackMod: 3,
    defenseMod: 1,
    description: "Frappe brutale — ATK +3, DEF +1",
  },
  {
    id: 7,
    name: "Le Blindé",
    rarity: Rarity.RARE,
    maxHp: 16,
    attackMod: 0,
    defenseMod: 3,
    description: "Tank lourd — DEF +3",
  },
  {
    id: 8,
    name: "Le Vétéran",
    rarity: Rarity.EPIC,
    maxHp: 13,
    attackMod: 2,
    defenseMod: 2,
    description: "Combattant aguerri — +2/+2",
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
