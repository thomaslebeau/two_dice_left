import type { DiceModifier } from '@/types/diceModifier.types.ts';

export type AllocationPattern = 'neutral' | 'aggressive' | 'defensive';

export interface AllocationResult {
  atkDie: number;
  defDie: number;
}

/**
 * Roll a single die. If modifier has custom faces, use those.
 * Standard die: uniform 1–6.
 */
export function rollDie(modifier?: DiceModifier | null): number {
  const faces = modifier?.faces ?? [1, 2, 3, 4, 5, 6];
  return faces[Math.floor(Math.random() * faces.length)];
}

/**
 * Roll 2 dice (with optional per-die modifiers).
 */
export function rollPair(
  mod1?: DiceModifier | null,
  mod2?: DiceModifier | null,
): [number, number] {
  return [rollDie(mod1), rollDie(mod2)];
}

/**
 * Auto-allocate enemy dice based on pattern.
 * - neutral:    50/50 random
 * - aggressive: 70% chance higher die → ATK
 * - defensive:  70% chance higher die → DEF
 */
export function autoAllocate(
  dice: [number, number],
  pattern: AllocationPattern,
): AllocationResult {
  const [a, b] = dice;

  // Equal dice — assignment doesn't matter
  if (a === b) {
    return { atkDie: a, defDie: b };
  }

  const high = Math.max(a, b);
  const low = Math.min(a, b);

  switch (pattern) {
    case 'aggressive': {
      const highToAtk = Math.random() < 0.7;
      return highToAtk
        ? { atkDie: high, defDie: low }
        : { atkDie: low, defDie: high };
    }
    case 'defensive': {
      const highToDef = Math.random() < 0.7;
      return highToDef
        ? { atkDie: low, defDie: high }
        : { atkDie: high, defDie: low };
    }
    case 'neutral':
    default: {
      const highToAtk = Math.random() < 0.5;
      return highToAtk
        ? { atkDie: high, defDie: low }
        : { atkDie: low, defDie: high };
    }
  }
}

/**
 * Calculate total ATK/DEF after allocation + card bonuses + event bonuses.
 * Used for damage preview in the UI.
 */
export function computeTotals(
  allocation: AllocationResult,
  cardAtkMod: number,
  cardDefMod: number,
  eventAtkBonus: number,
  eventDefBonus: number,
): { atkTotal: number; defTotal: number } {
  return {
    atkTotal: allocation.atkDie + cardAtkMod + eventAtkBonus,
    defTotal: allocation.defDie + cardDefMod + eventDefBonus,
  };
}
