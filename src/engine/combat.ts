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
  EffectContext,
  CombatResult,
  Strategy,
  AllocationPattern,
  PassiveId,
  PassiveState,
} from './types';
import { rollDice } from './dice';
import { allocateOptimal, allocateEnemy } from './allocation';
import {
  createPassiveState,
  applyRecycleur,
  computeEffectContext,
  applySurvivant,
  computeRempartCarry,
  applyIngenieux,
  tickTropheeStacks,
} from './passives';

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
  contextBuilder?: (alloc: Allocation) => EffectContext,
): { weapons: EquipmentEffect[]; shields: EquipmentEffect[]; utilities: EquipmentEffect[] } {
  const weapons: EquipmentEffect[] = [];
  const shields: EquipmentEffect[] = [];
  const utilities: EquipmentEffect[] = [];

  for (const alloc of allocations) {
    const eq = equipment[alloc.equipmentIndex];
    const ctx = contextBuilder?.(alloc);
    const effect = eq.effect(alloc.dieValue, ctx);

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
  playerShieldTotal: number;
  enemyRawDmg: number;
}

/** Sum bypass damage from allocations where equipment has bypassShield */
function sumBypassDamage(
  allocations: readonly Allocation[],
  equipment: readonly Equipment[],
  contextBuilder?: (alloc: Allocation) => EffectContext,
): number {
  let total = 0;
  for (const alloc of allocations) {
    const eq = equipment[alloc.equipmentIndex];
    if (!eq.bypassShield) continue;
    const ctx = contextBuilder?.(alloc);
    total += eq.effect(alloc.dieValue, ctx).damage;
  }
  return total;
}

/** Sum normal (non-bypass) damage from utility allocations */
function sumNormalUtilDmg(
  allocations: readonly Allocation[],
  equipment: readonly Equipment[],
): number {
  let total = 0;
  for (const alloc of allocations) {
    const eq = equipment[alloc.equipmentIndex];
    if (eq.type !== 'utility' || eq.bypassShield) continue;
    total += eq.effect(alloc.dieValue).damage;
  }
  return total;
}

export function resolveRound(
  playerAllocations: readonly Allocation[],
  playerEquipment: readonly Equipment[],
  enemyAllocations: readonly Allocation[],
  enemyEquipment: readonly Equipment[],
  playerContextBuilder?: (alloc: Allocation) => EffectContext,
): RoundOutcome {
  const player = resolveEffects(playerAllocations, playerEquipment, playerContextBuilder);
  const enemy = resolveEffects(enemyAllocations, enemyEquipment);

  const playerWeaponDmg = sumField(player.weapons, 'damage');
  const playerWeaponPoison = sumField(player.weapons, 'poison');
  const playerShieldTotal = sumField(player.shields, 'shield');
  const playerHeal = sumField(player.utilities, 'heal');
  // Normal utility damage/shield (non-bypass)
  const playerNormalUtilDmg = sumNormalUtilDmg(playerAllocations, playerEquipment);
  const playerUtilShield = sumField(player.utilities, 'shield');

  // Bypass damage: not reduced by enemy shields
  const playerBypassDmg = sumBypassDamage(
    playerAllocations, playerEquipment, playerContextBuilder,
  );

  const enemyWeaponDmg = sumField(enemy.weapons, 'damage');
  const enemyWeaponPoison = sumField(enemy.weapons, 'poison');
  const enemyShieldTotal = sumField(enemy.shields, 'shield');
  const enemyUtilDmg = sumField(enemy.utilities, 'damage');
  const enemyUtilShield = sumField(enemy.utilities, 'shield');

  const totalNormalPlayerDmg = playerWeaponDmg + playerNormalUtilDmg;
  const totalPlayerShield = playerShieldTotal + playerUtilShield;
  const totalEnemyDmg = enemyWeaponDmg + enemyUtilDmg;
  const totalEnemyShield = enemyShieldTotal + enemyUtilShield;

  const playerUsedWeapon = player.weapons.length > 0
    || playerNormalUtilDmg > 0 || playerBypassDmg > 0;

  // Normal damage: reduced by enemy shields, min 1 if weapon used
  let normalDmgToEnemy = totalNormalPlayerDmg - totalEnemyShield;
  if (playerUsedWeapon) {
    normalDmgToEnemy = Math.max(1, normalDmgToEnemy);
  } else {
    normalDmgToEnemy = Math.max(0, normalDmgToEnemy);
  }

  // Total: normal + bypass (bypass not reduced by shields)
  const damageToEnemy = normalDmgToEnemy + playerBypassDmg;

  // Enemy has NO min damage — player can fully block
  const damageToPlayer = Math.max(0, totalEnemyDmg - totalPlayerShield);

  return {
    damageToEnemy,
    damageToPlayer,
    playerHeal,
    playerPoison: enemyWeaponPoison + sumField(enemy.utilities, 'poison'),
    enemyPoison: playerWeaponPoison + sumField(player.utilities, 'poison'),
    playerUsedWeapon,
    playerShieldTotal: totalPlayerShield,
    enemyRawDmg: totalEnemyDmg,
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
  contextBuilder?: (alloc: Allocation) => EffectContext,
): number {
  let total = 0;
  for (const alloc of allocations) {
    const eq = equipment[alloc.equipmentIndex];
    if (alloc.dieValue >= eq.minDie && alloc.dieValue <= eq.maxDie) {
      const ctx = contextBuilder?.(alloc);
      total += eq.effect(alloc.dieValue, ctx)[field];
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
 * @param passiveId - Survivor's passive ability (optional)
 * @param passiveState - Mutable passive state carried across rounds (optional)
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
  passiveId?: PassiveId,
  passiveState?: PassiveState,
): CombatResult {
  let pHp = playerHp;
  let eHp = enemyHp;
  let rounds = 0;
  let zeroRounds = 0;
  let playerPoisonTurns = 0;
  let enemyPoisonTurns = 0;
  let equipment = [...playerEquipment];
  const state = passiveState ?? createPassiveState();

  while (pHp > 0 && eHp > 0 && rounds < MAX_ROUNDS) {
    rounds++;
    state.currentRound = rounds;

    // Roll dice + Recycleur passive (reroll lowest 1-2)
    let playerDice = rollDice(2);
    playerDice = applyRecycleur(playerDice, passiveId, state);
    const enemyDice = rollDice(2);

    // Allocate
    const playerAlloc = allocateOptimal(
      playerDice, equipment, strategy, pHp, playerMaxHp, eHp,
    );
    const enemyAlloc = allocateEnemy(
      enemyDice, enemyEquipment, enemyPattern,
    );

    // Build context for synergy effects (Corrosive, Cable)
    const enemyPoisoned = enemyPoisonTurns > 0;
    const contextBuilder = (alloc: Allocation): EffectContext =>
      computeEffectContext(alloc, playerAlloc, equipment, enemyPoisoned);

    // Resolve with context
    const outcome = resolveRound(
      playerAlloc, equipment,
      enemyAlloc, enemyEquipment,
      contextBuilder,
    );

    // Apply passive damage modifiers
    let dmgToEnemy = outcome.damageToEnemy;

    // Survivant: +1 dmg if HP < 40%
    dmgToEnemy = applySurvivant(
      passiveId, pHp, playerMaxHp, dmgToEnemy, outcome.playerUsedWeapon,
    );

    // Ingenieux: +1 to weakest if 2+ types used
    const ingBonus = applyIngenieux(passiveId, playerAlloc, playerEquipment);
    dmgToEnemy += ingBonus.bonusDmg;
    let dmgToPlayer = outcome.damageToPlayer;
    // Ingenieux shield bonus reduces incoming damage
    dmgToPlayer = Math.max(0, dmgToPlayer - ingBonus.bonusShield);

    // Elan: +1 dmg round 1 if active (mark combat as boosted for no-chain)
    if (passiveId === 'elan' && state.elanActive && rounds === 1) {
      dmgToEnemy += 1;
      state.elanBoostedCombat = true;
    }

    // Trophee stacks: +1 dmg per active stack
    if (state.tropheeStacks > 0 && outcome.playerUsedWeapon) {
      dmgToEnemy += state.tropheeStacks;
    }

    // Rempart: apply carried shield from previous round
    if (state.rempartCarryShield > 0) {
      dmgToPlayer = Math.max(0, dmgToPlayer - state.rempartCarryShield);
      state.rempartCarryShield = 0;
    }

    // Re-apply min-1 rule after passive mods (only if weapon used)
    if (outcome.playerUsedWeapon) {
      dmgToEnemy = Math.max(1, dmgToEnemy);
    }

    // Apply damage (simultaneous)
    eHp -= dmgToEnemy;
    pHp -= dmgToPlayer;

    // Track zero-damage rounds
    if (dmgToEnemy === 0 && dmgToPlayer === 0) {
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

    // Rempart: compute carry for next round
    state.rempartCarryShield = computeRempartCarry(
      passiveId, outcome.playerShieldTotal, outcome.enemyRawDmg,
      pHp, playerMaxHp,
    );

    // Tick trophee stacks at end of round
    tickTropheeStacks(state);

    // Remove consumable equipment used this round
    const usedIndices = new Set(playerAlloc.map(a => a.equipmentIndex));
    const consumed = equipment.filter(
      (eq, idx) => eq.consumable && usedIndices.has(idx),
    );
    if (consumed.length > 0) {
      equipment = equipment.filter(
        (eq, idx) => !(eq.consumable && usedIndices.has(idx)),
      );
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
    passiveState: state,
  };
}
