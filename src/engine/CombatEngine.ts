import type { Card, EnemyCard } from '@/types/card.types';
import type { DiceResults, CombatCalculation, CombatEndResult } from '@/types/combat.types';
import { rollDice } from '@shared/constants/dice';
import { calculateCombatResult, applyDamage } from '@shared/utils/combatCalculations';
import { timings } from '@/theme.ts';

/**
 * Snapshot of the combat engine state, emitted to listeners on every change.
 */
export interface CombatSnapshot {
  roundNumber: number;
  diceKey: number;
  diceResults: DiceResults;
  showResults: boolean;
  roundResolved: boolean;
  combatFinished: boolean;
  currentPlayerCard: Card;
  currentEnemyCard: EnemyCard;
  combatResult: CombatCalculation | null;
}

/**
 * Configuration passed when starting a combat.
 */
export interface CombatConfig {
  playerCard: Card;
  enemyCard: EnemyCard;
  onCombatEnd: (result: CombatEndResult) => void;
  onCardUpdate?: (updatedPlayer: Card, updatedEnemy: EnemyCard) => void;
}

type CombatListener = (snapshot: CombatSnapshot) => void;

/**
 * Manages a single combat encounter: dice rolls, damage timing, round progression.
 * Extracted from the React useCombatLogic hook.
 *
 * Timers use setTimeout (not React useEffect). Call destroy() to clean up.
 */
export class CombatEngine {
  // --- State ---
  private _roundNumber = 1;
  private _diceKey = 0;
  private _diceResults: DiceResults;
  private _showResults = false;
  private _roundResolved = false;
  private _combatFinished = false;
  private _currentPlayerCard: Card;
  private _currentEnemyCard: EnemyCard;

  // --- Callbacks ---
  private onCombatEnd: CombatConfig['onCombatEnd'];
  private onCardUpdate: CombatConfig['onCardUpdate'];

  // --- Listeners ---
  private listeners = new Set<CombatListener>();

  // --- Timer handles for cleanup ---
  private timers: ReturnType<typeof setTimeout>[] = [];

  constructor(config: CombatConfig) {
    this._currentPlayerCard = { ...config.playerCard };
    this._currentEnemyCard = { ...config.enemyCard };
    this.onCombatEnd = config.onCombatEnd;
    this.onCardUpdate = config.onCardUpdate;

    // Initial dice roll
    this._diceResults = {
      playerAttack: rollDice(),
      playerDefense: rollDice(),
      enemyAttack: rollDice(),
      enemyDefense: rollDice(),
    };

    // Start the reveal/resolve timer chain for the first round
    this.scheduleReveal();
  }

  // --- Read-only accessors ---

  get roundNumber(): number { return this._roundNumber; }
  get diceKey(): number { return this._diceKey; }
  get diceResults(): DiceResults { return this._diceResults; }
  get showResults(): boolean { return this._showResults; }
  get roundResolved(): boolean { return this._roundResolved; }
  get combatFinished(): boolean { return this._combatFinished; }
  get currentPlayerCard(): Card { return this._currentPlayerCard; }
  get currentEnemyCard(): EnemyCard { return this._currentEnemyCard; }

  get combatResult(): CombatCalculation | null {
    if (!this._showResults) return null;
    return calculateCombatResult(
      this._diceResults,
      this._currentPlayerCard,
      this._currentEnemyCard,
    );
  }

  // --- Subscription ---

  onChange(listener: CombatListener): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  private emit(): void {
    const snap = this.snapshot();
    for (const listener of this.listeners) {
      listener(snap);
    }
  }

  snapshot(): CombatSnapshot {
    return {
      roundNumber: this._roundNumber,
      diceKey: this._diceKey,
      diceResults: { ...this._diceResults },
      showResults: this._showResults,
      roundResolved: this._roundResolved,
      combatFinished: this._combatFinished,
      currentPlayerCard: { ...this._currentPlayerCard },
      currentEnemyCard: { ...this._currentEnemyCard },
      combatResult: this.combatResult,
    };
  }

  // --- Timer chain ---

  /**
   * After dice animation (2100ms), reveal results then schedule damage.
   */
  private scheduleReveal(): void {
    const t = setTimeout(() => {
      this._showResults = true;
      this.emit();
      this.scheduleResolve();
    }, timings.diceRoll);
    this.timers.push(t);
  }

  /**
   * After results are shown (1000ms), apply damage and check for combat end.
   */
  private scheduleResolve(): void {
    if (this._roundResolved || this._combatFinished) return;

    const t = setTimeout(() => {
      const calculation = calculateCombatResult(
        this._diceResults,
        this._currentPlayerCard,
        this._currentEnemyCard,
      );

      const { updatedPlayer, updatedEnemy } = applyDamage(
        this._currentPlayerCard,
        this._currentEnemyCard,
        calculation,
      );

      this._currentPlayerCard = updatedPlayer;
      this._currentEnemyCard = updatedEnemy as EnemyCard;
      this._roundResolved = true;

      // Notify parent of HP changes
      this.onCardUpdate?.(updatedPlayer, updatedEnemy as EnemyCard);

      // Check for combat end
      if (updatedPlayer.currentHp <= 0 || updatedEnemy.currentHp <= 0) {
        this._combatFinished = true;
        this.emit();
        this.scheduleCombatEnd(updatedEnemy.currentHp <= 0, updatedPlayer);
      } else {
        this.emit();
      }
    }, timings.resultDelay);
    this.timers.push(t);
  }

  /**
   * After combat is finished (2000ms), fire the onCombatEnd callback.
   */
  private scheduleCombatEnd(victory: boolean, playerCard: Card): void {
    const t = setTimeout(() => {
      this.onCombatEnd({ victory, playerCard });
    }, timings.combatEndDelay);
    this.timers.push(t);
  }

  // --- Actions ---

  /**
   * Advance to the next round. Re-rolls all dice and restarts the timer chain.
   */
  handleNextRound(): void {
    if (this._combatFinished) return;

    this._roundNumber += 1;
    this._diceKey += 1;
    this._diceResults = {
      playerAttack: rollDice(),
      playerDefense: rollDice(),
      enemyAttack: rollDice(),
      enemyDefense: rollDice(),
    };
    this._showResults = false;
    this._roundResolved = false;

    this.emit();
    this.scheduleReveal();
  }

  /**
   * Clean up all pending timers. Call this when the combat scene is removed.
   */
  destroy(): void {
    for (const t of this.timers) {
      clearTimeout(t);
    }
    this.timers.length = 0;
    this.listeners.clear();
  }
}
