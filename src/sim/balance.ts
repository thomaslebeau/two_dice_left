/**
 * V6 Monte Carlo balance simulation.
 * Run: npx tsx src/sim/balance.ts
 *
 * Runs 10,000 iterations per survivor × strategy combo.
 * Reports win rates, strategy hierarchy, zero-round stats,
 * death distribution, and balance flags.
 *
 * If smart strategy is outside 35-45%, auto-tunes HP multipliers and re-runs.
 */

import type { Equipment, Enemy, Survivor, Strategy, CombatResult } from '../engine/types';
import { simulateCombat } from '../engine/combat';
import { ALL_SURVIVORS } from '../data/survivors';
import { ALL_LOOT } from '../data/equipment';
import { ENEMY_TEMPLATES, COMBAT_TIERS } from '../data/enemies';
import type { CombatTier } from '../data/enemies';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const ITERATIONS = 10_000;
const MAX_COMBATS = 5;
const HEAL_AMOUNT = 2;
const STRATEGIES: Strategy[] = ['smart', 'aggressive', 'defensive', 'random'];

// ---------------------------------------------------------------------------
// Balanced event strategy: heal when HP < 40%, loot otherwise (60% chance)
// ---------------------------------------------------------------------------

function chooseBalancedEvent(
  currentHp: number,
  maxHp: number,
  lootAvailable: boolean,
): 'loot' | 'heal' {
  if (currentHp / maxHp < 0.4) return 'heal';
  if (!lootAvailable) return 'heal';
  return Math.random() < 0.6 ? 'loot' : 'heal';
}

// ---------------------------------------------------------------------------
// Run simulation (local, with tunable multipliers)
// ---------------------------------------------------------------------------

interface DetailedRunResult {
  won: boolean;
  combatReached: number;
  speedKills: number;
  totalRounds: number;
  totalZeroRounds: number;
  totalCombats: number;
  roundsPerCombat: number[];  // index 0-4 = combat 1-5
  zeroPerCombat: number[];
}

function pickEnemy(
  combatIndex: number,
  tiers: readonly CombatTier[],
  enemies: readonly Enemy[],
): Enemy {
  const tier = tiers[combatIndex];
  const pool = enemies.filter(e => tier.pool.includes(e.id));
  const base = pool[Math.floor(Math.random() * pool.length)];
  const scaledHp = Math.max(1, Math.round(base.maxHp * tier.hpMultiplier));
  return { ...base, hp: scaledHp, maxHp: scaledHp };
}

function pickLoot(
  lootPool: readonly Equipment[],
  usedIds: Set<string>,
): Equipment | null {
  const available = lootPool.filter(eq => !usedIds.has(eq.id));
  if (available.length === 0) return null;
  return available[Math.floor(Math.random() * available.length)];
}

function simulateRun(
  survivor: Survivor,
  strategy: Strategy,
  tiers: readonly CombatTier[],
  enemies: readonly Enemy[],
  lootPool: readonly Equipment[],
): DetailedRunResult {
  let hp = survivor.hp;
  const maxHp = survivor.maxHp;
  let equipment = [...survivor.equipment];
  const usedLootIds = new Set<string>();

  let combatReached = 0;
  let speedKills = 0;
  let totalRounds = 0;
  let totalZeroRounds = 0;
  let totalCombats = 0;
  const roundsPerCombat: number[] = [];
  const zeroPerCombat: number[] = [];

  for (let i = 0; i < MAX_COMBATS; i++) {
    combatReached = i + 1;
    totalCombats++;

    const enemy = pickEnemy(i, tiers, enemies);
    const result: CombatResult = simulateCombat(
      hp, maxHp, equipment,
      enemy.hp, enemy.equipment, enemy.pattern,
      strategy,
    );

    totalRounds += result.rounds;
    totalZeroRounds += result.zeroRounds;
    roundsPerCombat.push(result.rounds);
    zeroPerCombat.push(result.zeroRounds);

    if (!result.won) {
      return { won: false, combatReached, speedKills, totalRounds, totalZeroRounds, totalCombats, roundsPerCombat, zeroPerCombat };
    }

    hp = result.playerHpAfter;
    if (result.speedKill) speedKills++;

    // Event between combats (not after last)
    if (i < MAX_COMBATS - 1) {
      const loot = pickLoot(lootPool, usedLootIds);
      const choice = chooseBalancedEvent(hp, maxHp, loot !== null);

      if (choice === 'loot' && loot !== null) {
        equipment = [...equipment, loot];
        usedLootIds.add(loot.id);
      } else {
        hp = Math.min(maxHp, hp + HEAL_AMOUNT);
      }
    }
  }

  return { won: true, combatReached, speedKills, totalRounds, totalZeroRounds, totalCombats, roundsPerCombat, zeroPerCombat };
}

// ---------------------------------------------------------------------------
// Aggregation
// ---------------------------------------------------------------------------

interface StrategyStats {
  wins: number;
  runs: number;
  totalRounds: number;
  totalZeroRounds: number;
  totalCombats: number;
  deaths: number[];  // index = combat number (1-5), value = count
  tierRounds: number[];  // index 0-4, sum of rounds for that tier
  tierCombats: number[]; // index 0-4, count of combats at that tier
  tierZero: number[];    // index 0-4, sum of zero-damage rounds
}

interface SurvivorStats {
  byStrategy: Map<Strategy, StrategyStats>;
}

function createEmptyStats(): StrategyStats {
  return {
    wins: 0, runs: 0, totalRounds: 0, totalZeroRounds: 0, totalCombats: 0,
    deaths: [0, 0, 0, 0, 0, 0],  // index 0 unused, 1-5 = combat number
    tierRounds: [0, 0, 0, 0, 0],
    tierCombats: [0, 0, 0, 0, 0],
    tierZero: [0, 0, 0, 0, 0],
  };
}

function runSimulation(
  tiers: readonly CombatTier[],
): Map<string, SurvivorStats> {
  const results = new Map<string, SurvivorStats>();

  for (const survivor of ALL_SURVIVORS) {
    const survivorStats: SurvivorStats = { byStrategy: new Map() };

    for (const strategy of STRATEGIES) {
      const stats = createEmptyStats();

      for (let i = 0; i < ITERATIONS; i++) {
        const result = simulateRun(survivor, strategy, tiers, ENEMY_TEMPLATES, ALL_LOOT);
        stats.runs++;
        stats.totalRounds += result.totalRounds;
        stats.totalZeroRounds += result.totalZeroRounds;
        stats.totalCombats += result.totalCombats;
        for (let c = 0; c < result.roundsPerCombat.length; c++) {
          stats.tierRounds[c] += result.roundsPerCombat[c];
          stats.tierCombats[c]++;
          stats.tierZero[c] += result.zeroPerCombat[c];
        }
        if (result.won) {
          stats.wins++;
        } else {
          stats.deaths[result.combatReached]++;
        }
      }

      survivorStats.byStrategy.set(strategy, stats);
    }

    results.set(survivor.name, survivorStats);
  }

  return results;
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

function f1(v: number): string { return v.toFixed(1); }
function f2(v: number): string { return v.toFixed(2); }
function pct(n: number, d: number): string { return d > 0 ? f1((n / d) * 100) : '0.0'; }
function pad(s: string, n: number): string { return s.padEnd(n); }

function printReport(
  results: Map<string, SurvivorStats>,
  tiers: readonly CombatTier[],
): { smartWinRate: number; hierarchy: boolean } {
  const mults = tiers.map(t => t.hpMultiplier);
  console.log(`\n${'='.repeat(70)}`);
  console.log(`  V6 BALANCE REPORT — HP multipliers: [${mults.map(m => f2(m)).join(', ')}]`);
  console.log(`  ${ITERATIONS.toLocaleString()} iterations per combo, ${ALL_SURVIVORS.length} survivors × ${STRATEGIES.length} strategies`);
  console.log(`${'='.repeat(70)}`);

  // 1. Win rate by strategy (aggregate across all survivors)
  const stratTotals = new Map<Strategy, { wins: number; runs: number }>();
  for (const s of STRATEGIES) stratTotals.set(s, { wins: 0, runs: 0 });

  for (const [, surv] of results) {
    for (const [strat, stats] of surv.byStrategy) {
      const t = stratTotals.get(strat)!;
      t.wins += stats.wins;
      t.runs += stats.runs;
    }
  }

  console.log('\n--- 1. WIN RATE BY STRATEGY ---');
  console.log(`${pad('Strategy', 14)} ${pad('Win Rate', 10)} ${pad('Target', 12)} ${pad('Status', 6)}`);
  console.log('-'.repeat(44));

  const targets: Record<string, [number, number]> = {
    smart: [35, 45], aggressive: [25, 35], random: [10, 15], defensive: [0, 100],
  };

  const stratWinRates = new Map<Strategy, number>();
  for (const s of STRATEGIES) {
    const t = stratTotals.get(s)!;
    const wr = (t.wins / t.runs) * 100;
    stratWinRates.set(s, wr);
    const [lo, hi] = targets[s] ?? [0, 100];
    const status = (s === 'defensive') ? '--' : (wr >= lo && wr <= hi ? 'OK' : 'MISS');
    const targetStr = (s === 'defensive') ? '< random' : `${lo}-${hi}%`;
    console.log(`${pad(s, 14)} ${pad(f1(wr) + '%', 10)} ${pad(targetStr, 12)} ${status}`);
  }

  // 2. Win rate by survivor (smart strategy)
  console.log('\n--- 2. WIN RATE BY SURVIVOR (smart strategy) ---');
  console.log(`${pad('Survivor', 20)} ${pad('Win Rate', 10)} ${pad('Spread', 10)}`);
  console.log('-'.repeat(42));

  const smartRates: number[] = [];
  for (const survivor of ALL_SURVIVORS) {
    const stats = results.get(survivor.name)!.byStrategy.get('smart')!;
    const wr = (stats.wins / stats.runs) * 100;
    smartRates.push(wr);
    console.log(`${pad(survivor.name, 20)} ${pad(f1(wr) + '%', 10)}`);
  }
  const smartMax = Math.max(...smartRates);
  const smartMin = Math.min(...smartRates);
  const spread = smartMax - smartMin;
  console.log(`Spread: ${f1(spread)}pp (target: < 5pp) ${spread <= 5 ? 'OK' : 'MISS'}`);

  // 3. Strategy hierarchy
  console.log('\n--- 3. STRATEGY HIERARCHY ---');
  const smartWr = stratWinRates.get('smart')!;
  const aggroWr = stratWinRates.get('aggressive')!;
  const randomWr = stratWinRates.get('random')!;
  const defWr = stratWinRates.get('defensive')!;

  const checks = [
    { label: 'smart > aggressive', ok: smartWr > aggroWr, a: smartWr, b: aggroWr },
    { label: 'aggressive > random', ok: aggroWr > randomWr, a: aggroWr, b: randomWr },
    { label: 'random > defensive', ok: randomWr > defWr, a: randomWr, b: defWr },
  ];
  let hierarchyOk = true;
  for (const c of checks) {
    const status = c.ok ? 'OK' : 'FAIL';
    if (!c.ok) hierarchyOk = false;
    console.log(`  ${status}  ${c.label}: ${f1(c.a)}% vs ${f1(c.b)}%`);
  }

  // 4. Zero-damage rounds per combat
  console.log('\n--- 4. ZERO-DAMAGE ROUNDS ---');
  let allZeroRounds = 0;
  let allCombats = 0;
  let smartZeroRounds = 0;
  let smartCombats = 0;
  for (const [, surv] of results) {
    for (const [strat, stats] of surv.byStrategy) {
      allZeroRounds += stats.totalZeroRounds;
      allCombats += stats.totalCombats;
      if (strat === 'smart') {
        smartZeroRounds += stats.totalZeroRounds;
        smartCombats += stats.totalCombats;
      }
    }
  }
  const zeroPerCombat = allCombats > 0 ? allZeroRounds / allCombats : 0;
  const smartZeroPerCombat = smartCombats > 0 ? smartZeroRounds / smartCombats : 0;
  console.log(`  All strategies:  ${f2(zeroPerCombat)} zero-dmg rounds/combat`);
  console.log(`  Smart strategy:  ${f2(smartZeroPerCombat)} zero-dmg rounds/combat (target: < 0.1) ${smartZeroPerCombat < 0.1 ? 'OK' : 'MISS'}`);

  // 5. Average rounds per combat
  console.log('\n--- 5. AVERAGE ROUNDS PER COMBAT ---');
  let allRounds = 0;
  allCombats = 0;
  for (const [, surv] of results) {
    for (const [, stats] of surv.byStrategy) {
      allRounds += stats.totalRounds;
      allCombats += stats.totalCombats;
    }
  }
  const avgRounds = allCombats > 0 ? allRounds / allCombats : 0;
  console.log(`  Avg rounds/combat: ${f1(avgRounds)} (target: 3-5) ${avgRounds >= 3 && avgRounds <= 5 ? 'OK' : 'MISS'}`);

  // 5b. Per-tier breakdown (smart strategy, all survivors aggregated)
  console.log('\n  Per-combat-tier breakdown (smart):');
  console.log(`  ${pad('Tier', 6)} ${pad('Avg Rds', 10)} ${pad('Zero/combat', 14)} ${pad('Combats', 10)}`);
  console.log('  ' + '-'.repeat(42));
  const tierRounds = [0, 0, 0, 0, 0];
  const tierCombats = [0, 0, 0, 0, 0];
  const tierZero = [0, 0, 0, 0, 0];
  for (const [, surv] of results) {
    const stats = surv.byStrategy.get('smart')!;
    for (let c = 0; c < 5; c++) {
      tierRounds[c] += stats.tierRounds[c];
      tierCombats[c] += stats.tierCombats[c];
      tierZero[c] += stats.tierZero[c];
    }
  }
  for (let c = 0; c < 5; c++) {
    const avgR = tierCombats[c] > 0 ? tierRounds[c] / tierCombats[c] : 0;
    const avgZ = tierCombats[c] > 0 ? tierZero[c] / tierCombats[c] : 0;
    console.log(`  ${pad('C' + (c + 1), 6)} ${pad(f1(avgR), 10)} ${pad(f2(avgZ), 14)} ${tierCombats[c]}`);
  }

  // 6. Death distribution (smart strategy only)
  console.log('\n--- 6. DEATH DISTRIBUTION (smart strategy) ---');
  const deathByCombat = [0, 0, 0, 0, 0, 0];
  let totalDeaths = 0;
  for (const [, surv] of results) {
    const stats = surv.byStrategy.get('smart')!;
    for (let c = 1; c <= 5; c++) {
      deathByCombat[c] += stats.deaths[c];
      totalDeaths += stats.deaths[c];
    }
  }
  console.log(`${pad('Combat', 10)} ${pad('Deaths', 10)} ${pad('% of deaths', 12)}`);
  console.log('-'.repeat(34));
  for (let c = 1; c <= 5; c++) {
    console.log(`${pad('C' + c, 10)} ${pad(String(deathByCombat[c]), 10)} ${pct(deathByCombat[c], totalDeaths)}%`);
  }

  console.log(`\n${'='.repeat(70)}\n`);
  return { smartWinRate: smartWr, hierarchy: hierarchyOk };
}

// ---------------------------------------------------------------------------
// Auto-tuning loop
// ---------------------------------------------------------------------------

function tuneTiers(
  baseTiers: readonly CombatTier[],
  smartWinRate: number,
): CombatTier[] {
  // Scale multipliers proportionally to move smart win rate toward 40%
  const targetMid = 40;
  const ratio = smartWinRate / targetMid;

  // If win rate too high, increase multipliers (harder enemies).
  // If too low, decrease (easier enemies).
  // Dampen adjustment to avoid oscillation.
  const dampening = 0.5;
  const adjustment = 1 + (ratio - 1) * dampening;

  return baseTiers.map(t => ({
    ...t,
    // Clamp between 0.05 and 2.0
    hpMultiplier: Math.min(2.0, Math.max(0.05, t.hpMultiplier * adjustment)),
  }));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  const MAX_TUNING_PASSES = 8;
  let currentTiers: CombatTier[] = [...COMBAT_TIERS];
  let finalTiers = currentTiers;

  for (let pass = 0; pass < MAX_TUNING_PASSES; pass++) {
    console.log(`\n>>> PASS ${pass + 1} / ${MAX_TUNING_PASSES}`);
    const t0 = performance.now();

    const results = runSimulation(currentTiers);
    const elapsed = ((performance.now() - t0) / 1000).toFixed(1);
    console.log(`  Simulation completed in ${elapsed}s`);

    const { smartWinRate, hierarchy } = printReport(results, currentTiers);
    finalTiers = currentTiers;

    // Check if we're in target range
    if (smartWinRate >= 35 && smartWinRate <= 45) {
      console.log(`>>> SMART WIN RATE ${f1(smartWinRate)}% — IN TARGET RANGE [35-45%]`);
      if (hierarchy) {
        console.log('>>> HIERARCHY OK — done tuning.');
      } else {
        console.log('>>> HIERARCHY BROKEN — but win rate is in range. Accepting.');
      }
      break;
    }

    if (pass < MAX_TUNING_PASSES - 1) {
      const direction = smartWinRate > 45 ? 'increasing' : 'decreasing';
      console.log(`>>> SMART WIN RATE ${f1(smartWinRate)}% — out of range, ${direction} enemy HP...`);
      currentTiers = tuneTiers(currentTiers, smartWinRate);
    } else {
      console.log(`>>> MAX PASSES REACHED — accepting ${f1(smartWinRate)}%`);
    }
  }

  // Print final multipliers for updating enemies.ts
  console.log('\n>>> FINAL HP MULTIPLIERS:');
  const mults = finalTiers.map(t => Number(t.hpMultiplier.toFixed(4)));
  console.log(`  [${mults.join(', ')}]`);
  console.log('\nUpdate src/data/enemies.ts COMBAT_TIERS with these values.');
  console.log('Update src/engine/run.ts HP_MULTIPLIERS with these values.');
}

main();
