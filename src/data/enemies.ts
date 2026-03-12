/**
 * Enemy definitions for v6.
 * Each enemy has equipment-based combat (weapons + shields).
 * Factory functions keep enemy equipment separate from player instances.
 *
 * Combat tier config defines pool selection + HP multipliers per combat.
 */

import type { Equipment, EquipmentEffect, Enemy, AllocationPattern } from '../engine/types';
import { STRINGS } from './strings';

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
  const desc = bonus > 0 ? `de+${bonus} dmg` : 'de dmg';
  return {
    id: `enemy_${name.toLowerCase().replace(/\s+/g, '_')}`,
    name,
    type: 'weapon',
    minDie,
    maxDie,
    effect: (die) => ({ ...NO_EFFECT, damage: die + bonus }),
    description: desc,
  };
}

/** Create an enemy shield: die + bonus absorption */
function enemyShield(
  name: string,
  minDie: number,
  maxDie: number,
  bonus: number,
): Equipment {
  const desc = bonus > 0 ? `de+${bonus} abs` : 'de abs';
  return {
    id: `enemy_${name.toLowerCase().replace(/\s+/g, '_')}`,
    name,
    type: 'shield',
    minDie,
    maxDie,
    effect: (die) => ({ ...NO_EFFECT, shield: die + bonus }),
    description: desc,
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

/** E1 — Sécateur Rampant: basic neutral, Griffe + Carapace */
export const SECATEUR_RAMPANT = createEnemy(1, STRINGS.ENEMY_SECATEUR, 8, [
  enemyWeapon('Griffe', 1, 6, 0),
  enemyShield('Carapace', 1, 6, 0),
], 'neutral');

/** E2 — Lampe Épineuse: aggressive, Pointe(+1) + Étincelle */
export const LAMPE_EPINEUSE = createEnemy(2, STRINGS.ENEMY_LAMPE, 6, [
  enemyWeapon('Pointe', 1, 6, 1),
  enemyWeapon('Étincelle', 1, 3, 0),
], 'aggressive');

/** E3 — Fourchette Vrille: neutral, Dent + Garde */
export const FOURCHETTE_VRILLE = createEnemy(3, STRINGS.ENEMY_FOURCHETTE, 5, [
  enemyWeapon('Dent', 1, 6, 0),
  enemyShield('Garde', 1, 4, 0),
], 'neutral');

/** E4 — Ventilateur Griffe: aggressive, Lame(+2) + Entaille */
export const VENTILATEUR_GRIFFE = createEnemy(4, STRINGS.ENEMY_VENTILATEUR, 10, [
  enemyWeapon('Lame', 1, 6, 2),
  enemyWeapon('Entaille', 3, 6, 0),
], 'aggressive');

/** E5 — Radiateur Mousse: defensive, Choc + Blindage(+2) */
export const RADIATEUR_MOUSSE = createEnemy(5, STRINGS.ENEMY_RADIATEUR, 14, [
  enemyWeapon('Choc', 1, 4, 0),
  enemyShield('Blindage', 1, 6, 2),
], 'defensive');

/** E6 — Tronçonneuse Lierre: aggressive, Chaîne(+2) + Écorce absorb */
export const TRONCONNEUSE_LIERRE = createEnemy(6, STRINGS.ENEMY_TRONCONNEUSE, 10, [
  enemyWeapon('Chaîne', 1, 6, 2),
  enemyShield('Écorce', 3, 6, 0),
], 'aggressive');

/** E7 — Frigo Mâchoire: defensive, Mâchoire + Coque(+2) */
export const FRIGO_MACHOIRE = createEnemy(7, STRINGS.ENEMY_FRIGO, 12, [
  enemyWeapon('Mâchoire', 1, 6, 0),
  enemyShield('Coque', 2, 6, 2),
], 'defensive');

/** E8 — Voiture-Racine (boss): neutral, Bélier(+2) + Châssis(+2) */
export const VOITURE_RACINE = createEnemy(8, STRINGS.ENEMY_VOITURE, 14, [
  enemyWeapon('Bélier', 3, 6, 2),
  enemyShield('Châssis', 2, 6, 2),
], 'neutral');

/** E9 — Grue Tentacule (boss): aggressive, Fouet(+2) + Broyeur(+1) */
export const GRUE_TENTACULE = createEnemy(9, STRINGS.ENEMY_GRUE, 13, [
  enemyWeapon('Fouet', 1, 6, 2),
  enemyWeapon('Broyeur', 4, 6, 1),
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
