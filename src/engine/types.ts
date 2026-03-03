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

/** Context for synergy equipment effects (Corrosive Blade, Braided Cable) */
export interface EffectContext {
  readonly targetPoisoned?: boolean;
  readonly otherDieInWeapon?: boolean;
}

/** Equipment definition — the core building block of v6 */
export interface Equipment {
  readonly id: string;
  readonly name: string;
  readonly type: EquipmentType;
  readonly minDie: number;
  readonly maxDie: number;
  /** Pure function: die value in → effect out */
  readonly effect: (dieValue: number, context?: EffectContext) => EquipmentEffect;
  readonly description: string;
  /** If true, equipment has no die slot — effect applied via PassiveState */
  readonly isPassive?: boolean;
}

// ---------------------------------------------------------------------------
// Combatants
// ---------------------------------------------------------------------------

export type PassiveId = 'survivant' | 'rempart' | 'ingenieux' | 'elan' | 'recycleur';

export interface PassiveState {
  rempartCarryShield: number;
  elanActive: boolean;
  /** True if this combat was Élan-boosted (used for no-chain rule) */
  elanBoostedCombat: boolean;
  currentRound: number;
  recycleurUsed: boolean;
  tropheeStacks: number;
  tropheeRoundsLeft: number[];
}

export interface Survivor {
  readonly id: number;
  readonly name: string;
  readonly hp: number;
  readonly maxHp: number;
  readonly equipment: readonly Equipment[];
  readonly passive?: PassiveId;
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
  readonly passiveState?: PassiveState;
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
