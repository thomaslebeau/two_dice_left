/**
 * Dice-to-equipment allocation interaction.
 * Handles drag-drop, tap-to-place, undo, slot highlighting.
 * Placed dice are hidden (absorbed into the slot icon).
 *
 * _allocs maps dieIndex → equipmentIndex. Slots are always looked
 * up by equipmentIndex (via _slotByEq), never by array position.
 */

import type { Allocation } from '../../engine/types';
import { DiceSprite, DIE_SIZE } from './DiceSprite';
import type { EquipmentSlotIcon } from './EquipmentSlotIcon';

const DICE_GAP = 12;

export class DiceAllocator {
  private _dice: DiceSprite[] = [];
  private _slots: EquipmentSlotIcon[] = [];
  private _allocs = new Map<number, number>(); // dieIndex → equipmentIndex
  private _dragDie: DiceSprite | null = null;
  private _dragOff = { x: 0, y: 0 };
  private _enabled = false;
  private _sw = 390;
  private _homeY = 0;

  onChange: (() => void) | null = null;
  onBringToFront: ((die: DiceSprite) => void) | null = null;
  get dice(): readonly DiceSprite[] { return this._dice; }

  setup(values: number[], slots: EquipmentSlotIcon[], sw: number, homeY: number): DiceSprite[] {
    this.reset();
    this._slots = slots;
    this._sw = sw;
    this._homeY = homeY;
    for (let i = 0; i < values.length; i++) {
      const die = new DiceSprite(i);
      die.on('pointerdown', (e: { global: { x: number; y: number } }) => this.handleDieDown(i, e.global));
      die.roll(values[i]);
      this._dice.push(die);
    }
    return this._dice;
  }

  setEnabled(on: boolean): void { this._enabled = on; if (on) this._highlight(); }
  updateLayout(sw: number, homeY: number): void { this._sw = sw; this._homeY = homeY; }

  reset(): void {
    for (const d of this._dice) d.destroy();
    this._dice = [];
    this._slots = [];
    this._allocs.clear();
    this._dragDie = null;
    this._enabled = false;
  }

  layoutDice(): void {
    const n = this._dice.length;
    if (n === 0) return;
    const tw = n * DIE_SIZE + (n - 1) * DICE_GAP;
    let x = (this._sw - tw) / 2;
    for (const d of this._dice) {
      if (!this._allocs.has(d.dieIndex)) d.position.set(x, this._homeY);
      x += DIE_SIZE + DICE_GAP;
    }
  }

  getAllocations(): Allocation[] {
    return [...this._allocs].map(([di, ei]) => ({
      equipmentIndex: ei, dieValue: this._dice[di].value,
    }));
  }

  isComplete(): boolean { return this._dice.every(d => this._allocs.has(d.dieIndex)); }
  hasAllocations(): boolean { return this._allocs.size > 0; }

  resetAllAllocations(): void {
    for (const di of [...this._allocs.keys()]) this._undo(di);
    this._highlight();
    this.onChange?.();
  }

  handleDieDown(idx: number, pos: { x: number; y: number }): void {
    if (!this._enabled) return;
    const die = this._dice[idx];
    if (!die) return;
    if (this._allocs.has(idx)) this._undo(idx);
    die.visible = true;
    die.setState('dragging');
    this._dragDie = die;
    this._dragOff.x = pos.x - die.x;
    this._dragOff.y = pos.y - die.y;
    this.onBringToFront?.(die);
    this._highlight();
  }

  handlePointerMove(pos: { x: number; y: number }): void {
    if (!this._dragDie) return;
    this._dragDie.x = pos.x - this._dragOff.x;
    this._dragDie.y = pos.y - this._dragOff.y;
    for (const s of this._slots) {
      if (this._over(this._dragDie, s)) s.showPreview(this._dragDie.value);
      else s.clearPreview();
    }
  }

  handlePointerUp(): void {
    if (!this._dragDie) return;
    const die = this._dragDie;
    this._dragDie = null;
    let placed = false;
    for (const s of this._slots) {
      if (s.slotState === 'filled' || s.slotState === 'locked') continue;
      if (!this._over(die, s)) continue;
      if (s.isCompatible(die.value)) {
        this._place(die.dieIndex, s.equipmentIndex);
        placed = true;
      } else { die.shake(); }
      break;
    }
    if (!placed) { die.setState('idle'); this._snapHome(die); }
    for (const s of this._slots) s.clearPreview();
    this._highlight();
    this.onChange?.();
  }

  /** Tap handler — eqIdx is the equipment's original index. */
  handleSlotTap(eqIdx: number): void {
    if (!this._enabled) return;
    const slot = this._slotByEq(eqIdx);
    if (!slot) return;

    // Tap filled slot → release that die
    if (slot.slotState === 'filled') {
      for (const [di, allocEq] of this._allocs) {
        if (allocEq === eqIdx) { this._undo(di); break; }
      }
      this._highlight();
      this.onChange?.();
      return;
    }

    // Tap empty slot → place first compatible unplaced die
    for (const d of this._dice) {
      if (this._allocs.has(d.dieIndex)) continue;
      if (!slot.isCompatible(d.value)) continue;
      this._place(d.dieIndex, eqIdx);
      this._highlight();
      this.onChange?.();
      return;
    }
  }

  private _place(di: number, eqIdx: number): void {
    const die = this._dice[di];
    const slot = this._slotByEq(eqIdx);
    if (!die || !slot) return;
    this._allocs.set(di, eqIdx);
    slot.placeDie(die.value);
    die.setState('placed');
    die.visible = false;
  }

  private _undo(di: number): void {
    const eqIdx = this._allocs.get(di);
    if (eqIdx === undefined) return;
    this._allocs.delete(di);
    this._slotByEq(eqIdx)?.removeDie();
    const die = this._dice[di];
    die.visible = true;
    this._snapHome(die);
  }

  /** Find slot by its equipmentIndex (stable across category reordering). */
  private _slotByEq(eqIdx: number): EquipmentSlotIcon | undefined {
    return this._slots.find(s => s.equipmentIndex === eqIdx);
  }

  private _snapHome(die: DiceSprite): void {
    const n = this._dice.length;
    const tw = n * DIE_SIZE + (n - 1) * DICE_GAP;
    die.x = (this._sw - tw) / 2 + die.dieIndex * (DIE_SIZE + DICE_GAP);
    die.y = this._homeY;
  }

  private _over(die: DiceSprite, slot: EquipmentSlotIcon): boolean {
    const b = slot.getBounds();
    const cx = die.x + DIE_SIZE / 2, cy = die.y + DIE_SIZE / 2;
    return cx >= b.x && cx <= b.x + b.width && cy >= b.y && cy <= b.y + b.height;
  }

  private _highlight(): void {
    const v = this._dragDie?.value ?? null;
    for (const s of this._slots) {
      if (s.slotState === 'filled' || s.slotState === 'locked') continue;
      if (v !== null) s.setState(s.isCompatible(v) ? 'valid-target' : 'dimmed');
      else s.setState('empty');
    }
  }
}
