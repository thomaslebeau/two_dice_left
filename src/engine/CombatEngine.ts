import type { Card, EnemyCard } from '@/types/card.types';
import type { DiceResults, CombatCalculation, CombatEndResult } from '@/types/combat.types';
import type { DiceModifier } from '@/types/diceModifier.types';
import type { RoundLogEntry } from '@/db/types.ts';
import { rollPair, autoAllocate } from '@/core/DiceAllocator.ts';
import type { AllocationResult } from '@/core/DiceAllocator.ts';
import { calculateCombatResult, applyDamage } from '@shared/utils/combatCalculations';
import { timings } from '@/theme.ts';

// --- Phase ---

export type CombatPhase = 'rolling' | 'allocating' | 'resolving' | 'results' | 'finished';

// --- Snapshot ---

export interface CombatSnapshot {
  phase: CombatPhase;
  roundNumber: number;
  diceKey: number;
  playerDice: [number, number];
  enemyDice: [number, number];
  enemyAllocation: AllocationResult;
  playerAllocation: AllocationResult | null;
  diceResults: DiceResults | null;
  currentPlayerCard: Card;
  currentEnemyCard: EnemyCard;
  combatResult: CombatCalculation | null;
}

// --- Config ---

export interface CombatConfig {
  playerCard: Card;
  enemyCard: EnemyCard;
  eventAtkBonus: number;
  eventDefBonus: number;
  diceModifiers?: DiceModifier[];
  onCombatEnd: (result: CombatEndResult) => void;
  onCardUpdate?: (updatedPlayer: Card, updatedEnemy: EnemyCard) => void;
}

type CombatListener = (snapshot: CombatSnapshot) => void;

/**
 * Manages a single combat encounter with 2D6 allocation mechanics.
 *
 * Round flow:
 *   1. Roll 2 dice each for player and enemy
 *   2. Enemy auto-allocates based on allocationPattern
 *   3. Wait for dice animation (rolling phase)
 *   4. Wait for player to allocate dice (allocating phase)
 *   5. Compute totals, show results (resolving phase)
 *   6. Apply damage, check for combat end (results / finished phase)
 */
export class CombatEngine {
  // --- State ---
  private _phase: CombatPhase = 'rolling';
  private _roundNumber = 1;
  private _diceKey = 0;
  private _playerDice: [number, number] = [1, 1];
  private _enemyDice: [number, number] = [1, 1];
  private _enemyAllocation: AllocationResult = { atkDie: 1, defDie: 1 };
  private _playerAllocation: AllocationResult | null = null;
  private _diceResults: DiceResults | null = null;
  private _currentPlayerCard: Card;
  private _currentEnemyCard: EnemyCard;
  private _combatResult: CombatCalculation | null = null;

  // --- Run bonuses ---
  private eventAtkBonus: number;
  private eventDefBonus: number;
  private diceModifiers: DiceModifier[];

  // --- Round log ---
  private _roundsLog: RoundLogEntry[] = [];

  // --- Callbacks ---
  private onCombatEnd: CombatConfig['onCombatEnd'];
  private onCardUpdate: CombatConfig['onCardUpdate'];

  // --- Async allocation ---
  private _resolveAllocation: ((result: AllocationResult) => void) | null = null;

  // --- Lifecycle ---
  private destroyed = false;
  private timers: ReturnType<typeof setTimeout>[] = [];
  private listeners = new Set<CombatListener>();

  constructor(config: CombatConfig) {
    this._currentPlayerCard = { ...config.playerCard };
    this._currentEnemyCard = { ...config.enemyCard };
    this.eventAtkBonus = config.eventAtkBonus;
    this.eventDefBonus = config.eventDefBonus;
    this.diceModifiers = config.diceModifiers ?? [];
    this.onCombatEnd = config.onCombatEnd;
    this.onCardUpdate = config.onCardUpdate;

    this.runRound();
  }

  // --- Read-only accessors ---

  get phase(): CombatPhase { return this._phase; }
  get roundNumber(): number { return this._roundNumber; }
  get diceKey(): number { return this._diceKey; }
  get playerDice(): [number, number] { return this._playerDice; }
  get enemyDice(): [number, number] { return this._enemyDice; }
  get enemyAllocation(): AllocationResult { return this._enemyAllocation; }
  get playerAllocation(): AllocationResult | null { return this._playerAllocation; }
  get currentPlayerCard(): Card { return this._currentPlayerCard; }
  get currentEnemyCard(): EnemyCard { return this._currentEnemyCard; }
  get roundsLog(): readonly RoundLogEntry[] { return this._roundsLog; }

  // --- Subscription ---

  onChange(listener: CombatListener): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  private emit(): void {
    if (this.destroyed) return;
    const snap = this.snapshot();
    for (const listener of this.listeners) {
      listener(snap);
    }
  }

  snapshot(): CombatSnapshot {
    return {
      phase: this._phase,
      roundNumber: this._roundNumber,
      diceKey: this._diceKey,
      playerDice: [...this._playerDice] as [number, number],
      enemyDice: [...this._enemyDice] as [number, number],
      enemyAllocation: { ...this._enemyAllocation },
      playerAllocation: this._playerAllocation ? { ...this._playerAllocation } : null,
      diceResults: this._diceResults ? { ...this._diceResults } : null,
      currentPlayerCard: { ...this._currentPlayerCard },
      currentEnemyCard: { ...this._currentEnemyCard },
      combatResult: this._combatResult ? { ...this._combatResult } : null,
    };
  }

  // --- Round lifecycle (async) ---

  private async runRound(): Promise<void> {
    if (this.destroyed) return;

    // 1. Roll dice (player uses event-granted dice modifiers, up to 2)
    const [mod1, mod2] = [this.diceModifiers[0] ?? null, this.diceModifiers[1] ?? null];
    this._playerDice = rollPair(mod1, mod2);
    this._enemyDice = rollPair();
    this._enemyAllocation = autoAllocate(this._enemyDice, this._currentEnemyCard.allocationPattern);
    this._playerAllocation = null;
    this._diceResults = null;
    this._combatResult = null;

    // 2. Rolling phase — dice animation plays
    this._phase = 'rolling';
    this.emit();

    // 3. Wait for dice animation
    await this.delay(timings.diceRoll);
    if (this.destroyed) return;

    // 4. Allocation phase — player assigns dice
    this._phase = 'allocating';
    this.emit();

    // 5. Wait for player allocation
    const playerAllocation = await this.waitForPlayerAllocation();
    if (this.destroyed) return;
    this._playerAllocation = playerAllocation;

    // 6. Build DiceResults (event bonuses baked into "roll" values so
    //    calculateCombatResult adds card mods on top as before)
    this._diceResults = {
      playerAttack: playerAllocation.atkDie + this.eventAtkBonus,
      playerDefense: playerAllocation.defDie + this.eventDefBonus,
      enemyAttack: this._enemyAllocation.atkDie,
      enemyDefense: this._enemyAllocation.defDie,
    };

    // 7. Compute combat result
    this._combatResult = calculateCombatResult(
      this._diceResults,
      this._currentPlayerCard,
      this._currentEnemyCard,
    );

    // 8. Resolving phase — show damage numbers
    this._phase = 'resolving';
    this.emit();

    // 9. Wait for damage display
    await this.delay(timings.resultDelay);
    if (this.destroyed) return;

    // 10. Apply damage
    const { updatedPlayer, updatedEnemy } = applyDamage(
      this._currentPlayerCard,
      this._currentEnemyCard,
      this._combatResult,
    );

    this._currentPlayerCard = updatedPlayer;
    this._currentEnemyCard = updatedEnemy as EnemyCard;

    // 11. Log round
    this._roundsLog.push({
      roundNumber: this._roundNumber,
      playerAttackRoll: playerAllocation.atkDie,
      playerDefenseRoll: playerAllocation.defDie,
      enemyAttackRoll: this._enemyAllocation.atkDie,
      enemyDefenseRoll: this._enemyAllocation.defDie,
      playerAttackTotal: this._combatResult.playerAttack,
      playerDefenseTotal: this._combatResult.playerDefense,
      enemyAttackTotal: this._combatResult.enemyAttack,
      enemyDefenseTotal: this._combatResult.enemyDefense,
      damageToPlayer: this._combatResult.damageToPlayer,
      damageToEnemy: this._combatResult.damageToEnemy,
      playerHpAfter: updatedPlayer.currentHp,
      enemyHpAfter: updatedEnemy.currentHp,
    });

    // 12. Notify parent of HP changes
    this.onCardUpdate?.(updatedPlayer, updatedEnemy as EnemyCard);

    // 13. Check for combat end
    if (updatedPlayer.currentHp <= 0 || updatedEnemy.currentHp <= 0) {
      this._phase = 'finished';
      this.emit();

      await this.delay(timings.combatEndDelay);
      if (this.destroyed) return;

      const victory = updatedEnemy.currentHp <= 0;
      this.onCombatEnd({ victory, playerCard: updatedPlayer, roundsLog: this._roundsLog });
    } else {
      // Round resolved — wait for player to click "Next Round"
      this._phase = 'results';
      this.emit();
    }
  }

  // --- Player allocation Promise ---

  private waitForPlayerAllocation(): Promise<AllocationResult> {
    return new Promise((resolve) => {
      this._resolveAllocation = resolve;
    });
  }

  /**
   * Called from the scene UI when the player confirms their dice allocation.
   */
  submitAllocation(allocation: AllocationResult): void {
    this._resolveAllocation?.(allocation);
    this._resolveAllocation = null;
  }

  // --- Actions ---

  /**
   * Advance to the next round. Called after 'results' phase.
   */
  handleNextRound(): void {
    if (this._phase !== 'results' || this.destroyed) return;
    this._roundNumber += 1;
    this._diceKey += 1;
    this.runRound();
  }

  /**
   * Preview what damage would occur for a given player allocation.
   * Used by the UI to show damage estimates during allocation phase.
   */
  previewAllocation(allocation: AllocationResult): CombatCalculation {
    const diceResults: DiceResults = {
      playerAttack: allocation.atkDie + this.eventAtkBonus,
      playerDefense: allocation.defDie + this.eventDefBonus,
      enemyAttack: this._enemyAllocation.atkDie,
      enemyDefense: this._enemyAllocation.defDie,
    };
    return calculateCombatResult(diceResults, this._currentPlayerCard, this._currentEnemyCard);
  }

  /**
   * Get the player's event bonuses (for UI display).
   */
  getEventBonuses(): { atkBonus: number; defBonus: number } {
    return { atkBonus: this.eventAtkBonus, defBonus: this.eventDefBonus };
  }

  // --- Timer helper ---

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const t = setTimeout(resolve, ms);
      this.timers.push(t);
    });
  }

  // --- Cleanup ---

  /**
   * Clean up all pending timers and async operations.
   */
  destroy(): void {
    this.destroyed = true;
    for (const t of this.timers) clearTimeout(t);
    this.timers.length = 0;
    // Resolve pending allocation to unblock the async chain
    this._resolveAllocation?.({ atkDie: 1, defDie: 1 });
    this._resolveAllocation = null;
    this.listeners.clear();
  }
}
