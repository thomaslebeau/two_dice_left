/**
 * Pure type definitions for the v6 equipment-based combat engine.
 * Zero dependencies — used by all engine modules.
 */

// ---------------------------------------------------------------------------
// Equipment
// ---------------------------------------------------------------------------

export type EquipmentType = 'weapon' | 'shield' | 'utility';

/** Result of applying a die to an equipment slot */
export interface EquipmentEffect {
  damage: number;
  shield: number;
  heal: number;
  poison: number;
}

/** Equipment definition — the core building block of v6 */
export interface Equipment {
  readonly id: string;
  readonly name: string;
  readonly type: EquipmentType;
  readonly minDie: number;
  readonly maxDie: number;
  /** Pure function: die value in → effect out */
  readonly effect: (dieValue: number) => EquipmentEffect;
  readonly description: string;
}

// ---------------------------------------------------------------------------
// Combatants
// ---------------------------------------------------------------------------

export interface Survivor {
  readonly id: number;
  readonly name: string;
  readonly hp: number;
  readonly maxHp: number;
  readonly equipment: readonly Equipment[];
}

export type AllocationPattern = 'aggressive' | 'defensive' | 'neutral';

export interface Enemy {
  readonly id: number;
  readonly name: string;
  readonly hp: number;
  readonly maxHp: number;
  readonly equipment: readonly Equipment[];
  readonly pattern: AllocationPattern;
}

// ---------------------------------------------------------------------------
// Allocation
// ---------------------------------------------------------------------------

/** A single die placed into an equipment slot */
export interface Allocation {
  readonly equipmentIndex: number;
  readonly dieValue: number;
}

export type Strategy = 'aggressive' | 'defensive' | 'smart' | 'random';

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

export interface CombatResult {
  readonly won: boolean;
  readonly rounds: number;
  readonly speedKill: boolean;
  readonly playerHpAfter: number;
  readonly zeroRounds: number;
}

export interface RunResult {
  readonly won: boolean;
  readonly combatReached: number;
  readonly speedKills: number;
  readonly totalRounds: number;
  readonly finalEquipmentCount: number;
}

// ---------------------------------------------------------------------------
// Event
// ---------------------------------------------------------------------------

export type EventStrategy = 'loot' | 'heal' | 'smart';
