/**
 * Mutable combat state tracker — HP, poison, round counter.
 *
 * Delegates damage/shield calculation to the engine (resolveRound).
 * Applies the same HP → poison tick → new poison → heal → clamp → speed
 * kill sequence as engine/combat.ts simulateCombat, but exposes
 * intermediate snapshots so the UI can animate each step.
 *
 * Zero Pixi imports — pure TypeScript.
 */

import type { Allocation, Equipment } from '../../engine/types';
import { resolveRound, sumAllocEffects } from '../../engine/combat';
import type { ResolutionData } from './ResolutionAnimation';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SPEED_KILL_THRESHOLD = 3;
const SPEED_KILL_RECOVERY = 3;

// ---------------------------------------------------------------------------
// Result produced per round (consumed by CombatScene for HUD updates)
// ---------------------------------------------------------------------------

export interface PoisonSnapshot {
  ticked: boolean;
  poisonAfterTick: number;
  newPoison: number;
  totalAfter: number;
}

export interface RoundResult {
  resolutionData: ResolutionData;
  playerPoison: PoisonSnapshot;
  enemyPoison: PoisonSnapshot;
}

// ---------------------------------------------------------------------------
// CombatState
// ---------------------------------------------------------------------------

export class CombatState {
  private _round = 0;
  private _playerHp: number;
  private _playerMaxHp: number;
  private _enemyHp: number;
  private _enemyMaxHp: number;
  private _playerPoisonTurns = 0;
  private _enemyPoisonTurns = 0;

  get round(): number { return this._round; }
  get playerHp(): number { return this._playerHp; }
  get enemyHp(): number { return this._enemyHp; }
  get playerMaxHp(): number { return this._playerMaxHp; }
  get enemyMaxHp(): number { return this._enemyMaxHp; }
  get playerPoisonTurns(): number { return this._playerPoisonTurns; }
  get enemyPoisonTurns(): number { return this._enemyPoisonTurns; }

  constructor(
    playerHp: number, playerMaxHp: number,
    enemyHp: number, enemyMaxHp: number,
  ) {
    this._playerHp = playerHp;
    this._playerMaxHp = playerMaxHp;
    this._enemyHp = enemyHp;
    this._enemyMaxHp = enemyMaxHp;
  }

  /** Advance round counter. Call at the start of each round. */
  nextRound(): void { this._round++; }

  /**
   * Apply a resolved round. Mutates HP/poison and returns
   * everything the UI needs to animate + update HUDs.
   */
  applyRound(
    playerAllocs: readonly Allocation[],
    playerEquipment: readonly Equipment[],
    enemyAllocs: readonly Allocation[],
    enemyEquipment: readonly Equipment[],
  ): RoundResult {
    const outcome = resolveRound(
      playerAllocs, playerEquipment,
      enemyAllocs, enemyEquipment,
    );

    const playerHpBefore = this._playerHp;
    const enemyHpBefore = this._enemyHp;

    // 1. Damage (simultaneous)
    this._enemyHp -= outcome.damageToEnemy;
    this._playerHp -= outcome.damageToPlayer;

    // 2. Poison ticks
    const pPoison = this._tickPoison(
      'player', outcome.playerPoison,
    );
    const ePoison = this._tickPoison(
      'enemy', outcome.enemyPoison,
    );

    // 3. Heal (after poison, capped)
    if (this._playerHp > 0 && outcome.playerHeal > 0) {
      this._playerHp = Math.min(
        this._playerMaxHp, this._playerHp + outcome.playerHeal,
      );
    }

    // 4. Clamp
    this._playerHp = Math.max(0, this._playerHp);
    this._enemyHp = Math.max(0, this._enemyHp);

    const combatEnded = this._playerHp <= 0 || this._enemyHp <= 0;
    const playerWon = this._enemyHp <= 0;

    // 5. Speed kill recovery
    let speedKillRecovery = 0;
    if (playerWon && this._round <= SPEED_KILL_THRESHOLD) {
      const before = this._playerHp;
      this._playerHp = Math.min(
        this._playerMaxHp, this._playerHp + SPEED_KILL_RECOVERY,
      );
      speedKillRecovery = this._playerHp - before;
    }

    // Build ResolutionData for animation
    const resolutionData: ResolutionData = {
      playerAllocations: playerAllocs,
      playerEquipment: [...playerEquipment],
      playerDamageToEnemy: outcome.damageToEnemy,
      playerShieldTotal: sumAllocEffects(
        playerAllocs, playerEquipment, 'shield',
      ),
      playerHealTotal: outcome.playerHeal,
      enemyAllocations: enemyAllocs,
      enemyEquipment: [...enemyEquipment],
      enemyDamageToPlayer: outcome.damageToPlayer,
      enemyShieldTotal: sumAllocEffects(
        enemyAllocs, enemyEquipment, 'shield',
      ),
      playerHpBefore,
      playerHpAfter: this._playerHp,
      playerMaxHp: this._playerMaxHp,
      enemyHpBefore,
      enemyHpAfter: this._enemyHp,
      enemyMaxHp: this._enemyMaxHp,
      combatEnded,
      playerWon,
      speedKillRecovery,
    };

    return { resolutionData, playerPoison: pPoison, enemyPoison: ePoison };
  }

  // -----------------------------------------------------------------------
  // Internal
  // -----------------------------------------------------------------------

  private _tickPoison(
    side: 'player' | 'enemy', newPoison: number,
  ): PoisonSnapshot {
    const isPlayer = side === 'player';
    const turns = isPlayer
      ? this._playerPoisonTurns : this._enemyPoisonTurns;
    const ticked = turns > 0;

    if (ticked) {
      if (isPlayer) { this._playerHp -= 1; this._playerPoisonTurns--; }
      else { this._enemyHp -= 1; this._enemyPoisonTurns--; }
    }

    const afterTick = isPlayer
      ? this._playerPoisonTurns : this._enemyPoisonTurns;

    if (isPlayer) this._playerPoisonTurns += newPoison;
    else this._enemyPoisonTurns += newPoison;

    const totalAfter = isPlayer
      ? this._playerPoisonTurns : this._enemyPoisonTurns;

    return { ticked, poisonAfterTick: afterTick, newPoison, totalAfter };
  }
}
