/**
 * V6 equipment-based combat engine — barrel export.
 * Pure TypeScript, zero rendering dependencies.
 */

// Types
export type {
  EquipmentType,
  EquipmentEffect,
  EffectContext,
  Equipment,
  Survivor,
  Enemy,
  Allocation,
  AllocationPattern,
  Strategy,
  CombatResult,
  RunResult,
  EventStrategy,
  PassiveId,
  PassiveState,
} from './types';

// Dice
export { rollDie, rollDice, canUseDie } from './dice';

// Allocation
export { allocateOptimal, allocateEnemy } from './allocation';

// Combat
export { simulateCombat, resolveRound, sumAllocEffects } from './combat';
export type { RoundOutcome } from './combat';

// Run
export { simulateRun } from './run';

// Passives
export {
  createPassiveState,
  resetPassiveForCombat,
  applyRecycleur,
  computeEffectContext,
  applySurvivant,
  computeRempartCarry,
  applyIngenieux,
  tickTropheeStacks,
} from './passives';
