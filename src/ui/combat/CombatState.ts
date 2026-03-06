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

import type { Allocation, Equipment, PassiveId, PassiveState, PassiveEvent } from '../../engine/types';
import { resolveRound, sumAllocEffects } from '../../engine/combat';
import {
  createPassiveState,
  computeEffectContext,
  applySurvivant,
  computeRempartCarry,
  applyIngenieux,
  tickTropheeStacks,
} from '../../engine/passives';
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
  passiveEvents: readonly PassiveEvent[];
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
  private _passiveId?: PassiveId;
  private _passiveState: PassiveState;

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
    passiveId?: PassiveId, passiveState?: PassiveState,
  ) {
    this._playerHp = playerHp;
    this._playerMaxHp = playerMaxHp;
    this._enemyHp = enemyHp;
    this._enemyMaxHp = enemyMaxHp;
    this._passiveId = passiveId;
    this._passiveState = passiveState ?? createPassiveState();
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
    const state = this._passiveState;
    state.currentRound = this._round;

    // Build synergy context
    const enemyPoisoned = this._enemyPoisonTurns > 0;
    const contextBuilder = (alloc: Allocation) =>
      computeEffectContext(alloc, playerAllocs, playerEquipment, enemyPoisoned);

    const outcome = resolveRound(
      playerAllocs, playerEquipment,
      enemyAllocs, enemyEquipment,
      contextBuilder,
    );

    // Apply passive damage modifiers + build PassiveEvent list
    const passiveEvents: PassiveEvent[] = [];
    let dmgToEnemy = outcome.damageToEnemy;

    // Survivant
    const dmgBeforeSurvivant = dmgToEnemy;
    dmgToEnemy = applySurvivant(
      this._passiveId, this._playerHp, this._playerMaxHp,
      dmgToEnemy, outcome.playerUsedWeapon,
    );
    if (dmgToEnemy > dmgBeforeSurvivant) {
      const wSlotIdx = playerAllocs.find(
        a => playerEquipment[a.equipmentIndex].type === 'weapon',
      )?.equipmentIndex;
      passiveEvents.push({
        passiveId: 'survivant', triggered: true, value: 1,
        targetSlotIndex: wSlotIdx,
      });
    }

    // Ingenieux
    const ingBonus = applyIngenieux(this._passiveId, playerAllocs, playerEquipment);
    dmgToEnemy += ingBonus.bonusDmg;
    let dmgToPlayer = outcome.damageToPlayer;
    dmgToPlayer = Math.max(0, dmgToPlayer - ingBonus.bonusShield);
    if (ingBonus.bonusDmg > 0 || ingBonus.bonusShield > 0) {
      passiveEvents.push({
        passiveId: 'ingenieux', triggered: true,
        value: ingBonus.bonusDmg > 0 ? ingBonus.bonusDmg : ingBonus.bonusShield,
      });
    }

    // Elan: +1 dmg round 1 if active (mark combat as boosted for no-chain)
    if (this._passiveId === 'elan' && state.elanActive && this._round === 1) {
      dmgToEnemy += 1;
      state.elanBoostedCombat = true;
      passiveEvents.push({ passiveId: 'elan', triggered: true, value: 1 });
    }
    // Trophee stacks
    if (state.tropheeStacks > 0 && outcome.playerUsedWeapon) {
      dmgToEnemy += state.tropheeStacks;
      passiveEvents.push({
        passiveId: 'recycleur', triggered: true, value: state.tropheeStacks,
      });
    }
    // Rempart carry consumed
    const rempartConsumed = state.rempartCarryShield;
    if (state.rempartCarryShield > 0) {
      dmgToPlayer = Math.max(0, dmgToPlayer - state.rempartCarryShield);
      state.rempartCarryShield = 0;
      passiveEvents.push({
        passiveId: 'rempart', triggered: true, value: rempartConsumed,
      });
    }
    // Re-apply min-1
    if (outcome.playerUsedWeapon) {
      dmgToEnemy = Math.max(1, dmgToEnemy);
    }

    const playerHpBefore = this._playerHp;
    const enemyHpBefore = this._enemyHp;

    // 1. Damage (simultaneous)
    this._enemyHp -= dmgToEnemy;
    this._playerHp -= dmgToPlayer;

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

    // Rempart: compute carry for next round
    state.rempartCarryShield = computeRempartCarry(
      this._passiveId, outcome.playerShieldTotal, outcome.enemyRawDmg,
      this._playerHp, this._playerMaxHp,
    );
    if (state.rempartCarryShield > 0) {
      passiveEvents.push({
        passiveId: 'rempart', triggered: true, value: state.rempartCarryShield,
      });
    }
    // Tick trophee stacks
    tickTropheeStacks(state);

    // Build ResolutionData for animation
    const resolutionData: ResolutionData = {
      playerAllocations: playerAllocs,
      playerEquipment: [...playerEquipment],
      playerDamageToEnemy: dmgToEnemy,
      playerShieldTotal: sumAllocEffects(
        playerAllocs, playerEquipment, 'shield',
      ),
      playerHealTotal: outcome.playerHeal,
      enemyAllocations: enemyAllocs,
      enemyEquipment: [...enemyEquipment],
      enemyDamageToPlayer: dmgToPlayer,
      enemyShieldTotal: sumAllocEffects(
        enemyAllocs, enemyEquipment, 'shield',
      ),
      playerHpBefore,
      playerHpAfter: this._playerHp,
      playerMaxHp: this._playerMaxHp,
      enemyHpBefore,
      enemyHpAfter: this._enemyHp,
      enemyMaxHp: this._enemyMaxHp,
      enemyPoisonTick: ePoison.ticked ? 1 : 0,
      enemyNewPoison: ePoison.newPoison,
      playerPoisonTick: pPoison.ticked ? 1 : 0,
      combatEnded,
      playerWon,
      speedKillRecovery,
    };

    return { resolutionData, playerPoison: pPoison, enemyPoison: ePoison, passiveEvents };
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
