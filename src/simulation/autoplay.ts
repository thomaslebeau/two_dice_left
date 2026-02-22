/**
 * Headless autoplay simulation for balance testing (GDD v5).
 * Run with: npx tsx src/simulation/autoplay.ts
 *
 * V5 model: single-survivor runs with dice allocation, events, and dice modifiers.
 * Runs a full matrix: survivors × allocation strategies × event strategies.
 * Outputs to SQLite and prints aggregate analysis with balance flags.
 */

import { resolve } from 'node:path';
import type { Database } from 'sql.js';
import type { Card, EnemyCard } from '../types/card.types.ts';
import type { DiceResults } from '../types/combat.types.ts';
import type { RoundLogEntry } from '../db/types.ts';
import { CARD_DATABASE, MAX_COMBATS } from '../shared/constants/cards.ts';
import { rollPair, autoAllocate } from '../core/DiceAllocator.ts';
import { generateEnemy } from '../shared/utils/enemyGenerator.ts';
import { calculateCombatResult, applyDamage } from '../shared/utils/combatCalculations.ts';
import { EventSystem } from '../core/EventSystem.ts';
import type { RunState } from '../core/EventSystem.ts';
import { HeadlessDatabaseManager } from '../db/HeadlessDatabaseManager.ts';
import {
  allocate, chooseEvent,
  ALL_ALLOCATION_STRATEGIES, ALL_EVENT_STRATEGIES,
} from './strategies.ts';
import type { AllocationStrategy, EventStrategy } from './strategies.ts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SimulationConfig {
  survivorId: number;
  allocationStrategy: AllocationStrategy;
  eventStrategy: EventStrategy;
  iterations: number;
  enableDiceModifiers: boolean;
  seed?: number;
}

interface RunResult {
  won: boolean;
  combatReached: number;
  finalHP: number;
  hpPerCombat: number[];
  eventsChosen: string[];
  diceModsEquipped: string[];
  atkBonusAccumulated: number;
  defBonusAccumulated: number;
  avgAllocationAtkDie: number;
  avgAllocationDefDie: number;
  totalRounds: number;
  speedKills: number;
  hpRecovered: number;
}

const SPEED_KILL_THRESHOLD = 3;
const SPEED_KILL_RECOVERY = 3;

// ---------------------------------------------------------------------------
// Seeded PRNG
// ---------------------------------------------------------------------------

function createRNG(seed: number): () => number {
  let s = Math.abs(Math.floor(seed)) % 2147483646 || 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// ---------------------------------------------------------------------------
// Simulation core
// ---------------------------------------------------------------------------

function simulateCombat(
  playerCard: Card,
  enemyCard: EnemyCard,
  strategy: AllocationStrategy,
  eventAtkBonus: number,
  eventDefBonus: number,
  diceModifiers: RunState['diceModifiers'],
  enableDiceModifiers: boolean,
): { roundsLog: RoundLogEntry[]; updatedPlayer: Card; updatedEnemy: EnemyCard; atkDieSum: number; defDieSum: number } {
  let current: Card = { ...playerCard };
  let enemy: EnemyCard = { ...enemyCard };
  const roundsLog: RoundLogEntry[] = [];
  let roundNumber = 0;
  let atkDieSum = 0;
  let defDieSum = 0;

  const mod1 = enableDiceModifiers ? (diceModifiers[0] ?? null) : null;
  const mod2 = enableDiceModifiers ? (diceModifiers[1] ?? null) : null;

  while (current.currentHp > 0 && enemy.currentHp > 0) {
    roundNumber++;

    // Roll dice
    const playerDice = rollPair(mod1, mod2);
    const enemyDice = rollPair();

    // Allocate
    const playerAllocation = allocate(
      playerDice, strategy,
      current.currentHp, current.maxHp,
      enemy.currentHp, enemy.attackMod,
    );
    const enemyAllocation = autoAllocate(enemyDice, enemy.allocationPattern);

    atkDieSum += playerAllocation.atkDie;
    defDieSum += playerAllocation.defDie;

    // Build dice results with event bonuses baked in (matching CombatEngine)
    const diceResults: DiceResults = {
      playerAttack: playerAllocation.atkDie + eventAtkBonus,
      playerDefense: playerAllocation.defDie + eventDefBonus,
      enemyAttack: enemyAllocation.atkDie,
      enemyDefense: enemyAllocation.defDie,
    };

    const calculation = calculateCombatResult(diceResults, current, enemy);
    const { updatedPlayer, updatedEnemy } = applyDamage(current, enemy, calculation);

    current = updatedPlayer;
    enemy = updatedEnemy as EnemyCard;

    roundsLog.push({
      roundNumber,
      playerAttackRoll: playerAllocation.atkDie,
      playerDefenseRoll: playerAllocation.defDie,
      enemyAttackRoll: enemyAllocation.atkDie,
      enemyDefenseRoll: enemyAllocation.defDie,
      playerAttackTotal: calculation.playerAttack,
      playerDefenseTotal: calculation.playerDefense,
      enemyAttackTotal: calculation.enemyAttack,
      enemyDefenseTotal: calculation.enemyDefense,
      damageToPlayer: calculation.damageToPlayer,
      damageToEnemy: calculation.damageToEnemy,
      playerHpAfter: current.currentHp,
      enemyHpAfter: enemy.currentHp,
    });
  }

  return { roundsLog, updatedPlayer: current, updatedEnemy: enemy, atkDieSum, defDieSum };
}

function simulateRun(config: SimulationConfig, iteration: number): RunResult {
  const cardBase = CARD_DATABASE.find(c => c.id === config.survivorId);
  if (!cardBase) throw new Error(`Survivor ID ${config.survivorId} not found`);

  let survivor: Card = { ...cardBase, currentHp: cardBase.maxHp };

  // Event system
  const eventSystem = new EventSystem();
  const runState: RunState = {
    hp: survivor.currentHp,
    maxHp: survivor.maxHp,
    atkBonus: 0,
    defBonus: 0,
    diceModifiers: [],
  };

  // Seed RNG if specified
  const originalRandom = Math.random;
  if (config.seed !== undefined) {
    Math.random = createRNG(config.seed + iteration);
  }

  const hpPerCombat: number[] = [];
  const eventsChosen: string[] = [];
  let totalRounds = 0;
  let totalAtkDie = 0;
  let totalDefDie = 0;
  let combatReached = 0;
  let won = false;
  let speedKills = 0;
  let hpRecovered = 0;

  try {
    for (let combatNum = 1; combatNum <= MAX_COMBATS; combatNum++) {
      combatReached = combatNum;

      // Generate enemy
      const enemyCard = generateEnemy(combatNum);

      // Set up player card with persisted HP
      const playerCard: Card = { ...survivor };

      // Simulate combat
      const { roundsLog, updatedPlayer, updatedEnemy, atkDieSum, defDieSum } = simulateCombat(
        playerCard, enemyCard,
        config.allocationStrategy,
        runState.atkBonus, runState.defBonus,
        runState.diceModifiers,
        config.enableDiceModifiers,
      );

      totalRounds += roundsLog.length;
      totalAtkDie += atkDieSum;
      totalDefDie += defDieSum;

      const playerWon = updatedEnemy.currentHp <= 0;

      // Update survivor HP
      survivor = { ...survivor, currentHp: updatedPlayer.currentHp };
      runState.hp = survivor.currentHp;
      hpPerCombat.push(survivor.currentHp);

      if (!playerWon) break;

      // Speed kill bonus: recover HP if combat took ≤ threshold rounds
      if (roundsLog.length <= SPEED_KILL_THRESHOLD) {
        speedKills++;
        const recovery = Math.min(SPEED_KILL_RECOVERY, survivor.maxHp - survivor.currentHp);
        if (recovery > 0) {
          survivor = { ...survivor, currentHp: survivor.currentHp + recovery };
          runState.hp = survivor.currentHp;
          hpRecovered += recovery;
        }
      }

      // Won last combat → victory
      if (combatNum >= MAX_COMBATS) {
        won = true;
        break;
      }

      // Event between combats
      const event = eventSystem.getNextEvent();
      const choiceIdx = chooseEvent(event, config.eventStrategy, runState);
      eventSystem.applyChoice(choiceIdx, runState);

      eventsChosen.push(event.id);

      // Sync survivor HP from event effects
      survivor = { ...survivor, currentHp: runState.hp };
    }
  } finally {
    // Restore Math.random
    if (config.seed !== undefined) {
      Math.random = originalRandom;
    }
  }

  return {
    won,
    combatReached,
    finalHP: survivor.currentHp,
    hpPerCombat,
    eventsChosen,
    diceModsEquipped: runState.diceModifiers.map(m => m.id),
    atkBonusAccumulated: runState.atkBonus,
    defBonusAccumulated: runState.defBonus,
    avgAllocationAtkDie: totalRounds > 0 ? totalAtkDie / totalRounds : 0,
    avgAllocationDefDie: totalRounds > 0 ? totalDefDie / totalRounds : 0,
    totalRounds,
    speedKills,
    hpRecovered,
  };
}

// ---------------------------------------------------------------------------
// Database setup
// ---------------------------------------------------------------------------

const RUNS_V5_DDL = `
CREATE TABLE IF NOT EXISTS runs_v5 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  survivor_id TEXT NOT NULL,
  allocation_strategy TEXT NOT NULL,
  event_strategy TEXT NOT NULL,
  won INTEGER NOT NULL,
  combat_reached INTEGER NOT NULL,
  final_hp INTEGER NOT NULL,
  atk_bonus INTEGER NOT NULL DEFAULT 0,
  def_bonus INTEGER NOT NULL DEFAULT 0,
  dice_mods TEXT NOT NULL DEFAULT '[]',
  total_rounds INTEGER NOT NULL,
  speed_kills INTEGER NOT NULL DEFAULT 0,
  hp_recovered INTEGER NOT NULL DEFAULT 0,
  seed INTEGER,
  timestamp TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

function insertRunResult(
  db: Database,
  config: SimulationConfig,
  result: RunResult,
  seed: number | null,
): void {
  db.run(
    `INSERT INTO runs_v5 (
      survivor_id, allocation_strategy, event_strategy,
      won, combat_reached, final_hp, atk_bonus, def_bonus,
      dice_mods, total_rounds, speed_kills, hp_recovered, seed
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      String(config.survivorId),
      config.allocationStrategy,
      config.eventStrategy,
      result.won ? 1 : 0,
      result.combatReached,
      result.finalHP,
      result.atkBonusAccumulated,
      result.defBonusAccumulated,
      JSON.stringify(result.diceModsEquipped),
      result.totalRounds,
      result.speedKills,
      result.hpRecovered,
      seed,
    ],
  );
}

// ---------------------------------------------------------------------------
// Aggregate queries + reporting
// ---------------------------------------------------------------------------

const f1 = (v: number) => v.toFixed(1);

interface QueryRow {
  [key: string]: string | number | null;
}

function queryAll(db: Database, sql: string): QueryRow[] {
  const result = db.exec(sql);
  if (result.length === 0) return [];
  const { columns, values } = result[0];
  return values.map(row => {
    const obj: QueryRow = {};
    columns.forEach((col, i) => { obj[col] = row[i] as string | number | null; });
    return obj;
  });
}

function printTable(title: string, rows: QueryRow[], columns: string[]): void {
  if (rows.length === 0) {
    console.log(`\n${title}: (no data)`);
    return;
  }

  console.log(`\n${title}`);

  // Compute column widths
  const widths = columns.map(col =>
    Math.max(col.length, ...rows.map(r => String(r[col] ?? '').length))
  );

  // Header
  const header = columns.map((col, i) => col.padEnd(widths[i])).join('  ');
  console.log(header);
  console.log(columns.map((_, i) => '-'.repeat(widths[i])).join('  '));

  // Rows
  for (const row of rows) {
    const line = columns.map((col, i) => String(row[col] ?? '').padEnd(widths[i])).join('  ');
    console.log(line);
  }
}

function runAggregateQueries(db: Database): void {
  // 1. Win rate by survivor × allocation strategy
  const survivorAlloc = queryAll(db, `
    SELECT survivor_id, allocation_strategy,
      ROUND(AVG(won) * 100, 1) as win_rate,
      ROUND(AVG(combat_reached), 1) as avg_combat,
      COUNT(*) as runs
    FROM runs_v5
    GROUP BY survivor_id, allocation_strategy
    ORDER BY win_rate DESC
  `);
  printTable(
    '=== WIN RATE BY SURVIVOR x ALLOCATION ===',
    survivorAlloc,
    ['survivor_id', 'allocation_strategy', 'win_rate', 'avg_combat', 'runs'],
  );

  // 2. Allocation strategy overall impact
  const allocImpact = queryAll(db, `
    SELECT allocation_strategy,
      ROUND(AVG(won) * 100, 1) as win_rate
    FROM runs_v5
    GROUP BY allocation_strategy
    ORDER BY win_rate DESC
  `);
  printTable(
    '=== ALLOCATION STRATEGY IMPACT ===',
    allocImpact,
    ['allocation_strategy', 'win_rate'],
  );

  // 3. Event strategy impact
  const eventImpact = queryAll(db, `
    SELECT event_strategy,
      ROUND(AVG(won) * 100, 1) as win_rate
    FROM runs_v5
    GROUP BY event_strategy
    ORDER BY win_rate DESC
  `);
  printTable(
    '=== EVENT STRATEGY IMPACT ===',
    eventImpact,
    ['event_strategy', 'win_rate'],
  );

  // 4. Death distribution by combat
  const deathDist = queryAll(db, `
    SELECT combat_reached, COUNT(*) as deaths
    FROM runs_v5 WHERE won = 0
    GROUP BY combat_reached
    ORDER BY combat_reached
  `);
  printTable(
    '=== DEATH DISTRIBUTION BY COMBAT ===',
    deathDist,
    ['combat_reached', 'deaths'],
  );

  // 5. Dice modifier impact
  const modImpact = queryAll(db, `
    SELECT
      CASE WHEN dice_mods = '[]' THEN 'none' ELSE 'has_mods' END as mod_status,
      ROUND(AVG(won) * 100, 1) as win_rate,
      COUNT(*) as runs
    FROM runs_v5
    GROUP BY mod_status
  `);
  printTable(
    '=== DICE MODIFIER IMPACT ===',
    modImpact,
    ['mod_status', 'win_rate', 'runs'],
  );

  // 6. Win rate per survivor (overall)
  const perSurvivor = queryAll(db, `
    SELECT survivor_id,
      ROUND(AVG(won) * 100, 1) as win_rate,
      ROUND(AVG(combat_reached), 1) as avg_combat,
      ROUND(AVG(final_hp), 1) as avg_final_hp,
      ROUND(AVG(total_rounds), 1) as avg_rounds
    FROM runs_v5
    GROUP BY survivor_id
    ORDER BY win_rate DESC
  `);
  printTable(
    '=== WIN RATE PER SURVIVOR ===',
    perSurvivor,
    ['survivor_id', 'win_rate', 'avg_combat', 'avg_final_hp', 'avg_rounds'],
  );

  // 7. Speed kill rate by allocation strategy
  const speedByAlloc = queryAll(db, `
    SELECT allocation_strategy,
      ROUND(AVG(won) * 100, 1) as win_rate,
      ROUND(AVG(speed_kills), 1) as avg_speed_kills,
      ROUND(AVG(hp_recovered), 1) as avg_hp_recovered
    FROM runs_v5
    GROUP BY allocation_strategy
    ORDER BY win_rate DESC
  `);
  printTable(
    '=== SPEED KILLS BY ALLOCATION ===',
    speedByAlloc,
    ['allocation_strategy', 'win_rate', 'avg_speed_kills', 'avg_hp_recovered'],
  );

  // 8. Speed kill rate by survivor
  const speedBySurvivor = queryAll(db, `
    SELECT survivor_id,
      ROUND(AVG(speed_kills), 1) as avg_speed_kills,
      ROUND(AVG(hp_recovered), 1) as avg_hp_recovered,
      ROUND(AVG(CASE WHEN allocation_strategy = 'aggressive' THEN speed_kills ELSE NULL END), 1) as aggro_speed_kills,
      ROUND(AVG(CASE WHEN allocation_strategy = 'defensive' THEN speed_kills ELSE NULL END), 1) as def_speed_kills
    FROM runs_v5
    GROUP BY survivor_id
    ORDER BY avg_speed_kills DESC
  `);
  printTable(
    '=== SPEED KILLS BY SURVIVOR ===',
    speedBySurvivor,
    ['survivor_id', 'avg_speed_kills', 'avg_hp_recovered', 'aggro_speed_kills', 'def_speed_kills'],
  );

  // 9. Strategy hierarchy (with balanced events)
  const hierarchy = queryAll(db, `
    SELECT allocation_strategy,
      ROUND(AVG(CASE WHEN event_strategy = 'balanced' THEN won ELSE NULL END) * 100, 1) as with_balanced
    FROM runs_v5
    GROUP BY allocation_strategy
    ORDER BY with_balanced DESC
  `);
  printTable(
    '=== STRATEGY HIERARCHY (balanced events) ===',
    hierarchy,
    ['allocation_strategy', 'with_balanced'],
  );
}

// ---------------------------------------------------------------------------
// Balance flags
// ---------------------------------------------------------------------------

function printBalanceFlags(db: Database): void {
  console.log('\n=== BALANCE FLAGS ===');
  const flags: string[] = [];

  // Target: optimal (hpThreshold + balanced) = 35-45%
  const optimal = queryAll(db, `
    SELECT ROUND(AVG(won) * 100, 1) as win_rate
    FROM runs_v5
    WHERE allocation_strategy = 'hpThreshold' AND event_strategy = 'balanced'
  `);
  if (optimal.length > 0) {
    const wr = Number(optimal[0].win_rate);
    if (wr >= 35 && wr <= 45) {
      flags.push(`OK  Optimal strategy (hpThreshold+balanced): ${wr}% (target: 35-45%)`);
    } else {
      flags.push(`!!  Optimal strategy (hpThreshold+balanced): ${wr}% (target: 35-45%)`);
    }
  }

  // Target: aggressive = 25-35%
  const aggressive = queryAll(db, `
    SELECT ROUND(AVG(won) * 100, 1) as win_rate
    FROM runs_v5
    WHERE allocation_strategy = 'aggressive'
  `);
  if (aggressive.length > 0) {
    const wr = Number(aggressive[0].win_rate);
    if (wr >= 25 && wr <= 35) {
      flags.push(`OK  Pure aggressive: ${wr}% (target: 25-35%)`);
    } else {
      flags.push(`!!  Pure aggressive: ${wr}% (target: 25-35%)`);
    }
  }

  // Target: defensive = 20-30%
  const defensive = queryAll(db, `
    SELECT ROUND(AVG(won) * 100, 1) as win_rate
    FROM runs_v5
    WHERE allocation_strategy = 'defensive'
  `);
  if (defensive.length > 0) {
    const wr = Number(defensive[0].win_rate);
    if (wr >= 20 && wr <= 30) {
      flags.push(`OK  Pure defensive: ${wr}% (target: 20-30%)`);
    } else {
      flags.push(`!!  Pure defensive: ${wr}% (target: 20-30%)`);
    }
  }

  // Target: random + random = 10-15%
  const randomBaseline = queryAll(db, `
    SELECT ROUND(AVG(won) * 100, 1) as win_rate
    FROM runs_v5
    WHERE allocation_strategy = 'random' AND event_strategy = 'random'
  `);
  if (randomBaseline.length > 0) {
    const wr = Number(randomBaseline[0].win_rate);
    if (wr >= 10 && wr <= 15) {
      flags.push(`OK  Random baseline: ${wr}% (target: 10-15%)`);
    } else {
      flags.push(`!!  Random baseline: ${wr}% (target: 10-15%)`);
    }
  }

  // Allocation spread: optimal vs random should be 3-4x
  const allocStrategies = queryAll(db, `
    SELECT allocation_strategy, ROUND(AVG(won) * 100, 1) as win_rate
    FROM runs_v5
    GROUP BY allocation_strategy
    ORDER BY win_rate DESC
  `);
  if (allocStrategies.length > 0) {
    const bestWr = Number(allocStrategies[0].win_rate);
    const randomRow = allocStrategies.find(r => r.allocation_strategy === 'random');
    const randomWr = randomRow ? Number(randomRow.win_rate) : 0;
    if (randomWr > 0) {
      const ratio = bestWr / randomWr;
      if (ratio >= 2 && ratio <= 3) {
        flags.push(`OK  Allocation spread: ${ratio.toFixed(1)}x (target: 2-3x)`);
      } else {
        flags.push(`!!  Allocation spread: ${ratio.toFixed(1)}x (target: 2-3x)`);
      }
    }
  }

  // Event impact: best event strategy vs no-event baseline
  const eventStrategies = queryAll(db, `
    SELECT event_strategy, ROUND(AVG(won) * 100, 1) as win_rate
    FROM runs_v5
    GROUP BY event_strategy
    ORDER BY win_rate DESC
  `);
  if (eventStrategies.length >= 2) {
    const best = Number(eventStrategies[0].win_rate);
    const worst = Number(eventStrategies[eventStrategies.length - 1].win_rate);
    const delta = best - worst;
    if (delta >= 10 && delta <= 15) {
      flags.push(`OK  Event impact: +${f1(delta)}pp spread (target: 10-15pp)`);
    } else {
      flags.push(`!!  Event impact: +${f1(delta)}pp spread (target: 10-15pp)`);
    }
  }

  // No single survivor < 15% or > 60% with optimal play
  const survivorOptimal = queryAll(db, `
    SELECT survivor_id, ROUND(AVG(won) * 100, 1) as win_rate
    FROM runs_v5
    WHERE allocation_strategy = 'hpThreshold' AND event_strategy = 'balanced'
    GROUP BY survivor_id
    ORDER BY win_rate DESC
  `);
  for (const row of survivorOptimal) {
    const wr = Number(row.win_rate);
    const sid = row.survivor_id;
    const card = CARD_DATABASE.find(c => c.id === Number(sid));
    const name = card?.name ?? `#${sid}`;
    if (wr < 15) {
      flags.push(`!!  ${name} (ID ${sid}): ${wr}% with optimal play (< 15% floor)`);
    } else if (wr > 55) {
      flags.push(`!!  ${name} (ID ${sid}): ${wr}% with optimal play (> 55% ceiling)`);
    } else {
      flags.push(`OK  ${name} (ID ${sid}): ${wr}% with optimal play`);
    }
  }

  // Strategy hierarchy: hpThreshold > defensive, hpThreshold > aggressive, aggressive > random
  const hierRows = queryAll(db, `
    SELECT allocation_strategy, ROUND(AVG(won) * 100, 1) as win_rate
    FROM runs_v5
    GROUP BY allocation_strategy
  `);
  const hierMap = new Map(hierRows.map(r => [r.allocation_strategy, Number(r.win_rate)]));
  const hpT = hierMap.get('hpThreshold') ?? 0;
  const def = hierMap.get('defensive') ?? 0;
  const agg = hierMap.get('aggressive') ?? 0;
  const rnd = hierMap.get('random') ?? 0;
  flags.push(hpT > def
    ? `OK  Hierarchy: hpThreshold (${f1(hpT)}%) > defensive (${f1(def)}%)`
    : `!!  Hierarchy: hpThreshold (${f1(hpT)}%) <= defensive (${f1(def)}%)`);
  flags.push(hpT > agg
    ? `OK  Hierarchy: hpThreshold (${f1(hpT)}%) > aggressive (${f1(agg)}%)`
    : `!!  Hierarchy: hpThreshold (${f1(hpT)}%) <= aggressive (${f1(agg)}%)`);
  flags.push(agg > rnd
    ? `OK  Hierarchy: aggressive (${f1(agg)}%) > random (${f1(rnd)}%)`
    : `!!  Hierarchy: aggressive (${f1(agg)}%) <= random (${f1(rnd)}%)`);

  for (const f of flags) console.log(f);
  console.log();
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const STARTER_SURVIVOR_IDS = [1, 2, 3, 4, 5];
const ITERATIONS_PER_COMBO = 500;

async function main() {
  const dbPath = resolve(import.meta.dirname!, '..', '..', 'data', 'autoplay_v5.db');
  const dbManager = new HeadlessDatabaseManager(dbPath);
  await dbManager.init();
  const db = dbManager.db;

  // Create runs_v5 table (drop old data for clean run)
  db.run('DROP TABLE IF EXISTS runs_v5');
  db.run(RUNS_V5_DDL);

  const totalCombos = STARTER_SURVIVOR_IDS.length * ALL_ALLOCATION_STRATEGIES.length * ALL_EVENT_STRATEGIES.length;
  const totalRuns = totalCombos * ITERATIONS_PER_COMBO;
  const baseSeed = Date.now();

  console.log('=== DICE & CARDS — V5 AUTOPLAY BALANCE REPORT ===');
  console.log(`${STARTER_SURVIVOR_IDS.length} survivors x ${ALL_ALLOCATION_STRATEGIES.length} allocation x ${ALL_EVENT_STRATEGIES.length} event = ${totalCombos} combos`);
  console.log(`${ITERATIONS_PER_COMBO} iterations each = ${totalRuns} total runs`);
  console.log(`Base seed: ${baseSeed}`);
  console.log();

  const t0 = performance.now();
  let combosDone = 0;
  let runsDone = 0;

  for (const survivorId of STARTER_SURVIVOR_IDS) {
    const card = CARD_DATABASE.find(c => c.id === survivorId)!;
    const survT0 = performance.now();

    for (const allocStrategy of ALL_ALLOCATION_STRATEGIES) {
      for (const eventStrategy of ALL_EVENT_STRATEGIES) {
        const config: SimulationConfig = {
          survivorId,
          allocationStrategy: allocStrategy,
          eventStrategy,
          iterations: ITERATIONS_PER_COMBO,
          enableDiceModifiers: true,
          seed: baseSeed,
        };

        // Batch insert in a transaction for performance
        db.run('BEGIN TRANSACTION');
        for (let i = 0; i < config.iterations; i++) {
          const result = simulateRun(config, i);
          insertRunResult(db, config, result, baseSeed + i);
          runsDone++;
        }
        db.run('COMMIT');

        combosDone++;
      }
    }

    const survElapsed = ((performance.now() - survT0) / 1000).toFixed(2);
    const survWinRate = queryAll(db, `
      SELECT ROUND(AVG(won) * 100, 1) as wr FROM runs_v5 WHERE survivor_id = '${survivorId}'
    `);
    const wr = survWinRate[0]?.wr ?? '?';
    console.log(`  [${card.name}] ${combosDone}/${totalCombos} combos (${survElapsed}s) — avg win rate: ${wr}%`);
  }

  const elapsed = ((performance.now() - t0) / 1000).toFixed(2);
  console.log(`\nSimulation complete: ${runsDone} runs in ${elapsed}s`);

  // Save DB
  dbManager.saveNow();
  console.log(`Database saved to: ${dbPath}`);

  // Run aggregate queries
  runAggregateQueries(db);
  printBalanceFlags(db);
}

main().catch((err) => {
  console.error('Simulation failed:', err);
  process.exit(1);
});
