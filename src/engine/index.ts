/**
 * V6 equipment-based combat engine — barrel export.
 * Pure TypeScript, zero rendering dependencies.
 */

// Types
export type {
  EquipmentType,
  EquipmentEffect,
  Equipment,
  Survivor,
  Enemy,
  Allocation,
  AllocationPattern,
  Strategy,
  CombatResult,
  RunResult,
  EventStrategy,
} from './types';

// Dice
export { rollDie, rollDice, canUseDie } from './dice';

// Allocation
export { allocateOptimal, allocateEnemy } from './allocation';

// Combat
export { simulateCombat } from './combat';

// Run
export { simulateRun } from './run';
