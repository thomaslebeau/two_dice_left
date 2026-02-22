/**
 * V5 simulation strategies: dice allocation + event choice.
 *
 * AllocationStrategy decides how to assign 2 rolled dice to ATK/DEF.
 * EventStrategy decides which event choice to pick between combats.
 */
import type { GameEvent } from '../types/event.types.ts';
import type { DiceModifier } from '../types/diceModifier.types.ts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AllocationStrategy =
  | 'aggressive'    // always max die → ATK
  | 'defensive'     // always max die → DEF
  | 'hpThreshold'   // aggressive above 50% HP, defensive below
  | 'killPressure'  // aggressive when enemy HP < expected 2-round kill
  | 'random';       // 50/50 (baseline floor)

export type EventStrategy =
  | 'alwaysHp'      // always pick HP repair
  | 'alwaysAtk'     // always pick ATK boost
  | 'alwaysDef'     // always pick DEF boost
  | 'balanced'      // pick what's most needed based on current state
  | 'diceHunter'    // always pick dice modifiers when available
  | 'random';       // random choice

export interface AllocationResult {
  atkDie: number;
  defDie: number;
}

export interface SimRunState {
  hp: number;
  maxHp: number;
  atkBonus: number;
  defBonus: number;
  diceModifiers: DiceModifier[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const ALL_ALLOCATION_STRATEGIES: AllocationStrategy[] = [
  'aggressive', 'defensive', 'hpThreshold', 'killPressure', 'random',
];

export const ALL_EVENT_STRATEGIES: EventStrategy[] = [
  'alwaysHp', 'alwaysAtk', 'alwaysDef', 'balanced', 'diceHunter', 'random',
];

// ---------------------------------------------------------------------------
// Dice allocation
// ---------------------------------------------------------------------------

export function allocate(
  dice: [number, number],
  strategy: AllocationStrategy,
  currentHP: number,
  maxHP: number,
  enemyHP: number,
  _enemyAtkMod: number,
): AllocationResult {
  const [d1, d2] = dice;
  const high = Math.max(d1, d2);
  const low = Math.min(d1, d2);

  switch (strategy) {
    case 'aggressive':
      return { atkDie: high, defDie: low };

    case 'defensive':
      return { atkDie: low, defDie: high };

    case 'hpThreshold':
      return (currentHP / maxHP > 0.5)
        ? { atkDie: high, defDie: low }
        : { atkDie: low, defDie: high };

    case 'killPressure': {
      // If we can kill enemy in ~2 rounds with aggressive play, go aggro
      const expectedDmg = high;
      return (enemyHP <= expectedDmg * 2)
        ? { atkDie: high, defDie: low }
        : { atkDie: low, defDie: high };
    }

    case 'random':
      return Math.random() > 0.5
        ? { atkDie: d1, defDie: d2 }
        : { atkDie: d2, defDie: d1 };
  }
}

// ---------------------------------------------------------------------------
// Event choice
// ---------------------------------------------------------------------------

/**
 * Find the best choice index matching a predicate on effects.
 * Returns 0 as fallback if no match found.
 */
function findChoiceWithEffect(
  event: GameEvent,
  predicate: (type: string, value: number, modifierId?: string) => boolean,
): number {
  const idx = event.choices.findIndex(c =>
    c.effects.some(e => predicate(e.type, e.value, e.modifierId))
  );
  return idx >= 0 ? idx : 0;
}

export function chooseEvent(
  event: GameEvent,
  strategy: EventStrategy,
  runState: SimRunState,
): number {
  switch (strategy) {
    case 'alwaysHp':
      return findChoiceWithEffect(event, (type, value) => type === 'hp' && value > 0);

    case 'alwaysAtk':
      return findChoiceWithEffect(event, (type, value) => type === 'atk' && value > 0);

    case 'alwaysDef':
      return findChoiceWithEffect(event, (type, value) => type === 'def' && value > 0);

    case 'diceHunter':
      return findChoiceWithEffect(event, (type) => type === 'diceModifier');

    case 'balanced': {
      // Pick HP if below 50%, otherwise ATK
      const hpRatio = runState.hp / runState.maxHp;
      if (hpRatio < 0.5) return chooseEvent(event, 'alwaysHp', runState);
      return chooseEvent(event, 'alwaysAtk', runState);
    }

    case 'random':
      return Math.floor(Math.random() * event.choices.length);
  }
}
