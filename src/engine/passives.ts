/**
 * Passive ability system — pure functions, zero Pixi imports.
 *
 * Each survivor has a unique passive that modifies combat.
 * All functions are stateless transforms on PassiveState.
 */

import type {
  PassiveId,
  PassiveState,
  Allocation,
  Equipment,
  EffectContext,
} from './types';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createPassiveState(): PassiveState {
  return {
    rempartCarryShield: 0,
    elanActive: false,
    elanBoostedCombat: false,
    currentRound: 0,
    recycleurUsed: false,
    tropheeStacks: 0,
    tropheeRoundsLeft: [],
  };
}

// ---------------------------------------------------------------------------
// Inter-combat reset
// ---------------------------------------------------------------------------

/**
 * Reset passive state between combats.
 * Carries over: elan activation (from previous speed kill), trophee stacks.
 */
export function resetPassiveForCombat(
  state: PassiveState,
  prevSpeedKill: boolean,
  hpRatio: number,
  hasTrophy: boolean,
): PassiveState {
  const next = createPassiveState();
  // Elan: active if previous combat was a speed kill AND HP > 50%
  // No-chain rule: Élan cannot activate from an Élan-boosted speed kill
  next.elanActive = prevSpeedKill && hpRatio > 0.5 && !state.elanBoostedCombat;
  // Trophee: add stack if speed kill + has trophy equipment
  if (prevSpeedKill && hasTrophy) {
    next.tropheeStacks = Math.min(2, state.tropheeStacks + 1);
    next.tropheeRoundsLeft = [
      ...state.tropheeRoundsLeft.filter(r => r > 0),
      3,
    ].slice(-2);
  } else {
    next.tropheeStacks = state.tropheeStacks;
    next.tropheeRoundsLeft = [...state.tropheeRoundsLeft];
  }
  return next;
}

// ---------------------------------------------------------------------------
// Recycleur — deterministic +1 to a die showing 1 (1x/combat)
// ---------------------------------------------------------------------------

export function applyRecycleur(
  dice: number[],
  passiveId: PassiveId | undefined,
  state: PassiveState,
): number[] {
  if (passiveId !== 'recycleur' || state.recycleurUsed) return dice;

  // Find first die showing exactly 1
  const targetIdx = dice.indexOf(1);
  if (targetIdx === -1) return dice;

  state.recycleurUsed = true;
  const result = [...dice];
  result[targetIdx] = 2; // deterministic: 1 + 1 = 2
  return result;
}

// ---------------------------------------------------------------------------
// EffectContext builder — per allocation
// ---------------------------------------------------------------------------

export function computeEffectContext(
  alloc: Allocation,
  allAllocations: readonly Allocation[],
  equipment: readonly Equipment[],
  enemyPoisoned: boolean,
): EffectContext {
  const eq = equipment[alloc.equipmentIndex];
  const otherDieInWeapon = eq.type === 'weapon' && allAllocations.some(
    a => a !== alloc
      && equipment[a.equipmentIndex].type === 'weapon',
  );
  return {
    targetPoisoned: enemyPoisoned,
    otherDieInWeapon,
  };
}

// ---------------------------------------------------------------------------
// Survivant — +1 weapon dmg when HP < 40%
// ---------------------------------------------------------------------------

export function applySurvivant(
  passiveId: PassiveId | undefined,
  playerHp: number,
  maxHp: number,
  damageToEnemy: number,
  playerUsedWeapon: boolean,
): number {
  if (passiveId !== 'survivant') return damageToEnemy;
  if (!playerUsedWeapon) return damageToEnemy;
  if (playerHp / maxHp >= 0.4) return damageToEnemy;
  return damageToEnemy + 1;
}

// ---------------------------------------------------------------------------
// Rempart — excess shield carries +1 to next round
// ---------------------------------------------------------------------------

export function computeRempartCarry(
  passiveId: PassiveId | undefined,
  playerShieldTotal: number,
  rawEnemyDmg: number,
  playerHp: number,
  playerMaxHp: number,
): number {
  if (passiveId !== 'rempart') return 0;
  // HP gate: only activates when HP > 50%
  if (playerHp / playerMaxHp <= 0.5) return 0;
  const excess = playerShieldTotal - rawEnemyDmg;
  return excess > 0 ? 1 : 0;
}

// ---------------------------------------------------------------------------
// Ingenieux — +1 to weakest effect if 2+ equipment types used
// ---------------------------------------------------------------------------

export function applyIngenieux(
  passiveId: PassiveId | undefined,
  allocations: readonly Allocation[],
  equipment: readonly Equipment[],
): { bonusDmg: number; bonusShield: number } {
  const none = { bonusDmg: 0, bonusShield: 0 };
  if (passiveId !== 'ingenieux') return none;

  const types = new Set<string>();
  for (const a of allocations) {
    types.add(equipment[a.equipmentIndex].type);
  }
  if (types.size < 2) return none;

  // Find weakest: compute total damage and total shield
  let totalDmg = 0;
  let totalShield = 0;
  for (const a of allocations) {
    const eq = equipment[a.equipmentIndex];
    const eff = eq.effect(a.dieValue);
    totalDmg += eff.damage;
    totalShield += eff.shield;
  }

  // +1 to the weaker axis
  if (totalDmg <= totalShield) {
    return { bonusDmg: 1, bonusShield: 0 };
  }
  return { bonusDmg: 0, bonusShield: 1 };
}

// ---------------------------------------------------------------------------
// Trophee stacks — tick down, remove expired
// ---------------------------------------------------------------------------

export function tickTropheeStacks(state: PassiveState): void {
  for (let i = state.tropheeRoundsLeft.length - 1; i >= 0; i--) {
    state.tropheeRoundsLeft[i]--;
    if (state.tropheeRoundsLeft[i] <= 0) {
      state.tropheeRoundsLeft.splice(i, 1);
      state.tropheeStacks = Math.max(0, state.tropheeStacks - 1);
    }
  }
}
