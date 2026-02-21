import type { CardBase } from '@/types/card.types';
import { Rarity } from '@enums/Rarity.enum';

/**
 * Enemy card database — mutant plant creatures (post-apocalyptic)
 */
export const ENEMY_DATABASE: CardBase[] = [
  {
    id: 1,
    name: "Sécateur Rampant",
    rarity: Rarity.COMMON,
    maxHp: 8,
    attackMod: 0,
    defenseMod: 0,
    description: "Plante rampante basique",
  },
  {
    id: 2,
    name: "Lampe Épineuse",
    rarity: Rarity.COMMON,
    maxHp: 6,
    attackMod: 1,
    defenseMod: -1,
    description: "Fragile mais agressive — ATK +1, DEF -1",
  },
  {
    id: 3,
    name: "Fourchette Vrille",
    rarity: Rarity.COMMON,
    maxHp: 5,
    attackMod: 0,
    defenseMod: 0,
    description: "Petite vrille mutante",
  },
  {
    id: 4,
    name: "Ventilateur Griffe",
    rarity: Rarity.UNCOMMON,
    maxHp: 10,
    attackMod: 1,
    defenseMod: 0,
    description: "Griffes rotatives — ATK +1",
  },
  {
    id: 5,
    name: "Radiateur Mousse",
    rarity: Rarity.UNCOMMON,
    maxHp: 10,
    attackMod: 0,
    defenseMod: 1,
    description: "Mousse blindée — DEF +1",
  },
  {
    id: 6,
    name: "Tronçonneuse Lierre",
    rarity: Rarity.RARE,
    maxHp: 10,
    attackMod: 2,
    defenseMod: 0,
    description: "Lierre tranchant — ATK +2",
  },
  {
    id: 7,
    name: "Frigo Mâchoire",
    rarity: Rarity.RARE,
    maxHp: 12,
    attackMod: 0,
    defenseMod: 1,
    description: "Mâchoire blindée — DEF +1",
  },
  {
    id: 8,
    name: "Voiture-Racine",
    rarity: Rarity.EPIC,
    maxHp: 14,
    attackMod: 1,
    defenseMod: 1,
    description: "Machine végétale — +1/+1",
  },
  {
    id: 9,
    name: "Grue Tentacule",
    rarity: Rarity.EPIC,
    maxHp: 13,
    attackMod: 2,
    defenseMod: 0,
    description: "Tentacules de grue — ATK +2",
  },
];
