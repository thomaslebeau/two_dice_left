/**
 * Equipment grid — compact icon layout for equipment slots.
 *
 * Flat horizontal flow: slots arranged left-to-right, wrapping by
 * category group. Type-colored borders on icons replace category labels.
 *
 * Handles creation, layout, and cleanup of EquipmentSlotIcon instances.
 */

import { Container } from 'pixi.js';
import type { Equipment } from '../../engine/types';
import { EquipmentSlotIcon, ICON_SIZE } from './EquipmentSlotIcon';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SLOT_GAP = 4;
const ROW_GAP = 4;
type CategoryKey = 'weapon' | 'shield' | 'utility';

interface CategoryGroup {
  key: CategoryKey;
  slots: EquipmentSlotIcon[];
}

// ---------------------------------------------------------------------------
// EquipmentGrid
// ---------------------------------------------------------------------------

export class EquipmentGrid extends Container {
  private _groups: CategoryGroup[] = [];
  private _allSlots: EquipmentSlotIcon[] = [];
  private _gridHeight = 0;

  /** Fired when a slot is tapped. Receives the slot's equipmentIndex. */
  onSlotTap: ((equipmentIndex: number) => void) | null = null;

  /** All slots in original equipment order (for allocator). */
  get slots(): readonly EquipmentSlotIcon[] { return this._allSlots; }

  /** Total height of the grid after layout. */
  get gridHeight(): number { return this._gridHeight; }

  // -----------------------------------------------------------------------
  // Build
  // -----------------------------------------------------------------------

  /**
   * Create slots from equipment list, grouped by type.
   * @param locked If true, all slots start locked (enemy grid).
   */
  build(equipment: readonly Equipment[], locked = false): void {
    this.clear();

    // Group equipment by type, preserving original indices
    const grouped = new Map<CategoryKey, { eq: Equipment; idx: number }[]>();
    for (let i = 0; i < equipment.length; i++) {
      const eq = equipment[i];
      const key = eq.type as CategoryKey;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push({ eq, idx: i }); // safe: just created
    }

    // Build groups in fixed order: weapon, shield, utility
    const order: CategoryKey[] = ['weapon', 'shield', 'utility'];
    for (const key of order) {
      const items = grouped.get(key);
      if (!items || items.length === 0) continue;

      const slots: EquipmentSlotIcon[] = [];
      for (const { eq, idx } of items) {
        const slot = new EquipmentSlotIcon(eq, idx);
        if (eq.isPassive) {
          // Passive equipment: no die allocation, locked with distinct style
          slot.lock();
        } else if (locked) {
          slot.lock();
        } else {
          slot.on('pointerdown', () => this.onSlotTap?.(idx));
        }
        this.addChild(slot);
        slots.push(slot);
        this._allSlots.push(slot);
      }

      this._groups.push({ key, slots });
    }
  }

  // -----------------------------------------------------------------------
  // Layout
  // -----------------------------------------------------------------------

  /** Position slots in rows by category. Call after build(). */
  layout(_availWidth: number): void {
    let y = 0;

    for (const group of this._groups) {
      let x = 0;
      for (const slot of group.slots) {
        slot.position.set(x, y);
        x += ICON_SIZE + SLOT_GAP;
      }
      y += ICON_SIZE + ROW_GAP;
    }

    this._gridHeight = this._groups.length > 0
      ? y - ROW_GAP  // remove trailing gap
      : 0;
  }

  // -----------------------------------------------------------------------
  // Slot operations (delegated by CombatScene)
  // -----------------------------------------------------------------------

  /** Lock all slots (after commit). */
  lockAll(): void {
    for (const s of this._allSlots) s.lock();
  }

  /** Remove all placed dice (start of round). */
  resetAll(): void {
    for (const s of this._allSlots) s.removeDie();
  }

  /** Place a die into a specific slot by equipmentIndex. */
  placeDie(equipmentIndex: number, dieValue: number): void {
    const slot = this._allSlots.find(
      s => s.equipmentIndex === equipmentIndex,
    );
    slot?.placeDie(dieValue);
  }

  // -----------------------------------------------------------------------
  // Cleanup
  // -----------------------------------------------------------------------

  clear(): void {
    for (const s of this._allSlots) s.destroy({ children: true });
    this._allSlots = [];
    this._groups = [];
    this._gridHeight = 0;
    this.removeChildren();
  }
}
