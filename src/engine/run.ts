/**
 * Run simulation for the v6 equipment-based engine.
 *
 * A run = 5 combats with tier-based enemy scaling + 4 loot/heal events.
 * Imports combat.ts for individual fights. Needs external data (survivors,
 * enemies, loot pool) passed in — this module stays pure.
 */

import type {
  Survivor,
  Enemy,
  Equipment,
  RunResult,
  Strategy,
  EventStrategy,
  PassiveState,
} from './types';
import { simulateCombat } from './combat';
import { createPassiveState, resetPassiveForCombat } from './passives';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_COMBATS = 5;
const HEAL_AMOUNT = 2;

/** HP multipliers per combat tier (tuned via Monte Carlo, see sim/balance.ts) */
const HP_MULTIPLIERS: readonly number[] = [0.38, 0.45, 0.56, 0.70, 0.84];

// ---------------------------------------------------------------------------
// Enemy tier pools
// ---------------------------------------------------------------------------

/** Combat tier configuration: which enemy IDs are eligible */
interface TierConfig {
  readonly pool: readonly number[];
}

const TIER_CONFIG: readonly TierConfig[] = [
  { pool: [1, 2, 3] },           // C1: commons
  { pool: [1, 2, 3] },           // C2: commons
  { pool: [1, 2, 3, 4, 5, 6, 7] }, // C3: commons + uncommons
  { pool: [1, 2, 3, 4, 5, 6, 7] }, // C4: all except bosses
  { pool: [8, 9] },              // C5: bosses
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Pick a random enemy from the tier pool and apply HP multiplier */
function pickEnemy(
  combatIndex: number,
  enemyDatabase: readonly Enemy[],
): Enemy {
  const tier = TIER_CONFIG[combatIndex];
  const pool = enemyDatabase.filter(e => tier.pool.includes(e.id));

  if (pool.length === 0) {
    throw new Error(`No enemies in pool for combat ${combatIndex + 1}`);
  }

  const base = pool[Math.floor(Math.random() * pool.length)];
  const multiplier = HP_MULTIPLIERS[combatIndex];
  const scaledHp = Math.max(1, Math.round(base.maxHp * multiplier));

  return {
    ...base,
    hp: scaledHp,
    maxHp: scaledHp,
  };
}

/** Pick a random loot item from available pool (no repeats within a run) */
function pickLoot(
  lootPool: readonly Equipment[],
  usedIds: ReadonlySet<string>,
): Equipment | null {
  const available = lootPool.filter(eq => !usedIds.has(eq.id));
  if (available.length === 0) return null;
  return available[Math.floor(Math.random() * available.length)];
}

/**
 * Decide event choice: loot or heal.
 * - 'loot': always take equipment
 * - 'heal': always heal
 * - 'smart': heal if HP < 50%, else loot
 */
function chooseEvent(
  strategy: EventStrategy,
  currentHp: number,
  maxHp: number,
  lootAvailable: boolean,
): 'loot' | 'heal' {
  switch (strategy) {
    case 'loot':
      return lootAvailable ? 'loot' : 'heal';
    case 'heal':
      return 'heal';
    case 'smart': {
      const hpRatio = currentHp / maxHp;
      if (hpRatio < 0.5 || !lootAvailable) return 'heal';
      return 'loot';
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Simulate a full run: 5 combats with events between them.
 *
 * @param survivorDef - The starting survivor definition
 * @param strategy - Player's dice allocation strategy
 * @param eventStrategy - How to choose between loot and heal at events
 * @param enemyDatabase - All enemy definitions (engine picks per tier)
 * @param lootPool - Available loot equipment (drawn without repeats)
 * @returns Run result with outcome and stats
 */
export function simulateRun(
  survivorDef: Survivor,
  strategy: Strategy,
  eventStrategy: EventStrategy,
  enemyDatabase: readonly Enemy[],
  lootPool: readonly Equipment[],
): RunResult {
  let hp = survivorDef.hp;
  const maxHp = survivorDef.maxHp;
  let equipment = [...survivorDef.equipment];
  const usedLootIds = new Set<string>();
  const passiveId = survivorDef.passive;
  let passiveState: PassiveState = createPassiveState();
  let lastSpeedKill = false;

  let combatReached = 0;
  let speedKills = 0;
  let totalRounds = 0;

  for (let i = 0; i < MAX_COMBATS; i++) {
    combatReached = i + 1;

    // Reset passive state between combats (not before the first)
    if (i > 0) {
      passiveState = resetPassiveForCombat(
        passiveState, lastSpeedKill, hp / maxHp, false,
      );
    }

    const enemy = pickEnemy(i, enemyDatabase);

    const result = simulateCombat(
      hp, maxHp, equipment,
      enemy.hp, enemy.equipment, enemy.pattern,
      strategy, passiveId, passiveState,
    );

    totalRounds += result.rounds;
    if (result.passiveState) passiveState = result.passiveState;
    lastSpeedKill = result.speedKill;

    if (!result.won) {
      return {
        won: false,
        combatReached,
        speedKills,
        totalRounds,
        finalEquipmentCount: equipment.length,
      };
    }

    hp = result.playerHpAfter;
    if (result.speedKill) speedKills++;

    // Event between combats (not after the last one)
    if (i < MAX_COMBATS - 1) {
      const loot = pickLoot(lootPool, usedLootIds);
      const choice = chooseEvent(
        eventStrategy, hp, maxHp, loot !== null,
      );

      if (choice === 'loot' && loot !== null) {
        equipment = [...equipment, loot];
        usedLootIds.add(loot.id);
      } else {
        hp = Math.min(maxHp, hp + HEAL_AMOUNT);
      }
    }
  }

  return {
    won: true,
    combatReached,
    speedKills,
    totalRounds,
    finalEquipmentCount: equipment.length,
  };
}
