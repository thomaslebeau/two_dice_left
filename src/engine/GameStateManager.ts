import type { Card, EnemyCard } from '@/types/card.types';
import type { CombatEndResult } from '@/types/combat.types';
import type { GameEvent } from '@/types/event.types';
import type { DiceModifier } from '@/types/diceModifier.types';
import { GameState } from '@enums/GameState.enum';
import { MAX_COMBATS } from '@shared/constants/cards';
import { generateEnemy } from '@shared/utils/enemyGenerator';
import { markCardAsDeadIfNeeded } from '@/shared/utils/cardDeathUtils';
import { EventSystem } from '@/core/EventSystem.ts';
import type { ChoiceResult } from '@/core/EventSystem.ts';
import { MetaProgression } from '@/core/MetaProgression.ts';
import type { UnlockResult } from '@/core/MetaProgression.ts';
import { CombatLogRepository } from '@/db/CombatLogRepository.ts';
import type { DbProvider } from '@/db/types.ts';
import { sendRunData } from '@/core/Telemetry.ts';

// --- Snapshot ---

export interface GameStateSnapshot {
  gameState: GameState;
  currentCombat: number;
  playerCard: Card | null;
  enemyCard: EnemyCard | null;
  survivor: Card | null;
  atkBonus: number;
  defBonus: number;
  diceModifiers: DiceModifier[];
  currentEvent: GameEvent | null;
  victory: boolean | null;
  pendingUnlocks: UnlockResult[];
}

type GameStateListener = (snapshot: GameStateSnapshot) => void;

const SPEED_KILL_THRESHOLD = 3;
const SPEED_KILL_RECOVERY = 3;

/**
 * Central game state machine (v5: single-survivor run with event loop).
 * Uses a simple listener callback list for change notifications.
 */
export class GameStateManager {
  private _gameState: GameState = GameState.MENU;
  private _currentCombat = 0;
  private _playerCard: Card | null = null;
  private _enemyCard: EnemyCard | null = null;
  private _survivor: Card | null = null;
  private _atkBonus = 0;
  private _defBonus = 0;
  private _diceModifiers: DiceModifier[] = [];
  private _victory: boolean | null = null;

  // --- Event system ---
  private eventSystem = new EventSystem();

  // --- Meta-progression ---
  private meta = new MetaProgression();
  private _pendingUnlocks: UnlockResult[] = [];
  private _metaRecorded = false;

  // --- Telemetry ---
  private _runStartTime = 0;
  private _speedKills = 0;
  private _hpRecovered = 0;

  // --- Database (optional — game works without it) ---
  private dbManager: DbProvider | null = null;
  private repo: CombatLogRepository | null = null;
  private _currentRunId: number | null = null;
  private _playerStartHp = 0;
  private _enemyStartHp = 0;

  private listeners: Set<GameStateListener> = new Set();

  // --- Read-only accessors ---

  get gameState(): GameState { return this._gameState; }
  get currentCombat(): number { return this._currentCombat; }
  get playerCard(): Card | null { return this._playerCard; }
  get enemyCard(): EnemyCard | null { return this._enemyCard; }
  get survivor(): Card | null { return this._survivor; }
  get atkBonus(): number { return this._atkBonus; }
  get defBonus(): number { return this._defBonus; }
  get diceModifiers(): DiceModifier[] { return this._diceModifiers; }
  get currentEvent(): GameEvent | null { return this.eventSystem.currentEvent; }
  get victory(): boolean | null { return this._victory; }
  get unlockedSurvivorIds(): number[] { return this.meta.getUnlockedSurvivorIds(); }
  get unlockedDiceModifierIds(): string[] { return this.meta.getUnlockedDiceModifierIds(); }
  get metaProgression(): MetaProgression { return this.meta; }

  // --- Database setup ---

  setDatabase(dbManager: DbProvider): void {
    this.dbManager = dbManager;
    this.repo = new CombatLogRepository(dbManager);
  }

  // --- Event subscription ---

  onChange(listener: GameStateListener): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  private emit(): void {
    const snapshot = this.snapshot();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }

  snapshot(): GameStateSnapshot {
    return {
      gameState: this._gameState,
      currentCombat: this._currentCombat,
      playerCard: this._playerCard,
      enemyCard: this._enemyCard,
      survivor: this._survivor ? { ...this._survivor } : null,
      atkBonus: this._atkBonus,
      defBonus: this._defBonus,
      diceModifiers: [...this._diceModifiers],
      currentEvent: this.eventSystem.currentEvent,
      victory: this._victory,
      pendingUnlocks: [...this._pendingUnlocks],
    };
  }

  // --- State transitions ---

  /**
   * Start a new run.
   * MENU -> SURVIVOR_SELECTION
   */
  startNewRun(): void {
    this._survivor = null;
    this._playerCard = null;
    this._enemyCard = null;
    this._currentCombat = 0;
    this._atkBonus = 0;
    this._defBonus = 0;
    this._diceModifiers = [];
    this._victory = null;
    this.eventSystem.reset();
    this.eventSystem.setUnlockedModifiers(this.meta.getUnlockedDiceModifierIds());

    // Create DB run record
    if (this.repo) {
      try {
        this._currentRunId = this.repo.createRun('survivor-run');
        this.dbManager?.scheduleSave();
      } catch (err) {
        console.warn('[CombatLog] Failed to create run:', err);
        this._currentRunId = null;
      }
    }

    this._gameState = GameState.SURVIVOR_SELECTION;
    this.emit();
  }

  /**
   * Player chose their survivor for the entire run.
   * SURVIVOR_SELECTION -> COMBAT (combat 1)
   */
  handleSurvivorChosen(card: Card): void {
    this._survivor = { ...card, currentHp: card.maxHp };
    this._playerCard = { ...this._survivor };
    this._playerStartHp = this._playerCard.currentHp;
    this._runStartTime = Date.now();
    this._speedKills = 0;
    this._hpRecovered = 0;
    this._currentCombat = 1;
    this.startCombat(this._currentCombat);
  }

  private startCombat(combatNum: number): void {
    // Survivor HP persists — use current survivor state as player card
    this._playerCard = { ...this._survivor! };
    this._playerStartHp = this._playerCard.currentHp;
    this._enemyCard = generateEnemy(combatNum);
    this._enemyStartHp = this._enemyCard.currentHp;
    this._gameState = GameState.COMBAT;
    this.emit();
  }

  /**
   * Combat ended.
   * COMBAT -> EVENT (if win + more combats) or REWARD (win + combat 5) or GAMEOVER (loss)
   */
  handleCombatEnd({ victory, playerCard: updatedPlayerCard, roundsLog }: CombatEndResult): void {
    const finalPlayerCard = markCardAsDeadIfNeeded(updatedPlayerCard);
    this._playerCard = finalPlayerCard;

    // Update survivor HP from combat result
    if (this._survivor) {
      this._survivor = { ...this._survivor, currentHp: finalPlayerCard.currentHp, isDead: finalPlayerCard.isDead };
    }

    // Speed kill recovery (player-only, asymmetric)
    if (victory && this._survivor && roundsLog.length <= SPEED_KILL_THRESHOLD) {
      this._speedKills++;
      const recovery = Math.min(
        SPEED_KILL_RECOVERY,
        this._survivor.maxHp - this._survivor.currentHp,
      );
      if (recovery > 0) {
        this._survivor = { ...this._survivor, currentHp: this._survivor.currentHp + recovery };
        this._hpRecovered += recovery;
        // Keep playerCard in sync
        this._playerCard = { ...this._playerCard!, currentHp: this._survivor.currentHp };
      }
    }

    // Log combat to database
    if (this.repo && this._currentRunId !== null && this._playerCard && this._enemyCard) {
      try {
        this.repo.insertCombat({
          runId: this._currentRunId,
          combatNumber: this._currentCombat,
          playerCardId: this._playerCard.id,
          playerCardName: this._playerCard.name,
          playerStartHp: this._playerStartHp,
          playerAttackMod: this._playerCard.attackMod,
          playerDefenseMod: this._playerCard.defenseMod,
          enemyCardName: this._enemyCard.name,
          enemyStartHp: this._enemyStartHp,
          enemyAttackMod: this._enemyCard.attackMod,
          enemyDefenseMod: this._enemyCard.defenseMod,
          totalRounds: roundsLog.length,
          victory,
          rounds: roundsLog,
        });
        this.dbManager?.scheduleSave();
      } catch (err) {
        console.warn('[CombatLog] Failed to insert combat:', err);
      }
    }

    if (!victory) {
      this._victory = false;
      this._gameState = GameState.GAMEOVER;
      this.finalizeCurrentRun(false);
      this.emitTelemetry();
      this.emit();
      return;
    }

    if (this._currentCombat >= MAX_COMBATS) {
      // Won all 5 combats — victory reward
      this._victory = true;
      this._gameState = GameState.REWARD;
      this.emitTelemetry();
    } else {
      // More combats remain — pick event, then transition
      this.eventSystem.getNextEvent();
      this._gameState = GameState.EVENT;
    }
    this.emit();
  }

  /**
   * Player made an event choice. Apply effects but do NOT start next combat yet.
   * The scene should show result feedback, then call handleEventContinue().
   */
  handleEventChoice(choiceIndex: number): ChoiceResult {
    const runState = {
      hp: this._survivor!.currentHp,
      maxHp: this._survivor!.maxHp,
      atkBonus: this._atkBonus,
      defBonus: this._defBonus,
      diceModifiers: this._diceModifiers,
    };

    const result = this.eventSystem.applyChoice(choiceIndex, runState);

    // Write back mutated run state
    this._survivor = { ...this._survivor!, currentHp: runState.hp };
    this._atkBonus = runState.atkBonus;
    this._defBonus = runState.defBonus;
    this._diceModifiers = runState.diceModifiers;

    return result;
  }

  /**
   * Continue from event to next combat (called after player sees result feedback).
   * EVENT -> COMBAT (next combat)
   */
  handleEventContinue(): void {
    this._currentCombat += 1;
    this.startCombat(this._currentCombat);
  }

  /**
   * Player picked a reward card (meta-unlock at end of victorious run).
   * REWARD -> UNLOCK (if unlocks) or MENU
   */
  handleRewardPicked(_card: Card): void {
    this.finalizeCurrentRun(true);
    if (this.recordAndCheckUnlocks()) {
      this._gameState = GameState.UNLOCK;
    } else {
      this._gameState = GameState.MENU;
      this.resetRunState();
    }
    this.emit();
  }

  /**
   * Player skipped the reward.
   * REWARD -> UNLOCK (if unlocks) or MENU
   */
  handleRewardSkipped(): void {
    this.finalizeCurrentRun(true);
    if (this.recordAndCheckUnlocks()) {
      this._gameState = GameState.UNLOCK;
    } else {
      this._gameState = GameState.MENU;
      this.resetRunState();
    }
    this.emit();
  }

  /**
   * Back to main menu.
   * any -> UNLOCK (if unlocks from defeat) or MENU
   */
  handleBackToMenu(): void {
    // Finalize run if one is active
    if (this._currentRunId !== null && this._victory !== null) {
      this.finalizeCurrentRun(this._victory);
    }

    // Record meta for defeats (wins are recorded in handleRewardPicked/Skipped)
    if (this._victory === false && !this._metaRecorded) {
      if (this.recordAndCheckUnlocks()) {
        this._gameState = GameState.UNLOCK;
        this.emit();
        return;
      }
    }

    this._gameState = GameState.MENU;
    this.resetRunState();
    this.emit();
  }

  /**
   * Player dismissed the unlock notification.
   * UNLOCK -> MENU
   */
  handleUnlockDismissed(): void {
    this._pendingUnlocks = [];
    this._gameState = GameState.MENU;
    this.resetRunState();
    this.emit();
  }

  /**
   * Record meta stats and check for new unlocks.
   * Returns true if there are pending unlocks to show.
   */
  private recordAndCheckUnlocks(): boolean {
    if (this._metaRecorded) return this._pendingUnlocks.length > 0;
    this._metaRecorded = true;

    const survivorId = this._survivor?.id ?? 0;
    const won = this._victory === true;
    const finalHP = this._survivor?.currentHp ?? 0;

    const unlocks = this.meta.recordRun(survivorId, won, finalHP);
    if (unlocks.length > 0) {
      this._pendingUnlocks = unlocks;
      return true;
    }
    return false;
  }

  private resetRunState(): void {
    this._currentCombat = 0;
    this._playerCard = null;
    this._enemyCard = null;
    this._survivor = null;
    this._atkBonus = 0;
    this._defBonus = 0;
    this._diceModifiers = [];
    this._victory = null;
    this._currentRunId = null;
    this._metaRecorded = false;
    this._pendingUnlocks = [];
    this._runStartTime = 0;
    this._speedKills = 0;
    this._hpRecovered = 0;
    this.eventSystem.reset();
  }

  private emitTelemetry(): void {
    if (!this._survivor) return;
    sendRunData({
      survivorId: this._survivor.id,
      survivorName: this._survivor.name,
      victory: this._victory === true,
      combatReached: this._currentCombat,
      durationSeconds: Math.round((Date.now() - this._runStartTime) / 1000),
      speedKills: this._speedKills,
      hpRecovered: this._hpRecovered,
      finalHP: this._survivor.currentHp,
      maxHP: this._survivor.maxHp,
    });
  }

  private finalizeCurrentRun(victory: boolean): void {
    if (!this.repo || this._currentRunId === null) return;
    try {
      const survivorInfo = this._survivor ? JSON.stringify({ id: this._survivor.id, name: this._survivor.name }) : 'none';
      this.repo.finalizeRun(this._currentRunId, victory, survivorInfo);
      this.dbManager?.saveNow();
    } catch (err) {
      console.warn('[CombatLog] Failed to finalize run:', err);
    }
  }

  /**
   * Update card HP in real-time during combat.
   * Internal bookkeeping only — does NOT emit to avoid triggering
   * a scene re-entry that would destroy the active CombatEngine.
   */
  handleCardUpdate(updatedPlayer: Card, updatedEnemy: EnemyCard): void {
    this._playerCard = updatedPlayer;
    this._enemyCard = updatedEnemy;
    // Keep survivor HP in sync
    if (this._survivor && updatedPlayer.id === this._survivor.id) {
      this._survivor = { ...this._survivor, currentHp: updatedPlayer.currentHp };
    }
  }
}
