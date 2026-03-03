/**
 * Combat simulation for the v6 equipment-based engine.
 *
 * Resolution is simultaneous per round:
 * 1. Both sides roll 2d6 and allocate to equipment slots
 * 2. Compute weapon effects, shield effects, utility effects
 * 3. Player damage = sum(weapon effects) - sum(enemy shields), min 1 if any weapon used
 * 4. Enemy damage = sum(enemy weapons) - sum(player shields), NO min 1 (asymmetric)
 * 5. Apply poison ticks, then heals
 * 6. Check for death
 *
 * Pure function — no side effects, no mutation of inputs.
 */

import type {
  Equipment,
  Allocation,
  EquipmentEffect,
  CombatResult,
  Strategy,
  AllocationPattern,
} from './types';
import { rollDice } from './dice';
import { allocateOptimal, allocateEnemy } from './allocation';

const MAX_ROUNDS = 30;
const SPEED_KILL_THRESHOLD = 3;
const SPEED_KILL_RECOVERY = 3;

// ---------------------------------------------------------------------------
// Effect resolution helpers
// ---------------------------------------------------------------------------

/** Collect effects from allocations grouped by equipment type */
function resolveEffects(
  allocations: readonly Allocation[],
  equipment: readonly Equipment[],
): { weapons: EquipmentEffect[]; shields: EquipmentEffect[]; utilities: EquipmentEffect[] } {
  const weapons: EquipmentEffect[] = [];
  const shields: EquipmentEffect[] = [];
  const utilities: EquipmentEffect[] = [];

  for (const alloc of allocations) {
    const eq = equipment[alloc.equipmentIndex];
    const effect = eq.effect(alloc.dieValue);

    switch (eq.type) {
      case 'weapon': weapons.push(effect); break;
      case 'shield': shields.push(effect); break;
      case 'utility': utilities.push(effect); break;
    }
  }

  return { weapons, shields, utilities };
}

function sumField(
  effects: readonly EquipmentEffect[],
  field: keyof EquipmentEffect,
): number {
  let total = 0;
  for (const e of effects) {
    total += e[field];
  }
  return total;
}

// ---------------------------------------------------------------------------
// Round resolution
// ---------------------------------------------------------------------------

export interface RoundOutcome {
  damageToEnemy: number;
  damageToPlayer: number;
  playerHeal: number;
  playerPoison: number;
  enemyPoison: number;
  playerUsedWeapon: boolean;
}

export function resolveRound(
  playerAllocations: readonly Allocation[],
  playerEquipment: readonly Equipment[],
  enemyAllocations: readonly Allocation[],
  enemyEquipment: readonly Equipment[],
): RoundOutcome {
  const player = resolveEffects(playerAllocations, playerEquipment);
  const enemy = resolveEffects(enemyAllocations, enemyEquipment);

  const playerWeaponDmg = sumField(player.weapons, 'damage');
  const playerWeaponPoison = sumField(player.weapons, 'poison');
  const playerShieldTotal = sumField(player.shields, 'shield');
  const playerHeal = sumField(player.utilities, 'heal');
  // Utility damage/shield also contribute
  const playerUtilDmg = sumField(player.utilities, 'damage');
  const playerUtilShield = sumField(player.utilities, 'shield');

  const enemyWeaponDmg = sumField(enemy.weapons, 'damage');
  const enemyWeaponPoison = sumField(enemy.weapons, 'poison');
  const enemyShieldTotal = sumField(enemy.shields, 'shield');
  const enemyUtilDmg = sumField(enemy.utilities, 'damage');
  const enemyUtilShield = sumField(enemy.utilities, 'shield');

  const totalPlayerDmg = playerWeaponDmg + playerUtilDmg;
  const totalPlayerShield = playerShieldTotal + playerUtilShield;
  const totalEnemyDmg = enemyWeaponDmg + enemyUtilDmg;
  const totalEnemyShield = enemyShieldTotal + enemyUtilShield;

  const playerUsedWeapon = player.weapons.length > 0 || playerUtilDmg > 0;

  // Asymmetric min-1 rule: player always does at least 1 if they used a weapon
  let damageToEnemy = totalPlayerDmg - totalEnemyShield;
  if (playerUsedWeapon) {
    damageToEnemy = Math.max(1, damageToEnemy);
  } else {
    damageToEnemy = Math.max(0, damageToEnemy);
  }

  // Enemy has NO min damage — player can fully block
  const damageToPlayer = Math.max(0, totalEnemyDmg - totalPlayerShield);

  return {
    damageToEnemy,
    damageToPlayer,
    playerHeal,
    playerPoison: enemyWeaponPoison + sumField(enemy.utilities, 'poison'),
    enemyPoison: playerWeaponPoison + sumField(player.utilities, 'poison'),
    playerUsedWeapon,
  };
}

/**
 * Sum a single effect field across allocations.
 * Useful for UI display (e.g. total shield, total damage).
 */
export function sumAllocEffects(
  allocations: readonly Allocation[],
  equipment: readonly Equipment[],
  field: keyof EquipmentEffect,
): number {
  let total = 0;
  for (const alloc of allocations) {
    const eq = equipment[alloc.equipmentIndex];
    if (alloc.dieValue >= eq.minDie && alloc.dieValue <= eq.maxDie) {
      total += eq.effect(alloc.dieValue)[field];
    }
  }
  return total;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Simulate a full combat between player and enemy.
 *
 * @param playerHp - Player's current HP entering combat
 * @param playerMaxHp - Player's max HP (for speed kill cap)
 * @param playerEquipment - Player's equipment loadout
 * @param enemyHp - Enemy's starting HP (after tier multiplier)
 * @param enemyEquipment - Enemy's equipment loadout
 * @param enemyPattern - Enemy's allocation AI pattern
 * @param strategy - Player's allocation strategy
 * @returns Combat result with outcome and stats
 */
export function simulateCombat(
  playerHp: number,
  playerMaxHp: number,
  playerEquipment: readonly Equipment[],
  enemyHp: number,
  enemyEquipment: readonly Equipment[],
  enemyPattern: AllocationPattern,
  strategy: Strategy,
): CombatResult {
  let pHp = playerHp;
  let eHp = enemyHp;
  let rounds = 0;
  let zeroRounds = 0;
  let playerPoisonTurns = 0;
  let enemyPoisonTurns = 0;

  while (pHp > 0 && eHp > 0 && rounds < MAX_ROUNDS) {
    rounds++;

    // Roll dice
    const playerDice = rollDice(2);
    const enemyDice = rollDice(2);

    // Allocate
    const playerAlloc = allocateOptimal(
      playerDice, playerEquipment, strategy, pHp, playerMaxHp, eHp,
    );
    const enemyAlloc = allocateEnemy(
      enemyDice, enemyEquipment, enemyPattern,
    );

    // Resolve
    const outcome = resolveRound(
      playerAlloc, playerEquipment,
      enemyAlloc, enemyEquipment,
    );

    // Apply damage (simultaneous)
    eHp -= outcome.damageToEnemy;
    pHp -= outcome.damageToPlayer;

    // Track zero-damage rounds
    if (outcome.damageToEnemy === 0 && outcome.damageToPlayer === 0) {
      zeroRounds++;
    }

    // Apply poison ticks (after damage)
    if (playerPoisonTurns > 0) {
      pHp -= 1;
      playerPoisonTurns--;
    }
    if (enemyPoisonTurns > 0) {
      eHp -= 1;
      enemyPoisonTurns--;
    }

    // Queue new poison from this round's effects
    if (outcome.playerPoison > 0) {
      playerPoisonTurns += outcome.playerPoison;
    }
    if (outcome.enemyPoison > 0) {
      enemyPoisonTurns += outcome.enemyPoison;
    }

    // Apply heal (after poison, player only from utilities)
    if (pHp > 0 && outcome.playerHeal > 0) {
      pHp = Math.min(playerMaxHp, pHp + outcome.playerHeal);
    }
  }

  const won = eHp <= 0;

  // Speed kill recovery
  let finalHp = Math.max(0, pHp);
  const speedKill = won && rounds <= SPEED_KILL_THRESHOLD;
  if (speedKill) {
    finalHp = Math.min(playerMaxHp, finalHp + SPEED_KILL_RECOVERY);
  }

  return {
    won,
    rounds,
    speedKill,
    playerHpAfter: finalHp,
    zeroRounds,
  };
}
