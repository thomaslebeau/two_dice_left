/**
 * Orchestrator for all passive visual feedback in combat.
 * Owns PassiveIndicator instances and RecycleurButton.
 * Delegates animations per passive type.
 */

import { Container, Text } from 'pixi.js';
import type { PassiveId, PassiveState, PassiveEvent, Allocation, Equipment } from '../../engine/types';
import { applyIngenieux } from '../../engine/passives';
import { PassiveIndicator } from './PassiveIndicator';
import { RecycleurButton } from './RecycleurButton';
import { tickerTween, tickerWait } from './tickerUtils';
import { timings, FONTS } from '../../theme';
import type { SlotLike } from './SlotLike';
import type { CircularHpBadge } from './CircularHpBadge';
import type { DiceSprite } from './DiceSprite';
import { DIE_SIZE } from './DiceSprite';

const BONE = 0xD9CFBA, RUST = 0x8B3A1A, MOSS = 0x2D4A2E;

export class PassiveFeedback extends Container {
  private _passiveId?: PassiveId;
  private _indicator = new PassiveIndicator();
  private _rempartIndicator = new PassiveIndicator();
  private _recycleurBtn = new RecycleurButton();
  private _banner: Text | null = null;
  private _prevIngenieuxSlot: SlotLike | null = null;

  constructor() {
    super();
    this.addChild(this._indicator);
    this.addChild(this._rempartIndicator);
    this.addChild(this._recycleurBtn);
  }

  /** Configure for this combat's passive. */
  init(passiveId?: PassiveId, _passiveState?: PassiveState): void {
    this._passiveId = passiveId;
  }

  // -----------------------------------------------------------------------
  // Elan — pre-combat banner + weapon glow
  // -----------------------------------------------------------------------

  /** "ELAN" text slides down, holds, fades. Fire-and-forget. */
  async playElanBanner(width: number): Promise<void> {
    const banner = new Text({
      text: '\u26A1 \u00C9LAN',
      style: {
        fontFamily: FONTS.HEADING, fontSize: 22,
        fontWeight: 'bold', fill: RUST, letterSpacing: 3,
      },
    });
    banner.anchor.set(0.5);
    banner.position.set(width / 2, -20);
    banner.alpha = 0;
    this.addChild(banner);
    this._banner = banner;

    // Slide down 200ms
    await tickerTween(200, (t) => {
      banner.y = -20 + t * 40;
      banner.alpha = t;
    });
    // Hold
    await tickerWait(timings.passiveBannerHold);
    // Fade 400ms
    await tickerTween(400, (t) => { banner.alpha = 1 - t; });
    banner.destroy();
    this._banner = null;
  }

  /** Toggle rust orange border glow on weapon slots. */
  setElanGlow(slots: readonly SlotLike[], on: boolean): void {
    for (const s of slots) {
      if (s.equipment.type === 'weapon') {
        if (on) s.showBorderGlow(RUST);
        else s.clearBorderGlow();
      }
    }
  }

  // -----------------------------------------------------------------------
  // Survivant — HP badge danger pulse
  // -----------------------------------------------------------------------

  /** Toggle HP badge danger pulse based on HP ratio. */
  updateSurvivantDanger(badge: CircularHpBadge, hpRatio: number): void {
    if (this._passiveId !== 'survivant') return;
    badge.setDangerPulse(hpRatio < 0.4);
  }

  // -----------------------------------------------------------------------
  // Ingenieux — live preview of +1 bonus on weakest slot
  // -----------------------------------------------------------------------

  /** Called on every allocation change. Show/clear +1 preview. */
  checkIngenieuxPreview(
    allocations: Allocation[],
    equipment: readonly Equipment[],
    passiveId: PassiveId | undefined,
    slots: readonly SlotLike[],
  ): void {
    if (passiveId !== 'ingenieux') return;

    // Clear previous
    if (this._prevIngenieuxSlot) {
      this._prevIngenieuxSlot.clearPassiveBonus();
      this._prevIngenieuxSlot = null;
    }

    const bonus = applyIngenieux(passiveId, allocations, equipment);
    if (bonus.bonusDmg === 0 && bonus.bonusShield === 0) return;

    // Find the weakest-axis slot to annotate
    const targetType = bonus.bonusDmg > 0 ? 'weapon' : 'shield';
    let weakest: SlotLike | null = null;
    let weakestVal = Infinity;
    for (const a of allocations) {
      const eq = equipment[a.equipmentIndex];
      if (eq.type !== targetType) continue;
      const eff = eq.effect(a.dieValue);
      const val = targetType === 'weapon' ? eff.damage : eff.shield;
      if (val < weakestVal) {
        weakestVal = val;
        weakest = slots.find(s => s.equipmentIndex === a.equipmentIndex) ?? null;
      }
    }

    if (weakest) {
      weakest.showPassiveBonus(1, BONE);
      this._prevIngenieuxSlot = weakest;
    }
  }

  // -----------------------------------------------------------------------
  // Rempart — shield carry indicators
  // -----------------------------------------------------------------------

  /** Show persistent shield carry icon next to shield slot. */
  showRempartCarry(x: number, y: number): void {
    this._rempartIndicator.persist('\u{1F6E1}+1', MOSS, x, y);
  }

  /** Slide carry indicator toward badge and fade. */
  consumeRempartCarry(targetX: number, targetY: number): Promise<void> {
    return this._rempartIndicator.consume(targetX, targetY);
  }

  // -----------------------------------------------------------------------
  // Recycleur — interactive die adjust
  // -----------------------------------------------------------------------

  /**
   * Show pulse on die=1 + AJUSTER button. Returns a Promise that
   * resolves when the player clicks AJUSTER or places the die.
   */
  setupRecycleur(
    targetDie: DiceSprite,
    passiveState: PassiveState,
    onDieAdjusted: () => void,
  ): { cancel: () => void } {
    const btnX = targetDie.x + DIE_SIZE + 8;
    const btnY = targetDie.y + (DIE_SIZE - 24) / 2;
    this._recycleurBtn.show(btnX, btnY, targetDie);

    this._recycleurBtn.onActivate = () => {
      passiveState.recycleurUsed = true;
      void this._recycleurBtn.playFlip(targetDie).then(() => {
        this._recycleurBtn.hide();
        onDieAdjusted();
      });
    };

    return {
      cancel: () => { this._recycleurBtn.hide(); },
    };
  }

  /** Hide recycleur button (when die is placed). */
  hideRecycleur(): void { this._recycleurBtn.hide(); }

  /** Re-show recycleur button if die is un-placed (and not used). */
  reshowRecycleur(
    targetDie: DiceSprite, passiveState: PassiveState,
    onDieAdjusted: () => void,
  ): void {
    if (passiveState.recycleurUsed) return;
    if (targetDie.value !== 1) return;
    this.setupRecycleur(targetDie, passiveState, onDieAdjusted);
  }

  // -----------------------------------------------------------------------
  // Post-resolution — play passive events
  // -----------------------------------------------------------------------

  /** Play visual feedback for passive events after round resolution. */
  async handleRoundResult(
    passiveEvents: readonly PassiveEvent[],
    slots: readonly SlotLike[],
  ): Promise<void> {
    for (const evt of passiveEvents) {
      if (!evt.triggered) continue;
      switch (evt.passiveId) {
        case 'survivant': {
          if (evt.targetSlotIndex !== undefined) {
            const slot = slots.find(s => s.equipmentIndex === evt.targetSlotIndex);
            if (slot) {
              const bounds = slot.getBounds();
              await this._indicator.popup(
                `+${evt.value}`, RUST,
                bounds.x + bounds.width / 2, bounds.y - 14,
              );
            }
          }
          break;
        }
        case 'rempart': {
          // Rempart carry earned — find shield slot
          const shieldSlot = slots.find(s => s.equipment.type === 'shield');
          if (shieldSlot) {
            const bounds = shieldSlot.getBounds();
            this.showRempartCarry(
              bounds.x + bounds.width + 4,
              bounds.y + bounds.height / 2,
            );
          }
          break;
        }
        default:
          break;
      }
    }
  }

  // -----------------------------------------------------------------------
  // Cleanup
  // -----------------------------------------------------------------------

  cleanup(): void {
    this._indicator.hide();
    this._rempartIndicator.hide();
    this._recycleurBtn.hide();
    if (this._banner) { this._banner.destroy(); this._banner = null; }
    if (this._prevIngenieuxSlot) {
      this._prevIngenieuxSlot.clearPassiveBonus();
      this._prevIngenieuxSlot = null;
    }
    this._passiveId = undefined;
  }
}
