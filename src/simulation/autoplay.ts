/**
 * Headless autoplay simulation for balance testing.
 * Run with: npx tsx src/simulation/autoplay.ts
 *
 * Simulates full game runs using the REAL game logic (dice, damage, enemies)
 * and writes all results to the local SQLite database.
 */

import { resolve } from 'node:path';
import type { Card, CardBase, EnemyCard } from '../types/card.types.ts';
import type { RoundLogEntry, CombatLogData } from '../db/types.ts';
import { CARD_DATABASE, MAX_COMBATS } from '../shared/constants/cards.ts';
import { rollDice } from '../shared/constants/dice.ts';
import { generateEnemy } from '../shared/utils/enemyGenerator.ts';
import { generateRewardCards } from '../shared/utils/rewardGenerator.ts';
import { calculateCombatResult, applyDamage } from '../shared/utils/combatCalculations.ts';
import { markCardAsDeadIfNeeded } from '../shared/utils/cardDeathUtils.ts';
import { filterAliveCards, getDeadCardsCount } from '../shared/utils/cardDeathUtils.ts';
import { HeadlessDatabaseManager } from '../db/HeadlessDatabaseManager.ts';
import { CombatLogRepository } from '../db/CombatLogRepository.ts';
import { ALL_STRATEGIES } from './strategies.ts';
import type { PlayerStrategy } from './strategies.ts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CombatLog {
  combatNumber: number;
  playerCard: { id: number; name: string; hpBefore: number; hpAfter: number; attackMod: number; defenseMod: number };
  enemyCard: { name: string; hp: number; attackMod: number; defenseMod: number };
  rounds: number;
  playerWon: boolean;
  damageDealt: number;
  damageTaken: number;
}

interface RunResult {
  strategy: string;
  source: 'autoplay';
  victory: boolean;
  combatsCompleted: number;
  totalRounds: number;
  combatLogs: CombatLog[];
  collectionAtEnd: { id: number; name: string; currentHp: number; maxHp: number; isDead: boolean }[];
  rewardsTaken: { combatNumber: number; card: { id: number; name: string } | null }[];
  cardsDeadCount: number;
  totalDamageDealt: number;
  totalDamageTaken: number;
}

interface BatchResult {
  strategy: string;
  runs: RunResult[];
  winRate: number;
  avgCombats: number;
  deathDistribution: Record<number, number>;
  avgRoundsPerCombat: Record<number, number>;
  avgDamageDealtPerCombat: Record<number, number>;
  avgDamageTakenPerCombat: Record<number, number>;
  cardUsageFrequency: Record<number, { name: string; count: number; pct: number }>;
  cardDeathRate: Record<number, { name: string; deaths: number; uses: number; pct: number }>;
  rewardTakeRate: number;
  mostPickedReward: { id: number; name: string; count: number; pct: number } | null;
  avgCollectionSize: number;
  avgAliveCardsAtEnd: number;
  bossReachedPct: number;
}

// ---------------------------------------------------------------------------
// Simulation core
// ---------------------------------------------------------------------------

function simulateCombat(playerCard: Card, enemyCard: EnemyCard): { roundsLog: RoundLogEntry[]; updatedPlayer: Card; updatedEnemy: EnemyCard } {
  let current: Card = { ...playerCard };
  let enemy: EnemyCard = { ...enemyCard } as EnemyCard;
  const roundsLog: RoundLogEntry[] = [];
  let roundNumber = 0;

  while (current.currentHp > 0 && enemy.currentHp > 0) {
    roundNumber++;
    const diceResults = {
      playerAttack: rollDice(),
      playerDefense: rollDice(),
      enemyAttack: rollDice(),
      enemyDefense: rollDice(),
    };

    const calculation = calculateCombatResult(diceResults, current, enemy);
    const { updatedPlayer, updatedEnemy } = applyDamage(current, enemy, calculation);

    current = updatedPlayer;
    enemy = updatedEnemy as EnemyCard;

    roundsLog.push({
      roundNumber,
      playerAttackRoll: diceResults.playerAttack,
      playerDefenseRoll: diceResults.playerDefense,
      enemyAttackRoll: diceResults.enemyAttack,
      enemyDefenseRoll: diceResults.enemyDefense,
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

  return { roundsLog, updatedPlayer: current, updatedEnemy: enemy };
}

function simulateRun(strategy: PlayerStrategy, repo: CombatLogRepository, runId: number): RunResult {
  let collection: Card[] = CARD_DATABASE.slice(0, 5).map((c) => ({
    ...c,
    currentHp: c.maxHp,
  }));

  const combatLogs: CombatLog[] = [];
  const rewardsTaken: RunResult['rewardsTaken'] = [];
  let totalRounds = 0;
  let totalDamageDealt = 0;
  let totalDamageTaken = 0;
  let victory = false;
  let combatsCompleted = 0;

  for (let combatNum = 1; combatNum <= MAX_COMBATS; combatNum++) {
    const alive = filterAliveCards(collection);
    if (alive.length === 0) break;

    const enemyCard = generateEnemy(combatNum);
    const chosenCard = strategy.chooseCard(collection, combatNum, enemyCard);
    const playerStartHp = chosenCard.currentHp;

    const { roundsLog, updatedPlayer, updatedEnemy } = simulateCombat(chosenCard, enemyCard);
    const playerWon = updatedEnemy.currentHp <= 0;
    combatsCompleted = combatNum;
    totalRounds += roundsLog.length;

    const dmgDealt = roundsLog.reduce((s, r) => s + r.damageToEnemy, 0);
    const dmgTaken = roundsLog.reduce((s, r) => s + r.damageToPlayer, 0);
    totalDamageDealt += dmgDealt;
    totalDamageTaken += dmgTaken;

    combatLogs.push({
      combatNumber: combatNum,
      playerCard: {
        id: chosenCard.id,
        name: chosenCard.name,
        hpBefore: playerStartHp,
        hpAfter: updatedPlayer.currentHp,
        attackMod: chosenCard.attackMod,
        defenseMod: chosenCard.defenseMod,
      },
      enemyCard: {
        name: enemyCard.name,
        hp: enemyCard.maxHp,
        attackMod: enemyCard.attackMod,
        defenseMod: enemyCard.defenseMod,
      },
      rounds: roundsLog.length,
      playerWon,
      damageDealt: dmgDealt,
      damageTaken: dmgTaken,
    });

    // Write combat to DB
    const combatData: CombatLogData = {
      runId,
      combatNumber: combatNum,
      playerCardId: chosenCard.id,
      playerCardName: chosenCard.name,
      playerStartHp,
      playerAttackMod: chosenCard.attackMod,
      playerDefenseMod: chosenCard.defenseMod,
      enemyCardName: enemyCard.name,
      enemyStartHp: enemyCard.maxHp,
      enemyAttackMod: enemyCard.attackMod,
      enemyDefenseMod: enemyCard.defenseMod,
      totalRounds: roundsLog.length,
      victory: playerWon,
      rounds: roundsLog,
    };
    repo.insertCombat(combatData);

    // Update player card in collection
    const finalPlayer = markCardAsDeadIfNeeded(updatedPlayer);
    collection = collection.map((c) => c.id === finalPlayer.id ? finalPlayer : c);

    if (!playerWon) break;

    // Reward phase (not after final combat)
    if (combatNum < MAX_COMBATS) {
      const rewardBases = generateRewardCards(3);
      const rewardCards: Card[] = rewardBases.map((b: CardBase) => ({ ...b, currentHp: b.maxHp }));
      const picked = strategy.chooseReward(rewardCards, collection, combatNum);

      if (picked && !collection.some((c) => c.id === picked.id)) {
        collection = [...collection, { ...picked, currentHp: picked.maxHp }];
      }
      rewardsTaken.push({
        combatNumber: combatNum,
        card: picked ? { id: picked.id, name: picked.name } : null,
      });

      // Check if all cards dead after reward
      if (filterAliveCards(collection).length === 0) break;
    }

    if (combatNum === MAX_COMBATS) {
      victory = true;
    }
  }

  return {
    strategy: strategy.name,
    source: 'autoplay',
    victory,
    combatsCompleted,
    totalRounds,
    combatLogs,
    collectionAtEnd: collection.map((c) => ({
      id: c.id,
      name: c.name,
      currentHp: c.currentHp,
      maxHp: c.maxHp,
      isDead: c.isDead ?? false,
    })),
    rewardsTaken,
    cardsDeadCount: getDeadCardsCount(collection),
    totalDamageDealt,
    totalDamageTaken,
  };
}

// ---------------------------------------------------------------------------
// Batch runner + statistics
// ---------------------------------------------------------------------------

function runBatch(strategy: PlayerStrategy, count: number, repo: CombatLogRepository): BatchResult {
  const runs: RunResult[] = [];

  for (let i = 0; i < count; i++) {
    const collectionSnapshot = JSON.stringify(CARD_DATABASE.slice(0, 5).map((c) => ({ id: c.id, name: c.name })));
    const runId = repo.createRun(collectionSnapshot, 'autoplay', strategy.name);

    const result = simulateRun(strategy, repo, runId);
    runs.push(result);

    const endSnapshot = JSON.stringify(result.collectionAtEnd.map((c) => ({ id: c.id, name: c.name })));
    repo.finalizeRun(runId, result.victory, endSnapshot);
  }

  const winRate = runs.filter((r) => r.victory).length / count;
  const avgCombats = runs.reduce((s, r) => s + r.combatsCompleted, 0) / count;

  // Death distribution: at which combat did runs end?
  const deathDistribution: Record<number, number> = {};
  for (let c = 1; c <= MAX_COMBATS; c++) deathDistribution[c] = 0;
  for (const r of runs) {
    deathDistribution[r.combatsCompleted] = (deathDistribution[r.combatsCompleted] ?? 0) + 1;
  }

  // Average rounds per combat number
  const roundsByCombat: Record<number, number[]> = {};
  const dmgDealtByCombat: Record<number, number[]> = {};
  const dmgTakenByCombat: Record<number, number[]> = {};
  for (const r of runs) {
    for (const cl of r.combatLogs) {
      (roundsByCombat[cl.combatNumber] ??= []).push(cl.rounds);
      (dmgDealtByCombat[cl.combatNumber] ??= []).push(cl.damageDealt);
      (dmgTakenByCombat[cl.combatNumber] ??= []).push(cl.damageTaken);
    }
  }

  const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  const avgRoundsPerCombat: Record<number, number> = {};
  const avgDamageDealtPerCombat: Record<number, number> = {};
  const avgDamageTakenPerCombat: Record<number, number> = {};
  for (let c = 1; c <= MAX_COMBATS; c++) {
    avgRoundsPerCombat[c] = avg(roundsByCombat[c] ?? []);
    avgDamageDealtPerCombat[c] = avg(dmgDealtByCombat[c] ?? []);
    avgDamageTakenPerCombat[c] = avg(dmgTakenByCombat[c] ?? []);
  }

  // Card usage frequency
  const cardUsageCounts: Record<number, { name: string; count: number }> = {};
  const cardDeathCounts: Record<number, { name: string; deaths: number; uses: number }> = {};
  for (const r of runs) {
    for (const cl of r.combatLogs) {
      const id = cl.playerCard.id;
      if (!cardUsageCounts[id]) cardUsageCounts[id] = { name: cl.playerCard.name, count: 0 };
      cardUsageCounts[id].count++;

      if (!cardDeathCounts[id]) cardDeathCounts[id] = { name: cl.playerCard.name, deaths: 0, uses: 0 };
      cardDeathCounts[id].uses++;
      if (cl.playerCard.hpAfter <= 0) cardDeathCounts[id].deaths++;
    }
  }

  const totalFights = runs.reduce((s, r) => s + r.combatLogs.length, 0);
  const cardUsageFrequency: BatchResult['cardUsageFrequency'] = {};
  for (const [id, v] of Object.entries(cardUsageCounts)) {
    cardUsageFrequency[Number(id)] = { ...v, pct: totalFights ? v.count / totalFights : 0 };
  }

  const cardDeathRate: BatchResult['cardDeathRate'] = {};
  for (const [id, v] of Object.entries(cardDeathCounts)) {
    cardDeathRate[Number(id)] = { ...v, pct: v.uses ? v.deaths / v.uses : 0 };
  }

  // Reward stats
  const allRewards = runs.flatMap((r) => r.rewardsTaken);
  const rewardsTaken = allRewards.filter((r) => r.card !== null);
  const rewardTakeRate = allRewards.length ? rewardsTaken.length / allRewards.length : 0;

  let mostPickedReward: BatchResult['mostPickedReward'] = null;
  if (rewardsTaken.length > 0) {
    const rewardCounts: Record<number, { name: string; count: number }> = {};
    for (const r of rewardsTaken) {
      const id = r.card!.id;
      if (!rewardCounts[id]) rewardCounts[id] = { name: r.card!.name, count: 0 };
      rewardCounts[id].count++;
    }
    const top = Object.entries(rewardCounts).reduce((a, b) => b[1].count > a[1].count ? b : a);
    mostPickedReward = {
      id: Number(top[0]),
      name: top[1].name,
      count: top[1].count,
      pct: top[1].count / rewardsTaken.length,
    };
  }

  const avgCollectionSize = runs.reduce((s, r) => s + r.collectionAtEnd.length, 0) / count;
  const victories = runs.filter((r) => r.victory);
  const avgAliveCardsAtEnd = victories.length
    ? victories.reduce((s, r) => s + r.collectionAtEnd.filter((c) => !c.isDead).length, 0) / victories.length
    : 0;

  const bossReachedPct = runs.filter((r) => r.combatsCompleted >= MAX_COMBATS).length / count;

  return {
    strategy: strategy.name,
    runs,
    winRate,
    avgCombats,
    deathDistribution,
    avgRoundsPerCombat,
    avgDamageDealtPerCombat,
    avgDamageTakenPerCombat,
    cardUsageFrequency,
    cardDeathRate,
    rewardTakeRate,
    mostPickedReward,
    avgCollectionSize,
    avgAliveCardsAtEnd,
    bossReachedPct,
  };
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

const pct = (v: number) => `${Math.round(v * 100)}%`;
const f1 = (v: number) => v.toFixed(1);

function printStrategyReport(b: BatchResult): void {
  console.log(`--- ${b.strategy.toUpperCase()} ---`);
  console.log(`Win rate:           ${pct(b.winRate)}`);
  console.log(`Avg combats:        ${f1(b.avgCombats)}`);

  const dd = Object.entries(b.deathDistribution)
    .map(([c, n]) => `C${c}: ${pct(n / b.runs.length)}`)
    .join(' | ');
  console.log(`Death distribution: ${dd}`);

  const rpc = Object.entries(b.avgRoundsPerCombat)
    .filter(([, v]) => v > 0)
    .map(([c, v]) => `C${c}: ${f1(v)}`)
    .join(' | ');
  console.log(`Avg rounds/combat:  ${rpc}`);

  // Card usage — sorted by frequency
  const usage = Object.values(b.cardUsageFrequency)
    .sort((a, c) => c.pct - a.pct)
    .map((v) => `${v.name}: ${pct(v.pct)}`)
    .join(' | ');
  console.log(`Card usage:         ${usage}`);

  // Card death rate — sorted by death rate
  const deaths = Object.values(b.cardDeathRate)
    .filter((v) => v.uses > 0)
    .sort((a, c) => c.pct - a.pct)
    .map((v) => `${v.name}: ${pct(v.pct)}`)
    .join(' | ');
  console.log(`Card death rate:    ${deaths}`);

  console.log(`Reward take rate:   ${pct(b.rewardTakeRate)}`);
  if (b.mostPickedReward) {
    console.log(`Most picked reward: ${b.mostPickedReward.name} (${pct(b.mostPickedReward.pct)})`);
  }
  console.log();
}

function printBalanceFlags(batches: BatchResult[]): void {
  console.log('=== BALANCE FLAGS ===');
  const flags: string[] = [];

  // Check combat 1 win rate across all strategies
  const c1WinRates = batches.map((b) => {
    const c1Fights = b.runs.flatMap((r) => r.combatLogs).filter((cl) => cl.combatNumber === 1);
    return c1Fights.length ? c1Fights.filter((cl) => cl.playerWon).length / c1Fights.length : 0;
  });
  if (c1WinRates.every((r) => r >= 0.98)) {
    flags.push(`⚠ Combat 1 win rate is ${pct(Math.min(...c1WinRates))}+ across all strategies (too easy?)`);
  }

  // Check for dominant/fragile cards
  for (const b of batches) {
    for (const [, card] of Object.entries(b.cardDeathRate)) {
      if (card.uses >= 10 && card.pct >= 0.8) {
        flags.push(`⚠ ${card.name} dies ${pct(card.pct)} of the time with ${b.strategy} (too fragile?)`);
      }
    }
    for (const [, card] of Object.entries(b.cardUsageFrequency)) {
      if (card.pct >= 0.5) {
        flags.push(`⚠ ${card.name} is picked ${pct(card.pct)} by ${b.strategy} (dominant card?)`);
      }
    }
  }

  // Naive floor check
  const naive = batches.find((b) => b.strategy === 'Naive');
  if (naive && naive.winRate <= 0.02) {
    flags.push(`⚠ Naive win rate is ${pct(naive.winRate)} (floor too punishing?)`);
  }

  // Overall win rate spread
  const rates = batches.map((b) => `${b.strategy} ${pct(b.winRate)}`).join(', ');
  const winRates = batches.map((b) => b.winRate);
  const spread = Math.max(...winRates) - Math.min(...winRates);
  if (spread >= 0.05 && spread <= 0.40) {
    flags.push(`✅ Overall win rates: ${rates} (healthy spread)`);
  } else if (spread < 0.05) {
    flags.push(`⚠ Overall win rates: ${rates} (too similar — strategy doesn't matter?)`);
  } else {
    flags.push(`⚠ Overall win rates: ${rates} (very wide spread)`);
  }

  if (flags.length === 0) {
    console.log('✅ No significant balance concerns detected');
  } else {
    for (const f of flags) console.log(f);
  }
  console.log();
}

function printComparisonTable(batches: BatchResult[]): void {
  console.log('=== STRATEGY COMPARISON ===');
  const names = batches.map((b) => b.strategy);
  const pad = 16;

  const header = ''.padEnd(pad) + names.map((n) => n.padEnd(12)).join('');
  console.log(header);

  const row = (label: string, vals: string[]) => {
    console.log(label.padEnd(pad) + vals.map((v) => v.padEnd(12)).join(''));
  };

  row('Win rate', batches.map((b) => pct(b.winRate)));
  row('Avg combats', batches.map((b) => f1(b.avgCombats)));
  row('Avg cards dead', batches.map((b) => f1(b.runs.reduce((s, r) => s + r.cardsDeadCount, 0) / b.runs.length)));
  row('Boss reached', batches.map((b) => pct(b.bossReachedPct)));
  row('Boss beaten', batches.map((b) => pct(b.winRate)));
  console.log();
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const RUNS_PER_STRATEGY = 500;

async function main() {
  const dbPath = resolve(import.meta.dirname!, '..', '..', 'data', 'game.db');
  const dbManager = new HeadlessDatabaseManager(dbPath);
  await dbManager.init();
  const repo = new CombatLogRepository(dbManager);

  const totalRuns = RUNS_PER_STRATEGY * ALL_STRATEGIES.length;
  console.log('=== DICE & CARDS — AUTOPLAY BALANCE REPORT ===');
  console.log(`${RUNS_PER_STRATEGY} runs per strategy × ${ALL_STRATEGIES.length} strategies = ${totalRuns} total runs`);
  console.log();

  const batches: BatchResult[] = [];

  for (const strategy of ALL_STRATEGIES) {
    const t0 = performance.now();
    const batch = runBatch(strategy, RUNS_PER_STRATEGY, repo);
    const elapsed = ((performance.now() - t0) / 1000).toFixed(2);
    console.log(`[${strategy.name}] ${RUNS_PER_STRATEGY} runs completed in ${elapsed}s`);
    batches.push(batch);
  }

  // Save to disk after all runs
  dbManager.saveNow();
  console.log(`\nDatabase saved to: ${dbPath}`);
  console.log();

  for (const b of batches) {
    printStrategyReport(b);
  }

  printBalanceFlags(batches);
  printComparisonTable(batches);
}

main().catch((err) => {
  console.error('Simulation failed:', err);
  process.exit(1);
});
