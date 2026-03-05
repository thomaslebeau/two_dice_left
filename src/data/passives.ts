/**
 * Passive display info — French names and descriptions for UI.
 * Pure data, zero Pixi imports.
 */

import type { PassiveId } from '../engine/types';

export interface PassiveInfo {
  readonly name: string;
  readonly description: string;
}

export const PASSIVE_INFO: Record<PassiveId, PassiveInfo> = {
  survivant: {
    name: 'Survivant',
    description: 'Sous 40% PV, +1 dégâts arme',
  },
  rempart: {
    name: 'Rempart',
    description: 'Absorption excédentaire → +1 bouclier tour suivant (PV>50%)',
  },
  ingenieux: {
    name: 'Ingénieux',
    description: '2 types équipés → +1 à l\'effet le plus faible',
  },
  elan: {
    name: 'Élan',
    description: 'Speed kill + PV>50% → +1 dégâts R1',
  },
  recycleur: {
    name: 'Recycleur',
    description: '1×/combat, dé=1 → 2 automatique',
  },
};
