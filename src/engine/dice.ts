/**
 * Dice utilities for the v6 engine.
 * Pure functions, zero dependencies except types.
 */

import type { Equipment } from './types';

/**
 * Roll a single standard d6 (1–6, uniform).
 * Uses Math.random — swap for seeded PRNG in simulations.
 */
export function rollDie(): number {
  return Math.floor(Math.random() * 6) + 1;
}

/**
 * Roll multiple d6 dice.
 * @param count - Number of dice to roll (default 2)
 */
export function rollDice(count: number = 2): number[] {
  const results: number[] = [];
  for (let i = 0; i < count; i++) {
    results.push(rollDie());
  }
  return results;
}

/**
 * Check if a die value can be placed into an equipment slot.
 * Equipment accepts dice in [minDie, maxDie] inclusive.
 */
export function canUseDie(equipment: Equipment, dieValue: number): boolean {
  return dieValue >= equipment.minDie && dieValue <= equipment.maxDie;
}
