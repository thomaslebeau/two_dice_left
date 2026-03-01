/**
 * Equipment grid — organizes equipment slots into category rows.
 *
 * Layout:
 *   [ATK] [slot] [slot] ...
 *   [DEF] [slot] [slot] ...
 *   [UTL] [slot] ...
 *
 * Empty categories are hidden. Handles creation, layout, and cleanup
 * of EquipmentSlot instances.
 */

import { Container, Text } from 'pixi.js';
import type { Equipment } from '../../engine/types';
import { EquipmentSlot, SLOT_WIDTH, SLOT_HEIGHT } from './EquipmentSlot';

// ---------------------------------------------------------------------------
// V6 palette
// ---------------------------------------------------------------------------

const BONE = 0xD9CFBA;
const RUST = 0x8B3A1A;
const MOSS = 0x2D4A2E;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SLOT_GAP = 6;
const ROW_GAP = 4;
const LABEL_WIDTH = 30;
const LABEL_FONT_SIZE = 9;

type CategoryKey = 'weapon' | 'shield' | 'utility';

interface CategoryRow {
  key: CategoryKey;
  label: Text;
  slots: EquipmentSlot[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function categoryLabel(key: CategoryKey): string {
  switch (key) {
    case 'weapon': return 'ATK';
    case 'shield': return 'DEF';
    case 'utility': return 'UTL';
  }
}

function categoryColor(key: CategoryKey): number {
  switch (key) {
    case 'weapon': return RUST;
    case 'shield': return MOSS;
    case 'utility': return BONE;
  }
}

// ---------------------------------------------------------------------------
// EquipmentGrid
// ---------------------------------------------------------------------------

export class EquipmentGrid extends Container {
  private _rows: CategoryRow[] = [];
  private _allSlots: EquipmentSlot[] = [];
  private _gridHeight = 0;

  /** Fired when a slot is tapped. Receives the slot's equipmentIndex. */
  onSlotTap: ((equipmentIndex: number) => void) | null = null;

  /** All slots in original equipment order (for allocator). */
  get slots(): readonly EquipmentSlot[] { return this._allSlots; }

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
    const groups = new Map<CategoryKey, { eq: Equipment; idx: number }[]>();
    for (let i = 0; i < equipment.length; i++) {
      const eq = equipment[i];
      const key = eq.type as CategoryKey;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push({ eq, idx: i }); // safe: just created
    }

    // Build rows in fixed order: weapon, shield, utility
    const order: CategoryKey[] = ['weapon', 'shield', 'utility'];
    for (const key of order) {
      const items = groups.get(key);
      if (!items || items.length === 0) continue;

      const label = new Text({
        text: categoryLabel(key),
        style: {
          fontFamily: '"Courier New", monospace',
          fontSize: LABEL_FONT_SIZE,
          fontWeight: 'bold',
          fill: categoryColor(key),
        },
      });
      this.addChild(label);

      const slots: EquipmentSlot[] = [];
      for (const { eq, idx } of items) {
        const slot = new EquipmentSlot(eq, idx);
        if (locked) {
          slot.lock();
        } else {
          slot.on('pointerdown', () => this.onSlotTap?.(idx));
        }
        this.addChild(slot);
        slots.push(slot);
        this._allSlots.push(slot);
      }

      this._rows.push({ key, label, slots });
    }
  }

  // -----------------------------------------------------------------------
  // Layout
  // -----------------------------------------------------------------------

  /** Position rows within given width. Call after build(). */
  layout(availWidth: number): void {
    let y = 0;

    for (const row of this._rows) {
      // Label on the left, vertically centered on slot
      row.label.position.set(0, y + (SLOT_HEIGHT - LABEL_FONT_SIZE) / 2);

      // Slots start after label
      let x = LABEL_WIDTH;
      for (const slot of row.slots) {
        slot.position.set(x, y);
        x += SLOT_WIDTH + SLOT_GAP;
      }

      y += SLOT_HEIGHT + ROW_GAP;
    }

    this._gridHeight = Math.max(0, y - ROW_GAP);
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
    const slot = this._allSlots.find(s => s.equipmentIndex === equipmentIndex);
    slot?.placeDie(dieValue);
  }

  // -----------------------------------------------------------------------
  // Cleanup
  // -----------------------------------------------------------------------

  clear(): void {
    for (const s of this._allSlots) s.destroy({ children: true });
    for (const row of this._rows) row.label.destroy();
    this._allSlots = [];
    this._rows = [];
    this._gridHeight = 0;
    this.removeChildren();
  }
}
