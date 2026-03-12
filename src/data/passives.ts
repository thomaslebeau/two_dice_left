/**
 * Passive display info — names and descriptions for UI.
 * Pure data, zero Pixi imports.
 */

import type { PassiveId } from '../engine/types';
import { STRINGS } from './strings';

export interface PassiveInfo {
  readonly name: string;
  readonly description: string;
}

export const PASSIVE_INFO: Record<PassiveId, PassiveInfo> = {
  survivant: {
    name: STRINGS.PASSIVE_SURVIVANT,
    description: STRINGS.PASSIVE_SURVIVANT_DESC,
  },
  rempart: {
    name: STRINGS.PASSIVE_REMPART,
    description: STRINGS.PASSIVE_REMPART_DESC,
  },
  ingenieux: {
    name: STRINGS.PASSIVE_INGENIEUX,
    description: STRINGS.PASSIVE_INGENIEUX_DESC,
  },
  elan: {
    name: STRINGS.PASSIVE_ELAN,
    description: STRINGS.PASSIVE_ELAN_DESC,
  },
  recycleur: {
    name: STRINGS.PASSIVE_RECYCLEUR,
    description: STRINGS.PASSIVE_RECYCLEUR_DESC,
  },
};
