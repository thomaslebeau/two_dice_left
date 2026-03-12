/**
 * Equipment database for v6.
 * Starter equipment (survivor loadouts) + loot pool (event rewards).
 * Every effect is a pure function: (dieValue) => EquipmentEffect.
 */

import type { Equipment, EquipmentEffect, EffectContext } from '../engine/types';
import { STRINGS } from './strings';

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
  name: STRINGS.EQ_LAME_CASSEE,
  type: 'weapon',
  minDie: 1,
  maxDie: 6,
  effect: (die) => ({ ...NO_EFFECT, damage: die + 1 }),
  description: STRINGS.EFF_LAME_CASSEE,
};

/** Panneau Stop — baseline shield, die absorption (nerfed from die+1) */
export const STOP_SIGN: Equipment = {
  id: 'stop_sign',
  name: STRINGS.EQ_PANNEAU_STOP,
  type: 'shield',
  minDie: 1,
  maxDie: 6,
  effect: (die) => ({ ...NO_EFFECT, shield: die }),
  description: STRINGS.EFF_PANNEAU_STOP,
};

/** Cran d'Arrêt — glass cannon weapon, die+2 damage (2-6 range, 1 is wasted) */
export const SWITCHBLADE: Equipment = {
  id: 'switchblade',
  name: STRINGS.EQ_CRAN_ARRET,
  type: 'weapon',
  minDie: 2,
  maxDie: 6,
  effect: (die) => ({ ...NO_EFFECT, damage: die + 2 }),
  description: STRINGS.EFF_CRAN_ARRET,
};

/** Double Fourche — low-range weapon, die+2 damage */
export const DOUBLE_FORK: Equipment = {
  id: 'double_fork',
  name: STRINGS.EQ_DOUBLE_FOURCHE,
  type: 'weapon',
  minDie: 1,
  maxDie: 4,
  effect: (die) => ({ ...NO_EFFECT, damage: die + 2 }),
  description: STRINGS.EFF_DOUBLE_FOURCHE,
};

/** Clé Lourde — high-range weapon, die+2 damage */
export const HEAVY_KEY: Equipment = {
  id: 'heavy_key',
  name: STRINGS.EQ_CLE_LOURDE,
  type: 'weapon',
  minDie: 4,
  maxDie: 6,
  effect: (die) => ({ ...NO_EFFECT, damage: die + 2 }),
  description: STRINGS.EFF_CLE_LOURDE,
};

/** Porte Blindée — high-range shield, die+1 abs (die+2 if 5-6) */
export const REINFORCED_DOOR: Equipment = {
  id: 'reinforced_door',
  name: STRINGS.EQ_PORTE_BLINDEE,
  type: 'shield',
  minDie: 3,
  maxDie: 6,
  effect: (die) => ({ ...NO_EFFECT, shield: die >= 5 ? die + 2 : die + 1 }),
  description: STRINGS.EFF_PORTE_BLINDEE,
};

/** Plaque d'Égout — full-range shield, die+1 absorption */
export const SEWER_PLATE: Equipment = {
  id: 'sewer_plate',
  name: STRINGS.EQ_PLAQUE_EGOUT,
  type: 'shield',
  minDie: 1,
  maxDie: 6,
  effect: (die) => ({ ...NO_EFFECT, shield: die + 1 }),
  description: STRINGS.EFF_PLAQUE_EGOUT,
};

/** Kit de Survie — narrow-range utility, ceil(die/2)+1 heal */
export const SURVIVAL_KIT: Equipment = {
  id: 'survival_kit',
  name: STRINGS.EQ_KIT_SURVIE,
  type: 'utility',
  minDie: 1,
  maxDie: 2,
  effect: (die) => ({ ...NO_EFFECT, heal: Math.ceil(die / 2) + 1 }),
  description: STRINGS.EFF_KIT_SURVIE,
};

// ---------------------------------------------------------------------------
// Loot pool (found via events)
// ---------------------------------------------------------------------------

/** Masse — high-range weapon, die+3 damage */
export const MACE: Equipment = {
  id: 'mace',
  name: STRINGS.EQ_MASSE,
  type: 'weapon',
  minDie: 5,
  maxDie: 6,
  effect: (die) => ({ ...NO_EFFECT, damage: die + 3 }),
  description: STRINGS.EFF_MASSE,
};

/** Aiguille Empoisonnée — 1 damage + 1 poison turn (always) */
export const POISON_NEEDLE: Equipment = {
  id: 'poison_needle',
  name: STRINGS.EQ_AIGUILLE,
  type: 'weapon',
  minDie: 1,
  maxDie: 6,
  effect: () => ({
    ...NO_EFFECT,
    damage: 1,
    poison: 1,
  }),
  description: STRINGS.EFF_AIGUILLE,
};

/** Scie Courte — mid-range weapon, die+1 damage */
export const SHORT_SAW: Equipment = {
  id: 'short_saw',
  name: STRINGS.EQ_SCIE_COURTE,
  type: 'weapon',
  minDie: 2,
  maxDie: 5,
  effect: (die) => ({ ...NO_EFFECT, damage: die + 1 }),
  description: STRINGS.EFF_SCIE_COURTE,
};

/** Éclat de Verre — die×2 damage, consumable (removed after one use) */
export const GLASS_SHARD: Equipment = {
  id: 'glass_shard',
  name: STRINGS.EQ_ECLAT_VERRE,
  type: 'weapon',
  minDie: 1,
  maxDie: 6,
  consumable: true,
  effect: (die) => ({
    ...NO_EFFECT,
    damage: die * 2,
  }),
  description: STRINGS.EFF_ECLAT_VERRE,
};

/** Écorce Épaisse — mid-range shield, die+1 absorption */
export const THICK_BARK: Equipment = {
  id: 'thick_bark',
  name: STRINGS.EQ_ECORCE,
  type: 'shield',
  minDie: 2,
  maxDie: 6,
  effect: (die) => ({ ...NO_EFFECT, shield: die + 1 }),
  description: STRINGS.EFF_ECORCE,
};

/** Bandage Végétal — low-range utility, heal = die value */
export const VEGETAL_BANDAGE: Equipment = {
  id: 'vegetal_bandage',
  name: STRINGS.EQ_BANDAGE,
  type: 'utility',
  minDie: 1,
  maxDie: 4,
  effect: (die) => ({ ...NO_EFFECT, heal: die }),
  description: STRINGS.EFF_BANDAGE,
};

/** Racine Amère — full-range utility, split damage + shield */
export const BITTER_ROOT: Equipment = {
  id: 'bitter_root',
  name: STRINGS.EQ_RACINE_AMERE,
  type: 'utility',
  minDie: 1,
  maxDie: 6,
  effect: (die) => ({
    ...NO_EFFECT,
    damage: Math.ceil(die / 2),
    shield: Math.ceil(die / 2),
  }),
  description: STRINGS.EFF_RACINE_AMERE,
};

// ---------------------------------------------------------------------------
// Synergy loot pool (v6.1)
// ---------------------------------------------------------------------------

/** Lame Corrosive — die+1 dmg, doubled if target is poisoned */
export const CORROSIVE_BLADE: Equipment = {
  id: 'corrosive_blade',
  name: STRINGS.EQ_LAME_CORROSIVE,
  type: 'weapon',
  minDie: 1,
  maxDie: 6,
  effect: (die: number, ctx?: EffectContext) => ({
    ...NO_EFFECT,
    damage: ctx?.targetPoisoned ? (die + 1) * 2 : die + 1,
  }),
  description: STRINGS.EFF_LAME_CORROSIVE,
};

/** Sac à Spores — +1 poison turn (utility, no weapon slot cost) */
export const SPORE_SAC: Equipment = {
  id: 'spore_sac',
  name: STRINGS.EQ_SAC_SPORES,
  type: 'utility',
  minDie: 1,
  maxDie: 4,
  effect: () => ({ ...NO_EFFECT, poison: 1 }),
  description: STRINGS.EFF_SAC_SPORES,
};

/** Bouclier à Épines — die abs + ceil(die/3) reflect damage */
export const THORN_SHIELD: Equipment = {
  id: 'thorn_shield',
  name: STRINGS.EQ_BOUCLIER_EPINES,
  type: 'shield',
  minDie: 1,
  maxDie: 6,
  effect: (die: number) => ({
    ...NO_EFFECT,
    shield: die,
    damage: Math.ceil(die / 3),
  }),
  description: STRINGS.EFF_BOUCLIER_EPINES,
};

/** Câble Tressé — die dmg, +2 if another die is also in a weapon slot */
export const BRAIDED_CABLE: Equipment = {
  id: 'braided_cable',
  name: STRINGS.EQ_CABLE_TRESSE,
  type: 'weapon',
  minDie: 1,
  maxDie: 6,
  effect: (die: number, ctx?: EffectContext) => ({
    ...NO_EFFECT,
    damage: ctx?.otherDieInWeapon ? die + 2 : die,
  }),
  description: STRINGS.EFF_CABLE_TRESSE,
};

/** Cocktail Molotov — die damage that bypasses shields */
export const MOLOTOV: Equipment = {
  id: 'molotov',
  name: STRINGS.EQ_MOLOTOV,
  type: 'utility',
  minDie: 3,
  maxDie: 6,
  bypassShield: true,
  effect: (die: number) => ({
    ...NO_EFFECT,
    damage: die,
  }),
  description: STRINGS.EFF_MOLOTOV,
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
