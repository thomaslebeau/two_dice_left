/**
 * V6 resolution animation — reveals enemy allocation, shows damage
 * calculations, animates HP bars, and handles combat end transition.
 *
 * Sequence:
 * 1. Reveal enemy dice placement (0.5s)
 * 2. Show damage calculation text (0.5s)
 * 3. Animate HP bar changes (0.3s)
 * 4. If combat ends: show victory/defeat overlay
 *
 * The animation is driven by calling play() which returns a Promise
 * that resolves when the full sequence is complete.
 */

import { Container, Graphics, Text } from 'pixi.js';
import type { Allocation, Equipment, EquipmentEffect } from '../../engine/types';
import { canUseDie } from '../../engine/dice';

// ---------------------------------------------------------------------------
// V6 palette
// ---------------------------------------------------------------------------

const BONE = 0xD9CFBA;
const MOSS = 0x2D4A2E;
const BLOOD = 0x6B1C1C;
const CHARCOAL = 0x1A1A1A;

// ---------------------------------------------------------------------------
// Timing
// ---------------------------------------------------------------------------

const REVEAL_DELAY = 500;
const CALC_DELAY = 500;
const HP_ANIM_DELAY = 300;
const END_DELAY = 800;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ResolutionData {
  // Player side
  playerAllocations: readonly Allocation[];
  playerEquipment: readonly Equipment[];
  playerDamageToEnemy: number;
  playerShieldTotal: number;
  playerHealTotal: number;
  // Enemy side
  enemyAllocations: readonly Allocation[];
  enemyEquipment: readonly Equipment[];
  enemyDamageToPlayer: number;
  enemyShieldTotal: number;
  // HP state
  playerHpBefore: number;
  playerHpAfter: number;
  playerMaxHp: number;
  enemyHpBefore: number;
  enemyHpAfter: number;
  enemyMaxHp: number;
  // Outcome
  combatEnded: boolean;
  playerWon: boolean;
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function sumEffectField(
  allocations: readonly Allocation[],
  equipment: readonly Equipment[],
  field: keyof EquipmentEffect,
): number {
  let total = 0;
  for (const alloc of allocations) {
    const eq = equipment[alloc.equipmentIndex];
    if (canUseDie(eq, alloc.dieValue)) {
      total += eq.effect(alloc.dieValue)[field];
    }
  }
  return total;
}

// ---------------------------------------------------------------------------
// ResolutionAnimation
// ---------------------------------------------------------------------------

export class ResolutionAnimation extends Container {
  private _overlay = new Graphics();
  private _calcLine1: Text;
  private _calcLine2: Text;
  private _resultText: Text;
  private _endText: Text;

  // HP bar references (set externally)
  private _playerHpBar: Graphics | null = null;
  private _enemyHpBar: Graphics | null = null;
  private _playerHpBarWidth = 0;
  private _enemyHpBarWidth = 0;

  constructor() {
    super();

    this._overlay.visible = false;
    this.addChild(this._overlay);

    const calcStyle = {
      fontFamily: '"Courier New", monospace' as string,
      fontSize: 14,
      fill: BONE,
    };

    this._calcLine1 = new Text({ text: '', style: { ...calcStyle } });
    this._calcLine1.anchor.set(0.5, 0);
    this.addChild(this._calcLine1);

    this._calcLine2 = new Text({ text: '', style: { ...calcStyle } });
    this._calcLine2.anchor.set(0.5, 0);
    this.addChild(this._calcLine2);

    this._resultText = new Text({
      text: '',
      style: {
        fontFamily: '"Courier New", monospace',
        fontSize: 16,
        fontWeight: 'bold',
        fill: BONE,
      },
    });
    this._resultText.anchor.set(0.5, 0);
    this.addChild(this._resultText);

    this._endText = new Text({
      text: '',
      style: {
        fontFamily: '"Courier New", monospace',
        fontSize: 28,
        fontWeight: 'bold',
        fill: BONE,
        letterSpacing: 3,
      },
    });
    this._endText.anchor.set(0.5);
    this.addChild(this._endText);
  }

  /** Set external HP bar graphics for animated fill. */
  setHpBars(
    playerBar: Graphics, playerWidth: number,
    enemyBar: Graphics, enemyWidth: number,
  ): void {
    this._playerHpBar = playerBar;
    this._playerHpBarWidth = playerWidth;
    this._enemyHpBar = enemyBar;
    this._enemyHpBarWidth = enemyWidth;
  }

  /** Position the resolution text elements. */
  layoutAt(centerX: number, topY: number, width: number): void {
    const lineGap = 22;
    this._calcLine1.position.set(centerX, topY);
    this._calcLine2.position.set(centerX, topY + lineGap);
    this._resultText.position.set(centerX, topY + lineGap * 2 + 8);
    this._endText.position.set(centerX, topY + lineGap * 4);

    this._overlay.clear();
    this._overlay.rect(centerX - width / 2, topY - 10, width, lineGap * 5 + 20);
    this._overlay.fill({ color: CHARCOAL, alpha: 0.85 });
  }

  /**
   * Play the full resolution animation sequence.
   * Caller should update enemy slot visuals before calling this.
   */
  async play(data: ResolutionData): Promise<void> {
    this.visible = true;
    this._overlay.visible = true;
    this._calcLine1.text = '';
    this._calcLine2.text = '';
    this._resultText.text = '';
    this._endText.text = '';

    // Phase 1: reveal enemy allocations (done externally, just wait)
    await wait(REVEAL_DELAY);

    // Phase 2: show damage calculations
    const pAtk = sumEffectField(data.playerAllocations, data.playerEquipment, 'damage');
    const eShield = sumEffectField(data.enemyAllocations, data.enemyEquipment, 'shield');

    const eAtk = sumEffectField(data.enemyAllocations, data.enemyEquipment, 'damage');
    const pShield = sumEffectField(data.playerAllocations, data.playerEquipment, 'shield');

    this._calcLine1.text = `You: ${pAtk} atk - ${eShield} shield = ${data.playerDamageToEnemy} dmg`;
    this._calcLine1.style.fill = data.playerDamageToEnemy > 0 ? MOSS : BONE;

    this._calcLine2.text = `Foe: ${eAtk} atk - ${pShield} shield = ${data.enemyDamageToPlayer} dmg`;
    this._calcLine2.style.fill = data.enemyDamageToPlayer > 0 ? BLOOD : BONE;

    await wait(CALC_DELAY);

    // Phase 3: animate HP bars
    this._animateHpBar(
      this._enemyHpBar, this._enemyHpBarWidth,
      data.enemyHpBefore, data.enemyHpAfter, data.enemyMaxHp,
    );
    this._animateHpBar(
      this._playerHpBar, this._playerHpBarWidth,
      data.playerHpBefore, data.playerHpAfter, data.playerMaxHp,
    );

    // Show net result
    const parts: string[] = [];
    if (data.playerDamageToEnemy > 0) parts.push(`Enemy -${data.playerDamageToEnemy} HP`);
    if (data.enemyDamageToPlayer > 0) parts.push(`You -${data.enemyDamageToPlayer} HP`);
    if (data.playerHealTotal > 0) parts.push(`You +${data.playerHealTotal} heal`);
    this._resultText.text = parts.join('  |  ') || 'No damage';

    await wait(HP_ANIM_DELAY);

    // Phase 4: combat end
    if (data.combatEnded) {
      if (data.playerWon) {
        this._endText.text = 'VICTORY';
        this._endText.style.fill = MOSS;
      } else {
        this._endText.text = 'DEFEAT';
        this._endText.style.fill = BLOOD;
      }
      await wait(END_DELAY);
    }
  }

  /** Reset animation state. */
  reset(): void {
    this.visible = false;
    this._overlay.visible = false;
    this._calcLine1.text = '';
    this._calcLine2.text = '';
    this._resultText.text = '';
    this._endText.text = '';
  }

  // --- HP bar animation ---

  private _animateHpBar(
    bar: Graphics | null,
    maxWidth: number,
    hpBefore: number,
    hpAfter: number,
    maxHp: number,
  ): void {
    if (!bar) return;

    const startPct = Math.max(0, hpBefore / maxHp);
    const endPct = Math.max(0, hpAfter / maxHp);
    const startW = startPct * maxWidth;
    const endW = endPct * maxWidth;
    const steps = 10;
    const stepTime = HP_ANIM_DELAY / steps;
    let step = 0;

    const interval = setInterval(() => {
      step++;
      const t = step / steps;
      const w = startW + (endW - startW) * t;
      bar.clear();
      if (w > 0) {
        bar.rect(0, 0, w, 10);
        bar.fill({ color: endPct > 0.3 ? MOSS : BLOOD });
      }
      if (step >= steps) clearInterval(interval);
    }, stepTime);
  }
}
