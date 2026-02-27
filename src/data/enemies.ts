/**
 * Enemy definitions for v6.
 * Each enemy has equipment-based combat (weapons + shields).
 * Factory functions keep enemy equipment separate from player instances.
 *
 * Combat tier config defines pool selection + HP multipliers per combat.
 */

import type { Equipment, EquipmentEffect, Enemy, AllocationPattern } from '../engine/types';

// ---------------------------------------------------------------------------
// Effect base
// ---------------------------------------------------------------------------

const NO_EFFECT: EquipmentEffect = { damage: 0, shield: 0, heal: 0, poison: 0 };

// ---------------------------------------------------------------------------
// Enemy equipment factories
// ---------------------------------------------------------------------------

/** Create an enemy weapon: die + bonus damage */
function enemyWeapon(
  name: string,
  minDie: number,
  maxDie: number,
  bonus: number,
): Equipment {
  return {
    id: `enemy_${name.toLowerCase().replace(/\s+/g, '_')}`,
    name,
    type: 'weapon',
    minDie: minDie,
    maxDie: maxDie,
    effect: (die) => ({ ...NO_EFFECT, damage: die + bonus }),
    description: `die+${bonus} damage (${minDie}-${maxDie})`,
  };
}

/** Create an enemy shield: die + bonus absorption */
function enemyShield(
  name: string,
  minDie: number,
  maxDie: number,
  bonus: number,
): Equipment {
  return {
    id: `enemy_${name.toLowerCase().replace(/\s+/g, '_')}`,
    name,
    type: 'shield',
    minDie: minDie,
    maxDie: maxDie,
    effect: (die) => ({ ...NO_EFFECT, shield: die + bonus }),
    description: `die+${bonus} absorption (${minDie}-${maxDie})`,
  };
}

// ---------------------------------------------------------------------------
// Enemy template helper
// ---------------------------------------------------------------------------

function createEnemy(
  id: number,
  name: string,
  hp: number,
  equipment: Equipment[],
  pattern: AllocationPattern,
): Enemy {
  return { id, name, hp, maxHp: hp, equipment, pattern };
}

// ---------------------------------------------------------------------------
// Enemy definitions (E1–E9)
// ---------------------------------------------------------------------------

/** E1 — Sécateur Rampant: basic neutral, Claw + Shell */
export const SECATEUR_RAMPANT = createEnemy(1, 'Sécateur Rampant', 8, [
  enemyWeapon('Claw', 1, 6, 0),
  enemyShield('Shell', 1, 6, 0),
], 'neutral');

/** E2 — Lampe Épineuse: aggressive, Spike(+1) + Spark */
export const LAMPE_EPINEUSE = createEnemy(2, 'Lampe Épineuse', 6, [
  enemyWeapon('Spike', 1, 6, 1),
  enemyWeapon('Spark', 1, 3, 0),
], 'aggressive');

/** E3 — Fourchette Vrille: neutral, Prong + Guard */
export const FOURCHETTE_VRILLE = createEnemy(3, 'Fourchette Vrille', 5, [
  enemyWeapon('Prong', 1, 6, 0),
  enemyShield('Guard', 1, 4, 0),
], 'neutral');

/** E4 — Ventilateur Griffe: aggressive, Blade(+2) + Slash */
export const VENTILATEUR_GRIFFE = createEnemy(4, 'Ventilateur Griffe', 10, [
  enemyWeapon('Blade', 1, 6, 2),
  enemyWeapon('Slash', 3, 6, 0),
], 'aggressive');

/** E5 — Radiateur Mousse: defensive, Bump + Armor(+2) */
export const RADIATEUR_MOUSSE = createEnemy(5, 'Radiateur Mousse', 14, [
  enemyWeapon('Bump', 1, 4, 0),
  enemyShield('Armor', 1, 6, 2),
], 'defensive');

/** E6 — Tronçonneuse Lierre: aggressive, Chain(+2) + Bark absorb */
export const TRONCONNEUSE_LIERRE = createEnemy(6, 'Tronçonneuse Lierre', 10, [
  enemyWeapon('Chain', 1, 6, 2),
  enemyShield('Bark', 3, 6, 0),
], 'aggressive');

/** E7 — Frigo Mâchoire: defensive, Bite + Hull(+2) */
export const FRIGO_MACHOIRE = createEnemy(7, 'Frigo Mâchoire', 12, [
  enemyWeapon('Bite', 1, 6, 0),
  enemyShield('Hull', 2, 6, 2),
], 'defensive');

/** E8 — Voiture-Racine (boss): neutral, Ram(+2) + Chassis(+2) */
export const VOITURE_RACINE = createEnemy(8, 'Voiture-Racine', 14, [
  enemyWeapon('Ram', 3, 6, 2),
  enemyShield('Chassis', 2, 6, 2),
], 'neutral');

/** E9 — Grue Tentacule (boss): aggressive, Whip(+2) + Crush(+1) */
export const GRUE_TENTACULE = createEnemy(9, 'Grue Tentacule', 13, [
  enemyWeapon('Whip', 1, 6, 2),
  enemyWeapon('Crush', 4, 6, 1),
], 'aggressive');

/** All enemy templates */
export const ENEMY_TEMPLATES: readonly Enemy[] = [
  SECATEUR_RAMPANT,
  LAMPE_EPINEUSE,
  FOURCHETTE_VRILLE,
  VENTILATEUR_GRIFFE,
  RADIATEUR_MOUSSE,
  TRONCONNEUSE_LIERRE,
  FRIGO_MACHOIRE,
  VOITURE_RACINE,
  GRUE_TENTACULE,
];

// ---------------------------------------------------------------------------
// Combat tier configuration
// ---------------------------------------------------------------------------

export interface CombatTier {
  readonly pool: readonly number[];
  readonly hpMultiplier: number;
}

/** Tier config per combat (index 0 = combat 1)
 *  HP multipliers tuned via Monte Carlo (10k iter/combo):
 *  smart 42%, aggro 41%, random 31%, defensive 25%
 *  Hierarchy: smart > aggressive > random > defensive ✓
 *  Zero-dmg rounds (smart): 0.06/combat ✓
 */
export const COMBAT_TIERS: readonly CombatTier[] = [
  { pool: [1, 2, 3],             hpMultiplier: 0.38 },  // C1: commons
  { pool: [1, 2, 3],             hpMultiplier: 0.45 },  // C2: commons
  { pool: [1, 2, 3, 4, 5, 6, 7], hpMultiplier: 0.56 },  // C3: commons+uncommons
  { pool: [1, 2, 3, 4, 5, 6, 7], hpMultiplier: 0.70 },  // C4: all except bosses
  { pool: [8, 9],                hpMultiplier: 0.84 },  // C5: bosses
];
