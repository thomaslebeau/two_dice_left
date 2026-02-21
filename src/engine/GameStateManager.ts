import type { Card, EnemyCard } from '@/types/card.types';
import type { CombatEndResult } from '@/types/combat.types';
import { GameState } from '@enums/GameState.enum';
import { CARD_DATABASE, MAX_COMBATS } from '@shared/constants/cards';
import { generateEnemy } from '@shared/utils/enemyGenerator';
import { markCardAsDeadIfNeeded } from '@/shared/utils/cardDeathUtils';
import { CombatLogRepository } from '@/db/CombatLogRepository.ts';
import type { DbProvider } from '@/db/types.ts';

// --- Event types ---

export interface GameStateSnapshot {
  gameState: GameState;
  currentCombat: number;
  playerCard: Card | null;
  enemyCard: EnemyCard | null;
  collection: Card[];
  victory: boolean | null;
}

type GameStateListener = (snapshot: GameStateSnapshot) => void;

/**
 * Central game state machine (v2: single card selection per combat).
 * Uses a simple listener callback list for change notifications.
 */
export class GameStateManager {
  private _gameState: GameState = GameState.MENU;
  private _currentCombat = 0;
  private _playerCard: Card | null = null;
  private _enemyCard: EnemyCard | null = null;
  private _collection: Card[] = [];
  private _victory: boolean | null = null;

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
  get collection(): Card[] { return this._collection; }
  get victory(): boolean | null { return this._victory; }

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
      collection: [...this._collection],
      victory: this._victory,
    };
  }

  // --- State transitions ---

  /**
   * Start a new run.
   * MENU -> CARD_SELECTION
   */
  startNewRun(): void {
    this._collection = CARD_DATABASE.slice(0, 3).map((c) => ({
      ...c,
      currentHp: c.maxHp,
    }));
    this._playerCard = null;
    this._enemyCard = null;
    this._currentCombat = 0;
    this._victory = null;

    // Create DB run record
    if (this.repo) {
      try {
        const snapshot = JSON.stringify(this._collection.map((c) => ({ id: c.id, name: c.name })));
        this._currentRunId = this.repo.createRun(snapshot);
        this.dbManager?.scheduleSave();
      } catch (err) {
        console.warn('[CombatLog] Failed to create run:', err);
        this._currentRunId = null;
      }
    }

    this._gameState = GameState.CARD_SELECTION;
    this.emit();
  }

  /**
   * Player chose a single card for combat.
   * CARD_SELECTION -> COMBAT
   */
  handleCardChosen(card: Card): void {
    this._playerCard = { ...card };
    this._playerStartHp = card.currentHp;

    // Add card to collection if not already present
    if (!this._collection.some((c) => c.id === card.id)) {
      this._collection = [...this._collection, card];
    }

    this._currentCombat += 1;
    this.startCombat(this._currentCombat);
  }

  private startCombat(combatNum: number): void {
    this._enemyCard = generateEnemy(combatNum);
    this._enemyStartHp = this._enemyCard.currentHp;
    this._gameState = GameState.COMBAT;
    this.emit();
  }

  /**
   * Combat ended.
   * COMBAT -> REWARD or GAMEOVER
   */
  handleCombatEnd({ victory, playerCard: updatedPlayerCard, roundsLog }: CombatEndResult): void {
    const finalPlayerCard = markCardAsDeadIfNeeded(updatedPlayerCard);
    this._playerCard = finalPlayerCard;

    // Update card in collection
    this._collection = this._collection.map((card) =>
      card.id === finalPlayerCard.id ? finalPlayerCard : card
    );

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
      this.emit();
      return;
    }

    if (this._currentCombat >= MAX_COMBATS) {
      this._victory = true;
      this._gameState = GameState.GAMEOVER;
      this.finalizeCurrentRun(true);
    } else {
      this._gameState = GameState.REWARD;
    }
    this.emit();
  }

  /**
   * Player picked a reward card — add to collection and go to next card selection.
   * REWARD -> CARD_SELECTION
   */
  handleRewardPicked(card: Card): void {
    if (!this._collection.some((c) => c.id === card.id)) {
      this._collection = [...this._collection, { ...card, currentHp: card.maxHp }];
    }
    this._gameState = GameState.CARD_SELECTION;
    this.emit();
  }

  /**
   * Player skipped the reward — go to next card selection with existing collection.
   * REWARD -> CARD_SELECTION
   */
  handleRewardSkipped(): void {
    this._gameState = GameState.CARD_SELECTION;
    this.emit();
  }

  /**
   * Back to main menu.
   * any -> MENU
   */
  handleBackToMenu(): void {
    // Finalize run if one is active (e.g. early quit)
    if (this._currentRunId !== null && this._victory !== null) {
      this.finalizeCurrentRun(this._victory);
    }

    this._gameState = GameState.MENU;
    this._currentCombat = 0;
    this._playerCard = null;
    this._enemyCard = null;
    this._collection = [];
    this._victory = null;
    this._currentRunId = null;
    this.emit();
  }

  private finalizeCurrentRun(victory: boolean): void {
    if (!this.repo || this._currentRunId === null) return;
    try {
      const snapshot = JSON.stringify(this._collection.map((c) => ({ id: c.id, name: c.name })));
      this.repo.finalizeRun(this._currentRunId, victory, snapshot);
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
    this._collection = this._collection.map((card) =>
      card.id === updatedPlayer.id ? updatedPlayer : card
    );
  }
}
