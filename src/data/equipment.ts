/**
 * Equipment database for v6.
 * Starter equipment (survivor loadouts) + loot pool (event rewards).
 * Every effect is a pure function: (dieValue) => EquipmentEffect.
 */

import type { Equipment, EquipmentEffect, EffectContext } from '../engine/types';

// ---------------------------------------------------------------------------
// Helper: zero-effect base
// ---------------------------------------------------------------------------

const NO_EFFECT: EquipmentEffect = { damage: 0, shield: 0, heal: 0, poison: 0 };

// ---------------------------------------------------------------------------
// Starter equipment
// ---------------------------------------------------------------------------

/** Lame Cassée — baseline weapon, die+1 damage */
export const RUSTY_BLADE: Equipment = {
  id: 'rusty_blade',
  name: 'Lame Cassée',
  type: 'weapon',
  minDie: 1,
  maxDie: 6,
  effect: (die) => ({ ...NO_EFFECT, damage: die + 1 }),
  description: 'dé+1 dégâts',
};

/** Panneau Stop — baseline shield, die absorption (nerfed from die+1) */
export const STOP_SIGN: Equipment = {
  id: 'stop_sign',
  name: 'Panneau Stop',
  type: 'shield',
  minDie: 1,
  maxDie: 6,
  effect: (die) => ({ ...NO_EFFECT, shield: die }),
  description: 'dé blocage',
};

/** Cran d'Arrêt — glass cannon weapon, die+2 damage (2-6 range, 1 is wasted) */
export const SWITCHBLADE: Equipment = {
  id: 'switchblade',
  name: "Cran d'Arrêt",
  type: 'weapon',
  minDie: 2,
  maxDie: 6,
  effect: (die) => ({ ...NO_EFFECT, damage: die + 2 }),
  description: 'dé+2 dégâts',
};

/** Double Fourche — low-range weapon, die+2 damage */
export const DOUBLE_FORK: Equipment = {
  id: 'double_fork',
  name: 'Double Fourche',
  type: 'weapon',
  minDie: 1,
  maxDie: 4,
  effect: (die) => ({ ...NO_EFFECT, damage: die + 2 }),
  description: 'dé+2 dégâts',
};

/** Clé Lourde — high-range weapon, die+2 damage */
export const HEAVY_KEY: Equipment = {
  id: 'heavy_key',
  name: 'Clé Lourde',
  type: 'weapon',
  minDie: 4,
  maxDie: 6,
  effect: (die) => ({ ...NO_EFFECT, damage: die + 2 }),
  description: 'dé+2 dégâts',
};

/** Porte Blindée — high-range shield, die+1 abs (die+2 if 5-6) */
export const REINFORCED_DOOR: Equipment = {
  id: 'reinforced_door',
  name: 'Porte Blindée',
  type: 'shield',
  minDie: 3,
  maxDie: 6,
  effect: (die) => ({ ...NO_EFFECT, shield: die >= 5 ? die + 2 : die + 1 }),
  description: 'dé+1 blocage (dé+2 si 5-6)',
};

/** Plaque d'Égout — full-range shield, die+1 absorption */
export const SEWER_PLATE: Equipment = {
  id: 'sewer_plate',
  name: "Plaque d'Égout",
  type: 'shield',
  minDie: 1,
  maxDie: 6,
  effect: (die) => ({ ...NO_EFFECT, shield: die + 1 }),
  description: 'dé+1 blocage',
};

/** Kit de Survie — narrow-range utility, ceil(die/2)+1 heal */
export const SURVIVAL_KIT: Equipment = {
  id: 'survival_kit',
  name: 'Kit de Survie',
  type: 'utility',
  minDie: 1,
  maxDie: 2,
  effect: (die) => ({ ...NO_EFFECT, heal: Math.ceil(die / 2) + 1 }),
  description: 'soin',
};

// ---------------------------------------------------------------------------
// Loot pool (found via events)
// ---------------------------------------------------------------------------

/** Masse — high-range weapon, die+3 damage */
export const MACE: Equipment = {
  id: 'mace',
  name: 'Masse',
  type: 'weapon',
  minDie: 5,
  maxDie: 6,
  effect: (die) => ({ ...NO_EFFECT, damage: die + 3 }),
  description: 'dé+3 dégâts',
};

/** Aiguille Empoisonnée — 1 damage + 1 poison turn (always) */
export const POISON_NEEDLE: Equipment = {
  id: 'poison_needle',
  name: 'Aiguille Empoisonnée',
  type: 'weapon',
  minDie: 1,
  maxDie: 6,
  effect: () => ({
    ...NO_EFFECT,
    damage: 1,
    poison: 1,
  }),
  description: '1 dégât + 1 tour de poison',
};

/** Scie Courte — mid-range weapon, die+1 damage */
export const SHORT_SAW: Equipment = {
  id: 'short_saw',
  name: 'Scie Courte',
  type: 'weapon',
  minDie: 2,
  maxDie: 5,
  effect: (die) => ({ ...NO_EFFECT, damage: die + 1 }),
  description: 'dé+1 dégâts',
};

/** Éclat de Verre — die×2 damage, consumable (removed after one use) */
export const GLASS_SHARD: Equipment = {
  id: 'glass_shard',
  name: 'Éclat de Verre',
  type: 'weapon',
  minDie: 1,
  maxDie: 6,
  consumable: true,
  effect: (die) => ({
    ...NO_EFFECT,
    damage: die * 2,
  }),
  description: 'dé×2 dégâts, usage unique',
};

/** Écorce Épaisse — mid-range shield, die+1 absorption */
export const THICK_BARK: Equipment = {
  id: 'thick_bark',
  name: 'Écorce Épaisse',
  type: 'shield',
  minDie: 2,
  maxDie: 6,
  effect: (die) => ({ ...NO_EFFECT, shield: die + 1 }),
  description: 'dé+1 blocage',
};

/** Bandage Végétal — low-range utility, heal = die value */
export const VEGETAL_BANDAGE: Equipment = {
  id: 'vegetal_bandage',
  name: 'Bandage Végétal',
  type: 'utility',
  minDie: 1,
  maxDie: 4,
  effect: (die) => ({ ...NO_EFFECT, heal: die }),
  description: 'soin = valeur du dé',
};

/** Racine Amère — full-range utility, split damage + shield */
export const BITTER_ROOT: Equipment = {
  id: 'bitter_root',
  name: 'Racine Amère',
  type: 'utility',
  minDie: 1,
  maxDie: 6,
  effect: (die) => ({
    ...NO_EFFECT,
    damage: Math.ceil(die / 2),
    shield: Math.ceil(die / 2),
  }),
  description: 'dé/2 dégâts + dé/2 blocage',
};

// ---------------------------------------------------------------------------
// Synergy loot pool (v6.1)
// ---------------------------------------------------------------------------

/** Lame Corrosive — die+1 dmg, doubled if target is poisoned */
export const CORROSIVE_BLADE: Equipment = {
  id: 'corrosive_blade',
  name: 'Lame Corrosive',
  type: 'weapon',
  minDie: 1,
  maxDie: 6,
  effect: (die: number, ctx?: EffectContext) => ({
    ...NO_EFFECT,
    damage: ctx?.targetPoisoned ? (die + 1) * 2 : die + 1,
  }),
  description: 'dé+1 dégâts (×2 si cible empoisonnée)',
};

/** Sac à Spores — +1 poison turn (utility, no weapon slot cost) */
export const SPORE_SAC: Equipment = {
  id: 'spore_sac',
  name: 'Sac à Spores',
  type: 'utility',
  minDie: 1,
  maxDie: 4,
  effect: () => ({ ...NO_EFFECT, poison: 1 }),
  description: '+1 tour de poison',
};

/** Bouclier à Épines — die abs + ceil(die/3) reflect damage */
export const THORN_SHIELD: Equipment = {
  id: 'thorn_shield',
  name: 'Bouclier à Épines',
  type: 'shield',
  minDie: 1,
  maxDie: 6,
  effect: (die: number) => ({
    ...NO_EFFECT,
    shield: die,
    damage: Math.ceil(die / 3),
  }),
  description: 'dé blocage + dé/3 renvoi',
};

/** Câble Tressé — die dmg, +2 if another die is also in a weapon slot */
export const BRAIDED_CABLE: Equipment = {
  id: 'braided_cable',
  name: 'Câble Tressé',
  type: 'weapon',
  minDie: 1,
  maxDie: 6,
  effect: (die: number, ctx?: EffectContext) => ({
    ...NO_EFFECT,
    damage: ctx?.otherDieInWeapon ? die + 2 : die,
  }),
  description: 'dé dégâts (+2 si duo arme)',
};

/** Cocktail Molotov — die damage that bypasses shields */
export const MOLOTOV: Equipment = {
  id: 'molotov',
  name: 'Cocktail Molotov',
  type: 'utility',
  minDie: 3,
  maxDie: 6,
  bypassShield: true,
  effect: (die: number) => ({
    ...NO_EFFECT,
    damage: die,
  }),
  description: 'dé dégâts (ignore blocage)',
};

// ---------------------------------------------------------------------------
// Aggregates
// ---------------------------------------------------------------------------

/** All loot equipment available from events (11 items: 7 core + 4 synergy) */
export const ALL_LOOT: readonly Equipment[] = [
  // Core loot (7 items)
  MACE,
  POISON_NEEDLE,
  SHORT_SAW,
  GLASS_SHARD,
  THICK_BARK,
  VEGETAL_BANDAGE,
  BITTER_ROOT,
  // Moved from synergy to core
  THORN_SHIELD,
  // Synergy loot (3 items)
  CORROSIVE_BLADE,
  SPORE_SAC,
  BRAIDED_CABLE,
  // Synergy: Bypass
  MOLOTOV,
];
