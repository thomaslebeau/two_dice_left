/**
 * Equipment database for v6.
 * Starter equipment (survivor loadouts) + loot pool (event rewards).
 * Every effect is a pure function: (dieValue) => EquipmentEffect.
 */

import type { Equipment, EquipmentEffect } from '../engine/types';

// ---------------------------------------------------------------------------
// Helper: zero-effect base
// ---------------------------------------------------------------------------

const NO_EFFECT: EquipmentEffect = { damage: 0, shield: 0, heal: 0, poison: 0 };

// ---------------------------------------------------------------------------
// Starter equipment
// ---------------------------------------------------------------------------

/** Rusty Blade — baseline weapon, die+1 damage */
export const RUSTY_BLADE: Equipment = {
  id: 'rusty_blade',
  name: 'Lame Rouillée',
  type: 'weapon',
  minDie: 1,
  maxDie: 6,
  effect: (die) => ({ ...NO_EFFECT, damage: die + 1 }),
  description: 'die+1 damage',
};

/** Scrap Shield — baseline shield, die absorption */
export const SCRAP_SHIELD: Equipment = {
  id: 'scrap_shield',
  name: 'Bouclier de Ferraille',
  type: 'shield',
  minDie: 1,
  maxDie: 6,
  effect: (die) => ({ ...NO_EFFECT, shield: die }),
  description: 'die absorption',
};

/** Sharp Knife — glass cannon weapon, die+2 damage */
export const SHARP_KNIFE: Equipment = {
  id: 'sharp_knife',
  name: 'Couteau Aiguisé',
  type: 'weapon',
  minDie: 1,
  maxDie: 6,
  effect: (die) => ({ ...NO_EFFECT, damage: die + 2 }),
  description: 'die+2 damage',
};

/** Twin Spike — low-range weapon, die+2 damage */
export const TWIN_SPIKE: Equipment = {
  id: 'twin_spike',
  name: 'Double Pointe',
  type: 'weapon',
  minDie: 1,
  maxDie: 4,
  effect: (die) => ({ ...NO_EFFECT, damage: die + 2 }),
  description: 'die+2 damage (1-4 only)',
};

/** Heavy Wrench — high-range weapon, die+3 damage */
export const HEAVY_WRENCH: Equipment = {
  id: 'heavy_wrench',
  name: 'Clé Lourde',
  type: 'weapon',
  minDie: 4,
  maxDie: 6,
  effect: (die) => ({ ...NO_EFFECT, damage: die + 3 }),
  description: 'die+3 damage (4-6 only)',
};

/** Sharpened Fork — low-range weapon, die+1 damage */
export const SHARPENED_FORK: Equipment = {
  id: 'sharpened_fork',
  name: 'Fourche Affûtée',
  type: 'weapon',
  minDie: 1,
  maxDie: 3,
  effect: (die) => ({ ...NO_EFFECT, damage: die + 1 }),
  description: 'die+1 damage (1-3 only)',
};

/** Reinforced Door — high-range shield, die+2 absorption */
export const REINFORCED_DOOR: Equipment = {
  id: 'reinforced_door',
  name: 'Porte Blindée',
  type: 'shield',
  minDie: 3,
  maxDie: 6,
  effect: (die) => ({ ...NO_EFFECT, shield: die + 2 }),
  description: 'die+2 absorption (3-6 only)',
};

/** Light Guard — low-range shield, die+1 absorption */
export const LIGHT_GUARD: Equipment = {
  id: 'light_guard',
  name: 'Garde Légère',
  type: 'shield',
  minDie: 1,
  maxDie: 4,
  effect: (die) => ({ ...NO_EFFECT, shield: die + 1 }),
  description: 'die+1 absorption (1-4 only)',
};

/** Repair Kit — low-range utility, ceil(die/2)+1 heal */
export const REPAIR_KIT: Equipment = {
  id: 'repair_kit',
  name: 'Kit de Réparation',
  type: 'utility',
  minDie: 1,
  maxDie: 3,
  effect: (die) => ({ ...NO_EFFECT, heal: Math.ceil(die / 2) + 1 }),
  description: 'ceil(die/2)+1 heal (1-3 only)',
};

// ---------------------------------------------------------------------------
// Loot pool (found via events)
// ---------------------------------------------------------------------------

/** Heavy Hammer — high-range weapon, die+3 damage */
export const HEAVY_HAMMER: Equipment = {
  id: 'heavy_hammer',
  name: 'Marteau Lourd',
  type: 'weapon',
  minDie: 5,
  maxDie: 6,
  effect: (die) => ({ ...NO_EFFECT, damage: die + 3 }),
  description: 'die+3 damage (5-6 only)',
};

/** Poison Needle — 1 damage + poison (2 turns if die>=3) */
export const POISON_NEEDLE: Equipment = {
  id: 'poison_needle',
  name: 'Aiguille Empoisonnée',
  type: 'weapon',
  minDie: 1,
  maxDie: 6,
  effect: (die) => ({
    ...NO_EFFECT,
    damage: 1,
    poison: die >= 3 ? 2 : 0,
  }),
  description: '1 dmg + poison (2 turns if die>=3)',
};

/** Serrated Edge — mid-range weapon, die+1 damage */
export const SERRATED_EDGE: Equipment = {
  id: 'serrated_edge',
  name: 'Lame Crantée',
  type: 'weapon',
  minDie: 2,
  maxDie: 5,
  effect: (die) => ({ ...NO_EFFECT, damage: die + 1 }),
  description: 'die+1 damage (2-5 only)',
};

/** Glass Shard — die damage, DOUBLE on 5-6 */
export const GLASS_SHARD: Equipment = {
  id: 'glass_shard',
  name: 'Éclat de Verre',
  type: 'weapon',
  minDie: 1,
  maxDie: 6,
  effect: (die) => ({
    ...NO_EFFECT,
    damage: die >= 5 ? die * 2 : die,
  }),
  description: 'die damage, DOUBLE on 5-6',
};

/** Thick Bark — mid-range shield, die+1 absorption */
export const THICK_BARK: Equipment = {
  id: 'thick_bark',
  name: 'Écorce Épaisse',
  type: 'shield',
  minDie: 2,
  maxDie: 6,
  effect: (die) => ({ ...NO_EFFECT, shield: die + 1 }),
  description: 'die+1 absorption (2-6 only)',
};

/** Mirror Plate — high-range shield, die+2 absorption + 1 reflect */
export const MIRROR_PLATE: Equipment = {
  id: 'mirror_plate',
  name: 'Plaque Miroir',
  type: 'shield',
  minDie: 4,
  maxDie: 6,
  effect: (die) => ({ ...NO_EFFECT, shield: die + 2, damage: 1 }),
  description: 'die+2 absorption + 1 reflect (4-6 only)',
};

/** Bandage Wrap — low-range utility, heal = die value */
export const BANDAGE_WRAP: Equipment = {
  id: 'bandage_wrap',
  name: 'Bandage Végétal',
  type: 'utility',
  minDie: 1,
  maxDie: 4,
  effect: (die) => ({ ...NO_EFFECT, heal: die }),
  description: 'heal = die value (1-4 only)',
};

/** Adrenaline Root — full-range utility, split damage + shield */
export const ADRENALINE_ROOT: Equipment = {
  id: 'adrenaline_root',
  name: 'Racine Adrénaline',
  type: 'utility',
  minDie: 1,
  maxDie: 6,
  effect: (die) => ({
    ...NO_EFFECT,
    damage: Math.ceil(die / 2),
    shield: Math.ceil(die / 2),
  }),
  description: 'ceil(die/2) dmg + ceil(die/2) shield',
};

// ---------------------------------------------------------------------------
// Aggregates
// ---------------------------------------------------------------------------

/** All loot equipment available from events (8 items) */
export const ALL_LOOT: readonly Equipment[] = [
  HEAVY_HAMMER,
  POISON_NEEDLE,
  SERRATED_EDGE,
  GLASS_SHARD,
  THICK_BARK,
  MIRROR_PLATE,
  BANDAGE_WRAP,
  ADRENALINE_ROOT,
];
