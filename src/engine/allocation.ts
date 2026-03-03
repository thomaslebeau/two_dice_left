/**
 * Dice-to-equipment allocation logic for the v6 engine.
 *
 * Core mechanic: given 2 dice and N equipment slots, find the best
 * placement. Tries all valid permutations and picks the highest-scoring one.
 * Pure functions — no side effects, no mutation.
 */

import type {
  Equipment,
  Allocation,
  Strategy,
  AllocationPattern,
  EquipmentEffect,
} from './types';
import { canUseDie } from './dice';

// ---------------------------------------------------------------------------
// Scoring weights per strategy
// ---------------------------------------------------------------------------

interface StrategyWeights {
  damage: number;
  shield: number;
  heal: number;
  poison: number;
}

const STRATEGY_WEIGHTS: Record<Exclude<Strategy, 'smart'>, StrategyWeights> = {
  aggressive: { damage: 3, shield: 0.5, heal: 0.5, poison: 2 },
  // Defensive over-indexes on shield, sacrificing damage output.
  // With asymmetric min-1, player always chips through — but defensive
  // wastes dice on shields instead of finishing fights fast.
  defensive:  { damage: 0.2, shield: 3, heal: 2, poison: 0.2 },
  random:     { damage: 1, shield: 1, heal: 1, poison: 1 },
};

/** Score a set of effects against strategy weights */
function scoreEffects(
  effects: readonly EquipmentEffect[],
  weights: StrategyWeights,
): number {
  let total = 0;
  for (const e of effects) {
    total += e.damage * weights.damage
           + e.shield * weights.shield
           + e.heal * weights.heal
           + e.poison * weights.poison;
  }
  return total;
}

// ---------------------------------------------------------------------------
// Permutation engine
// ---------------------------------------------------------------------------

/**
 * Generate all valid ways to assign `dice` to `equipment` slots.
 * Each die can go to at most one slot. Each slot accepts at most one die.
 * Returns arrays of Allocation (may be shorter than dice.length if
 * some dice have no valid slot).
 */
function generatePermutations(
  dice: readonly number[],
  equipment: readonly Equipment[],
): Allocation[][] {
  const results: Allocation[][] = [];
  const usedSlots = new Set<number>();
  const current: Allocation[] = [];

  function recurse(dieIdx: number): void {
    if (dieIdx >= dice.length) {
      results.push([...current]);
      return;
    }

    const dieValue = dice[dieIdx];
    let placed = false;

    for (let eqIdx = 0; eqIdx < equipment.length; eqIdx++) {
      if (usedSlots.has(eqIdx)) continue;
      if (!canUseDie(equipment[eqIdx], dieValue)) continue;

      usedSlots.add(eqIdx);
      current.push({ equipmentIndex: eqIdx, dieValue });
      recurse(dieIdx + 1);
      current.pop();
      usedSlots.delete(eqIdx);
      placed = true;
    }

    // Only skip this die if it couldn't be placed anywhere
    if (!placed) {
      recurse(dieIdx + 1);
    }
  }

  recurse(0);
  return results;
}

/**
 * Resolve smart strategy to concrete weights based on HP state.
 * Key insight: smart always values BOTH damage and defense, just
 * shifts emphasis. This makes it strictly better than single-axis
 * strategies (aggressive ignores defense, defensive ignores damage).
 *
 * - Enemy HP ≤ 4 → finish them off (burst)
 * - HP > 60% → lean aggressive but still value shields
 * - HP 30–60% → balanced, slight damage preference
 * - HP < 30% → lean defensive but still value damage
 */
function resolveSmartWeights(
  currentHp: number,
  maxHp: number,
  enemyHp: number,
): StrategyWeights {
  // Low enemy HP: go for the kill
  if (enemyHp <= 4) {
    return { damage: 4, shield: 0.5, heal: 0.5, poison: 1 };
  }

  const hpRatio = currentHp / maxHp;

  if (hpRatio > 0.6) {
    // Healthy: prioritize damage but keep some shield value
    return { damage: 3, shield: 1.5, heal: 0.5, poison: 2 };
  }
  if (hpRatio < 0.3) {
    // Critical: prioritize survival but still deal damage
    return { damage: 1.5, shield: 2.5, heal: 3, poison: 1 };
  }
  // Mid HP: balanced with slight damage preference
  return { damage: 2.5, shield: 2, heal: 1.5, poison: 1.5 };
}

/** Pick the allocation set with the highest score */
function pickBest(
  permutations: Allocation[][],
  equipment: readonly Equipment[],
  weights: StrategyWeights,
): Allocation[] {
  let bestScore = -Infinity;
  let bestAlloc: Allocation[] = [];

  for (const alloc of permutations) {
    const effects = alloc.map(a =>
      equipment[a.equipmentIndex].effect(a.dieValue),
    );
    const score = scoreEffects(effects, weights);
    if (score > bestScore) {
      bestScore = score;
      bestAlloc = alloc;
    }
  }

  return bestAlloc;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Find the optimal allocation for a player given dice and equipment.
 * Tries all valid (die → equipment) permutations and picks the
 * highest-scoring one based on strategy weights.
 *
 * @param dice - Array of die values (typically 2)
 * @param equipment - Player's equipment slots
 * @param strategy - Allocation strategy
 * @param currentHp - Player's current HP (for smart strategy)
 * @param maxHp - Player's max HP (for smart strategy)
 * @param enemyHp - Enemy's current HP (for smart strategy)
 * @returns Array of allocations (die → slot assignments)
 */
export function allocateOptimal(
  dice: readonly number[],
  equipment: readonly Equipment[],
  strategy: Strategy,
  currentHp: number,
  maxHp: number,
  enemyHp: number,
): Allocation[] {
  if (dice.length === 0 || equipment.length === 0) return [];

  const permutations = generatePermutations(dice, equipment);
  if (permutations.length === 0) return [];

  if (strategy === 'random') {
    return permutations[Math.floor(Math.random() * permutations.length)];
  }

  const weights = strategy === 'smart'
    ? resolveSmartWeights(currentHp, maxHp, enemyHp)
    : STRATEGY_WEIGHTS[strategy];

  return pickBest(permutations, equipment, weights);
}

/**
 * Auto-allocate dice for an enemy based on its pattern.
 * Uses the same permutation engine but with pattern-derived weights.
 *
 * @param dice - Array of die values (typically 2)
 * @param equipment - Enemy's equipment slots
 * @param pattern - Enemy's allocation pattern
 * @returns Array of allocations
 */
export function allocateEnemy(
  dice: readonly number[],
  equipment: readonly Equipment[],
  pattern: AllocationPattern,
): Allocation[] {
  if (dice.length === 0 || equipment.length === 0) return [];

  const permutations = generatePermutations(dice, equipment);
  if (permutations.length === 0) return [];

  const patternWeights: Record<AllocationPattern, StrategyWeights> = {
    aggressive: { damage: 3, shield: 0.5, heal: 0, poison: 2 },
    defensive:  { damage: 0.5, shield: 3, heal: 0, poison: 0.5 },
    neutral:    { damage: 1.5, shield: 1.5, heal: 0, poison: 1 },
  };

  // Add randomness: 70% optimal, 30% random for non-neutral patterns
  if (pattern !== 'neutral' && Math.random() < 0.3) {
    return permutations[Math.floor(Math.random() * permutations.length)];
  }

  return pickBest(permutations, equipment, patternWeights[pattern]);
}
