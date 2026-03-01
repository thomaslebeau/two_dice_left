/**
 * Manages dice-to-equipment allocation interaction.
 *
 * Handles: drag-drop, tap-to-place, undo, slot highlighting.
 * Creates DiceSprite instances but does NOT own them visually —
 * the caller adds them to a Container and forwards pointer events.
 *
 * This is a plain class, not a Pixi Container.
 */

import type { Allocation } from '../../engine/types';
import { DiceSprite, DIE_SIZE } from './DiceSprite';
import { EquipmentSlot, SLOT_WIDTH } from './EquipmentSlot';

const DICE_GAP = 12;

// ---------------------------------------------------------------------------
// DiceAllocator
// ---------------------------------------------------------------------------

export class DiceAllocator {
  private _dice: DiceSprite[] = [];
  private _slots: EquipmentSlot[] = [];
  private _allocations = new Map<number, number>(); // dieIndex → slotIndex
  private _draggingDie: DiceSprite | null = null;
  private _dragOffset = { x: 0, y: 0 };
  private _enabled = false;
  private _screenWidth = 390;
  private _homeY = 0;

  /** Fires whenever an allocation changes (place/undo). */
  onChange: (() => void) | null = null;

  /** Provide a callback to bring a die to front in the parent Container. */
  onBringToFront: ((die: DiceSprite) => void) | null = null;

  get dice(): readonly DiceSprite[] { return this._dice; }
  get isDragging(): boolean { return this._draggingDie !== null; }

  // -----------------------------------------------------------------------
  // Setup / teardown
  // -----------------------------------------------------------------------

  /**
   * Create dice for a new round. Returns DiceSprites for the caller
   * to add to a Container. Wires pointerdown on each die internally.
   */
  setup(
    values: number[],
    slots: EquipmentSlot[],
    screenWidth: number,
    homeY: number,
  ): DiceSprite[] {
    this.reset();
    this._slots = slots;
    this._screenWidth = screenWidth;
    this._homeY = homeY;

    for (let i = 0; i < values.length; i++) {
      const die = new DiceSprite(i);
      die.on('pointerdown', (e: { global: { x: number; y: number } }) => {
        this.handleDieDown(i, e.global);
      });
      die.roll(values[i]);
      this._dice.push(die);
    }
    return this._dice;
  }

  /** Enable/disable interaction (matches CombatScene phase). */
  setEnabled(enabled: boolean): void {
    this._enabled = enabled;
    if (enabled) this._updateSlotHighlights();
  }

  /** Update screen width and home Y for layout recalculations. */
  updateLayout(screenWidth: number, homeY: number): void {
    this._screenWidth = screenWidth;
    this._homeY = homeY;
  }

  /** Destroy all dice and clear state. */
  reset(): void {
    for (const d of this._dice) d.destroy();
    this._dice = [];
    this._slots = [];
    this._allocations.clear();
    this._draggingDie = null;
    this._enabled = false;
  }

  // -----------------------------------------------------------------------
  // Layout
  // -----------------------------------------------------------------------

  /** Position all dice at their home row (centered). */
  layoutDice(): void {
    const count = this._dice.length;
    if (count === 0) return;
    const totalW = count * DIE_SIZE + (count - 1) * DICE_GAP;
    let x = (this._screenWidth - totalW) / 2;
    for (const die of this._dice) {
      die.position.set(x, this._homeY);
      x += DIE_SIZE + DICE_GAP;
    }
  }

  // -----------------------------------------------------------------------
  // Queries
  // -----------------------------------------------------------------------

  /** Build Allocation[] from current placements. */
  getAllocations(): Allocation[] {
    const result: Allocation[] = [];
    for (const [dieIdx, eqIdx] of this._allocations) {
      result.push({
        equipmentIndex: eqIdx,
        dieValue: this._dice[dieIdx].value,
      });
    }
    return result;
  }

  /** Are all dice placed? */
  isComplete(): boolean {
    return this._dice.every(d => this._allocations.has(d.dieIndex));
  }

  // -----------------------------------------------------------------------
  // Pointer handlers (called by CombatScene)
  // -----------------------------------------------------------------------

  handleDieDown(
    dieIndex: number,
    globalPos: { x: number; y: number },
  ): void {
    if (!this._enabled) return;
    const die = this._dice[dieIndex];
    if (!die) return;

    // Undo existing placement first
    if (this._allocations.has(dieIndex)) {
      this._undoPlacement(dieIndex);
    }

    die.setState('dragging');
    this._draggingDie = die;
    this._dragOffset.x = globalPos.x - die.x;
    this._dragOffset.y = globalPos.y - die.y;

    this.onBringToFront?.(die);
    this._updateSlotHighlights();
  }

  handlePointerMove(globalPos: { x: number; y: number }): void {
    if (!this._draggingDie) return;
    this._draggingDie.x = globalPos.x - this._dragOffset.x;
    this._draggingDie.y = globalPos.y - this._dragOffset.y;

    for (const slot of this._slots) {
      if (this._isOverSlot(this._draggingDie, slot)) {
        slot.showPreview(this._draggingDie.value);
      } else {
        slot.clearPreview();
      }
    }
  }

  handlePointerUp(): void {
    if (!this._draggingDie) return;
    const die = this._draggingDie;
    this._draggingDie = null;

    let placed = false;
    for (const slot of this._slots) {
      if (slot.slotState === 'filled' || slot.slotState === 'locked') {
        continue;
      }
      if (!this._isOverSlot(die, slot)) continue;

      if (slot.isCompatible(die.value)) {
        this._placeDie(die.dieIndex, slot.equipmentIndex);
        placed = true;
      } else {
        die.shake();
      }
      break;
    }

    if (!placed) {
      die.setState('idle');
      this._snapDieHome(die);
    }

    for (const s of this._slots) s.clearPreview();
    this._updateSlotHighlights();
    this.onChange?.();
  }

  /** Tap-to-place: first unplaced compatible die into slot. */
  handleSlotTap(slotIndex: number): void {
    if (!this._enabled) return;
    const slot = this._slots[slotIndex];
    if (!slot || slot.slotState === 'filled') return;

    for (const die of this._dice) {
      if (this._allocations.has(die.dieIndex)) continue;
      if (!slot.isCompatible(die.value)) continue;

      this._placeDie(die.dieIndex, slotIndex);
      this._updateSlotHighlights();
      this.onChange?.();
      return;
    }
  }

  // -----------------------------------------------------------------------
  // Internal
  // -----------------------------------------------------------------------

  private _placeDie(dieIndex: number, slotIndex: number): void {
    const die = this._dice[dieIndex];
    const slot = this._slots[slotIndex];
    if (!die || !slot) return;

    this._allocations.set(dieIndex, slotIndex);
    slot.placeDie(die.value);
    die.setState('placed');

    // Snap die visually above slot center
    die.x = slot.getGlobalPosition().x + SLOT_WIDTH / 2 - DIE_SIZE / 2;
    die.y = slot.getGlobalPosition().y - DIE_SIZE - 4;
  }

  private _undoPlacement(dieIndex: number): void {
    const slotIndex = this._allocations.get(dieIndex);
    if (slotIndex === undefined) return;

    this._allocations.delete(dieIndex);
    this._slots[slotIndex]?.removeDie();
    this._snapDieHome(this._dice[dieIndex]);
  }

  private _snapDieHome(die: DiceSprite): void {
    const count = this._dice.length;
    const totalW = count * DIE_SIZE + (count - 1) * DICE_GAP;
    const startX = (this._screenWidth - totalW) / 2;
    die.x = startX + die.dieIndex * (DIE_SIZE + DICE_GAP);
    die.y = this._homeY;
  }

  private _isOverSlot(die: DiceSprite, slot: EquipmentSlot): boolean {
    const b = slot.getBounds();
    const cx = die.x + DIE_SIZE / 2;
    const cy = die.y + DIE_SIZE / 2;
    return cx >= b.x && cx <= b.x + b.width
      && cy >= b.y && cy <= b.y + b.height;
  }

  private _updateSlotHighlights(): void {
    const dragValue = this._draggingDie?.value ?? null;

    for (const slot of this._slots) {
      if (slot.slotState === 'filled' || slot.slotState === 'locked') {
        continue;
      }
      if (dragValue !== null && slot.isCompatible(dragValue)) {
        slot.setState('valid-target');
      } else {
        slot.setState('empty');
      }
    }
  }
}
