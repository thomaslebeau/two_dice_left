/**
 * Survivor definitions for v6.
 * Identity = loadout. Each survivor's equipment list defines their play pattern.
 * Starting pool: Le Rescapé only. Others unlocked by successive victories.
 */

import type { Survivor } from '../engine/types';
import {
  RUSTY_BLADE,
  SCRAP_SHIELD,
  SHARP_KNIFE,
  TWIN_SPIKE,
  HEAVY_WRENCH,
  REINFORCED_DOOR,
  LIGHT_GUARD,
  REPAIR_KIT,
} from './equipment';

/** Le Rescapé — baseline (weapon + shield) */
export const RESCAPE: Survivor = {
  id: 1,
  name: 'Le Rescapé',
  hp: 12,
  maxHp: 12,
  equipment: [RUSTY_BLADE, SCRAP_SHIELD],
};

/** La Sentinelle — tank (weapon + heavy shield) */
export const SENTINELLE: Survivor = {
  id: 2,
  name: 'La Sentinelle',
  hp: 14,
  maxHp: 14,
  equipment: [RUSTY_BLADE, REINFORCED_DOOR],
};

/** Le Bricoleur — 3 slots (weapon + weapon + shield) */
export const BRICOLEUR: Survivor = {
  id: 3,
  name: 'Le Bricoleur',
  hp: 10,
  maxHp: 10,
  equipment: [RUSTY_BLADE, TWIN_SPIKE, LIGHT_GUARD],
};

/** La Coureuse — glass cannon (two weapons, no shield) */
export const COUREUSE: Survivor = {
  id: 4,
  name: 'La Coureuse',
  hp: 9,
  maxHp: 9,
  equipment: [SHARP_KNIFE, SHARP_KNIFE],
};

/** Le Mécanicien — balanced 3 slots (weapon + shield + utility) */
export const MECANICIEN: Survivor = {
  id: 5,
  name: 'Le Mécanicien',
  hp: 11,
  maxHp: 11,
  equipment: [HEAVY_WRENCH, SCRAP_SHIELD, REPAIR_KIT],
};

/** All survivor definitions, ordered by unlock progression */
export const ALL_SURVIVORS: readonly Survivor[] = [
  RESCAPE,
  SENTINELLE,
  BRICOLEUR,
  COUREUSE,
  MECANICIEN,
];

/** Default unlocked survivor IDs (just Le Rescapé) */
export const STARTER_SURVIVOR_IDS: readonly number[] = [1];
