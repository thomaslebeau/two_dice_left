/**
 * V6 run orchestrator — manages the run state machine.
 *
 * State flow:
 *   SURVIVOR_SELECT → COMBAT_1 → EVENT_1 → COMBAT_2 → EVENT_2
 *   → COMBAT_3 → EVENT_3 → COMBAT_4 → EVENT_4 → COMBAT_5
 *   → VICTORY / DEFEAT
 *
 * Plain TypeScript — zero Pixi imports.
 * Emits scene transition requests via a listener callback.
 * The wiring layer (main.ts) maps transitions to SceneManager.switchTo().
 */

import type { Equipment, Enemy, Survivor, PassiveId, PassiveState } from '../engine/types';
import { ENEMY_TEMPLATES, COMBAT_TIERS } from '../data/enemies';
import { ALL_SURVIVORS } from '../data/survivors';
import { createPassiveState, resetPassiveForCombat } from '../engine/passives';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_COMBATS = 5;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RunPhase =
  | 'idle'
  | 'survivor_select'
  | 'combat'
  | 'event'
  | 'victory'
  | 'defeat';

export interface RunState {
  readonly phase: RunPhase;
  readonly survivor: Survivor | null;
  readonly playerHp: number;
  readonly playerMaxHp: number;
  readonly equipment: readonly Equipment[];
  readonly combatNumber: number;
  readonly currentEnemy: Enemy | null;
}

export type RunTransition =
  | { scene: 'survivor_select' }
  | { scene: 'combat'; survivor: Survivor; enemy: Enemy;
      playerHp: number; playerMaxHp: number;
      equipment: readonly Equipment[];
      passiveId?: PassiveId; passiveState: PassiveState }
  | { scene: 'event'; survivor: Survivor;
      playerHp: number; playerMaxHp: number;
      equipment: readonly Equipment[];
      combatNumber: number }
  | { scene: 'victory'; survivor: Survivor; playerHp: number }
  | { scene: 'defeat'; survivor: Survivor; combatNumber: number };

type TransitionListener = (transition: RunTransition) => void;

// ---------------------------------------------------------------------------
// Enemy picking (mirrors engine/run.ts pickEnemy)
// ---------------------------------------------------------------------------

function pickEnemy(combatIndex: number): Enemy {
  const tier = COMBAT_TIERS[combatIndex];
  if (!tier) throw new Error(`No tier for combat ${combatIndex}`);

  const pool = ENEMY_TEMPLATES.filter(e => tier.pool.includes(e.id));
  if (pool.length === 0) {
    throw new Error(`Empty pool for combat ${combatIndex + 1}`);
  }

  const base = pool[Math.floor(Math.random() * pool.length)];
  const scaledHp = Math.max(1, Math.round(base.maxHp * tier.hpMultiplier));

  return { ...base, hp: scaledHp, maxHp: scaledHp };
}

// ---------------------------------------------------------------------------
// V6RunOrchestrator
// ---------------------------------------------------------------------------

export class V6RunOrchestrator {
  private _phase: RunPhase = 'idle';
  private _survivor: Survivor | null = null;
  private _playerHp = 0;
  private _playerMaxHp = 0;
  private _equipment: Equipment[] = [];
  private _combatNumber = 0;
  private _currentEnemy: Enemy | null = null;
  private _listeners = new Set<TransitionListener>();
  private _passiveState: PassiveState = createPassiveState();
  private _lastSpeedKill = false;

  // --- Public API ---

  /** Subscribe to scene transition requests. Returns unsubscribe fn. */
  onChange(listener: TransitionListener): () => void {
    this._listeners.add(listener);
    return () => { this._listeners.delete(listener); };
  }

  /** Get current run state snapshot. */
  snapshot(): RunState {
    return {
      phase: this._phase,
      survivor: this._survivor,
      playerHp: this._playerHp,
      playerMaxHp: this._playerMaxHp,
      equipment: [...this._equipment],
      combatNumber: this._combatNumber,
      currentEnemy: this._currentEnemy,
    };
  }

  /** Start a new run — show survivor selection. */
  startRun(): void {
    this._phase = 'survivor_select';
    this._survivor = null;
    this._combatNumber = 0;
    this._equipment = [];
    this._currentEnemy = null;
    this._emit({ scene: 'survivor_select' });
  }

  /**
   * Player selected a survivor. Begin combat 1.
   * @param survivorId - ID from ALL_SURVIVORS
   */
  selectSurvivor(survivorId: number): void {
    const survivor = ALL_SURVIVORS.find(s => s.id === survivorId);
    if (!survivor) {
      throw new Error(`Unknown survivor ID: ${survivorId}`);
    }

    this._survivor = survivor;
    this._playerHp = survivor.hp;
    this._playerMaxHp = survivor.maxHp;
    this._equipment = [...survivor.equipment];
    this._passiveState = createPassiveState();
    this._lastSpeedKill = false;
    this._startNextCombat();
  }

  /**
   * Combat ended. Called by the CombatScene callback.
   * If player won and combats remain → event.
   * If player won combat 5 → victory.
   * If player lost → defeat.
   */
  handleCombatEnd(won: boolean, playerHpAfter: number, speedKill = false): void {
    if (!this._survivor) return;

    this._playerHp = playerHpAfter;
    this._lastSpeedKill = speedKill;

    if (!won) {
      this._phase = 'defeat';
      this._emit({
        scene: 'defeat',
        survivor: this._survivor,
        combatNumber: this._combatNumber,
      });
      return;
    }

    if (this._combatNumber >= MAX_COMBATS) {
      this._phase = 'victory';
      this._emit({
        scene: 'victory',
        survivor: this._survivor,
        playerHp: this._playerHp,
      });
      return;
    }

    // Event between combats
    this._phase = 'event';
    this._emit({
      scene: 'event',
      survivor: this._survivor,
      playerHp: this._playerHp,
      playerMaxHp: this._playerMaxHp,
      equipment: [...this._equipment],
      combatNumber: this._combatNumber,
    });
  }

  /**
   * Event ended. Called by the EventScene callback.
   * Updates equipment and HP, then starts next combat.
   */
  handleEventEnd(
    updatedEquipment: readonly Equipment[],
    updatedHp: number,
  ): void {
    this._equipment = [...updatedEquipment];
    this._playerHp = updatedHp;
    this._startNextCombat();
  }

  /** Reset to idle state. */
  reset(): void {
    this._phase = 'idle';
    this._survivor = null;
    this._combatNumber = 0;
    this._equipment = [];
    this._currentEnemy = null;
    this._passiveState = createPassiveState();
    this._lastSpeedKill = false;
  }

  // --- Private ---

  private _startNextCombat(): void {
    if (!this._survivor) return;

    this._combatNumber++;
    this._phase = 'combat';
    this._currentEnemy = pickEnemy(this._combatNumber - 1);

    // Reset passive state between combats (not before the first)
    if (this._combatNumber > 1) {
      const hasTrophy = this._equipment.some(e => e.id === 'rusty_trophy');
      this._passiveState = resetPassiveForCombat(
        this._passiveState,
        this._lastSpeedKill,
        this._playerHp / this._playerMaxHp,
        hasTrophy,
      );
    }

    this._emit({
      scene: 'combat',
      survivor: this._survivor,
      enemy: this._currentEnemy,
      playerHp: this._playerHp,
      playerMaxHp: this._playerMaxHp,
      equipment: [...this._equipment],
      passiveId: this._survivor.passive,
      passiveState: { ...this._passiveState, tropheeRoundsLeft: [...this._passiveState.tropheeRoundsLeft] },
    });
  }

  private _emit(transition: RunTransition): void {
    for (const listener of this._listeners) {
      listener(transition);
    }
  }
}
