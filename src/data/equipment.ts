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

/** Rusty Blade — baseline weapon, die+1 damage */
export const RUSTY_BLADE: Equipment = {
  id: 'rusty_blade',
  name: 'Lame Rouillée',
  type: 'weapon',
  minDie: 1,
  maxDie: 6,
  effect: (die) => ({ ...NO_EFFECT, damage: die + 1 }),
  description: 'de+1 dmg',
};

/** Scrap Shield — baseline shield, die+1 absorption */
export const SCRAP_SHIELD: Equipment = {
  id: 'scrap_shield',
  name: 'Bouclier de Ferraille',
  type: 'shield',
  minDie: 1,
  maxDie: 6,
  effect: (die) => ({ ...NO_EFFECT, shield: die + 1 }),
  description: 'de+1 abs',
};

/** Sharp Knife — glass cannon weapon, die+2 damage */
export const SHARP_KNIFE: Equipment = {
  id: 'sharp_knife',
  name: 'Couteau Aiguise',
  type: 'weapon',
  minDie: 1,
  maxDie: 6,
  effect: (die) => ({ ...NO_EFFECT, damage: die + 2 }),
  description: 'de+2 dmg',
};

/** Twin Spike — low-range weapon, die+2 damage */
export const TWIN_SPIKE: Equipment = {
  id: 'twin_spike',
  name: 'Double Pointe',
  type: 'weapon',
  minDie: 1,
  maxDie: 4,
  effect: (die) => ({ ...NO_EFFECT, damage: die + 2 }),
  description: 'de+2 dmg',
};

/** Heavy Wrench — high-range weapon, die+2 damage */
export const HEAVY_WRENCH: Equipment = {
  id: 'heavy_wrench',
  name: 'Cle Lourde',
  type: 'weapon',
  minDie: 4,
  maxDie: 6,
  effect: (die) => ({ ...NO_EFFECT, damage: die + 2 }),
  description: 'de+2 dmg',
};

/** Sharpened Fork — low-range weapon, die+1 damage */
export const SHARPENED_FORK: Equipment = {
  id: 'sharpened_fork',
  name: 'Fourche Affutee',
  type: 'weapon',
  minDie: 1,
  maxDie: 3,
  effect: (die) => ({ ...NO_EFFECT, damage: die + 1 }),
  description: 'de+1 dmg',
};

/** Reinforced Door — high-range shield, die+1 absorption */
export const REINFORCED_DOOR: Equipment = {
  id: 'reinforced_door',
  name: 'Porte Blindee',
  type: 'shield',
  minDie: 3,
  maxDie: 6,
  effect: (die) => ({ ...NO_EFFECT, shield: die + 1 }),
  description: 'de+1 abs',
};

/** Light Guard — full-range shield, die+1 absorption */
export const LIGHT_GUARD: Equipment = {
  id: 'light_guard',
  name: 'Garde Legere',
  type: 'shield',
  minDie: 1,
  maxDie: 6,
  effect: (die) => ({ ...NO_EFFECT, shield: die + 1 }),
  description: 'de+1 abs',
};

/** Repair Kit — narrow-range utility, ceil(die/2)+1 heal */
export const REPAIR_KIT: Equipment = {
  id: 'repair_kit',
  name: 'Kit de Reparation',
  type: 'utility',
  minDie: 1,
  maxDie: 2,
  effect: (die) => ({ ...NO_EFFECT, heal: Math.ceil(die / 2) + 1 }),
  description: 'soin de+1',
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
  description: 'de+3 dmg',
};

/** Poison Needle — 1 damage + 1 poison turn (always) */
export const POISON_NEEDLE: Equipment = {
  id: 'poison_needle',
  name: 'Aiguille Empoisonnee',
  type: 'weapon',
  minDie: 1,
  maxDie: 6,
  effect: () => ({
    ...NO_EFFECT,
    damage: 1,
    poison: 1,
  }),
  description: '1 dmg + 1 tour de poison',
};

/** Serrated Edge — mid-range weapon, die+1 damage */
export const SERRATED_EDGE: Equipment = {
  id: 'serrated_edge',
  name: 'Lame Crantee',
  type: 'weapon',
  minDie: 2,
  maxDie: 5,
  effect: (die) => ({ ...NO_EFFECT, damage: die + 1 }),
  description: 'de+1 dmg',
};

/** Glass Shard — die damage, DOUBLE on 5-6 */
export const GLASS_SHARD: Equipment = {
  id: 'glass_shard',
  name: 'Eclat de Verre',
  type: 'weapon',
  minDie: 1,
  maxDie: 6,
  effect: (die) => ({
    ...NO_EFFECT,
    damage: die >= 5 ? die * 2 : die,
  }),
  description: 'de dmg (x2 si 5-6)',
};

/** Thick Bark — mid-range shield, die+1 absorption */
export const THICK_BARK: Equipment = {
  id: 'thick_bark',
  name: 'Ecorce Epaisse',
  type: 'shield',
  minDie: 2,
  maxDie: 6,
  effect: (die) => ({ ...NO_EFFECT, shield: die + 1 }),
  description: 'de+1 abs',
};

/** Mirror Plate — high-range shield, die+2 absorption + 1 reflect */
export const MIRROR_PLATE: Equipment = {
  id: 'mirror_plate',
  name: 'Plaque Miroir',
  type: 'shield',
  minDie: 4,
  maxDie: 6,
  effect: (die) => ({ ...NO_EFFECT, shield: die + 2, damage: 1 }),
  description: 'de+2 abs + 1 renvoi',
};

/** Bandage Wrap — low-range utility, heal = die value */
export const BANDAGE_WRAP: Equipment = {
  id: 'bandage_wrap',
  name: 'Bandage Vegetal',
  type: 'utility',
  minDie: 1,
  maxDie: 4,
  effect: (die) => ({ ...NO_EFFECT, heal: die }),
  description: 'soin de PV',
};

/** Adrenaline Root — full-range utility, split damage + shield */
export const ADRENALINE_ROOT: Equipment = {
  id: 'adrenaline_root',
  name: 'Racine Adrenaline',
  type: 'utility',
  minDie: 1,
  maxDie: 6,
  effect: (die) => ({
    ...NO_EFFECT,
    damage: Math.ceil(die / 2),
    shield: Math.ceil(die / 2),
  }),
  description: 'de/2 dmg + de/2 abs',
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
  description: 'de+1 dmg (x2 si poison)',
};

/** Sac a Spores — +1 poison turn (utility, no weapon slot cost) */
export const SPORE_SAC: Equipment = {
  id: 'spore_sac',
  name: 'Sac a Spores',
  type: 'utility',
  minDie: 1,
  maxDie: 4,
  effect: () => ({ ...NO_EFFECT, poison: 1 }),
  description: '+1 poison',
};

/** Bouclier a Epines — die/2 absorption + die/2 reflect damage */
export const THORN_SHIELD: Equipment = {
  id: 'thorn_shield',
  name: 'Bouclier a Epines',
  type: 'shield',
  minDie: 1,
  maxDie: 6,
  effect: (die: number) => ({
    ...NO_EFFECT,
    shield: Math.floor(die / 2),
    damage: Math.floor(die / 2),
  }),
  description: 'de/2 abs + de/2 renvoi',
};

/** Cable Tresse — die dmg, +2 if another die is also in a weapon slot */
export const BRAIDED_CABLE: Equipment = {
  id: 'braided_cable',
  name: 'Cable Tresse',
  type: 'weapon',
  minDie: 1,
  maxDie: 6,
  effect: (die: number, ctx?: EffectContext) => ({
    ...NO_EFFECT,
    damage: ctx?.otherDieInWeapon ? die + 2 : die,
  }),
  description: 'de dmg (+2 si duo arme)',
};

/** Trophee Rouille — passive: +1 dmg for 3 rounds after speed kill (cap 2) */
export const RUSTY_TROPHY: Equipment = {
  id: 'rusty_trophy',
  name: 'Trophee Rouille',
  type: 'utility',
  minDie: 1,
  maxDie: 6,
  isPassive: true,
  effect: () => NO_EFFECT,
  description: '+1 dmg/3 tours apres speed kill',
};

// ---------------------------------------------------------------------------
// Aggregates
// ---------------------------------------------------------------------------

/** All loot equipment available from events (13 items) */
export const ALL_LOOT: readonly Equipment[] = [
  HEAVY_HAMMER,
  POISON_NEEDLE,
  SERRATED_EDGE,
  GLASS_SHARD,
  THICK_BARK,
  MIRROR_PLATE,
  BANDAGE_WRAP,
  ADRENALINE_ROOT,
  CORROSIVE_BLADE,
  SPORE_SAC,
  THORN_SHIELD,
  BRAIDED_CABLE,
  RUSTY_TROPHY,
];
