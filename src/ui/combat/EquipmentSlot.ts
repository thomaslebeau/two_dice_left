/**
 * V6 equipment slot — drop target for dice.
 * Shows equipment name, die range, and effect preview on hover.
 * States: empty, valid-target, filled, locked.
 */

import { Container, Graphics, Text } from 'pixi.js';
import type { Equipment, EquipmentEffect } from '../../engine/types';
import { canUseDie } from '../../engine/dice';

// ---------------------------------------------------------------------------
// V6 palette
// ---------------------------------------------------------------------------

const BONE = 0xD9CFBA;
const RUST = 0x8B3A1A;
const MOSS = 0x2D4A2E;
const CHARCOAL = 0x1A1A1A;
const BLOOD = 0x6B1C1C;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const SLOT_WIDTH = 110;
export const SLOT_HEIGHT = 58;
const CORNER_RADIUS = 6;
const MIN_TOUCH_SIZE = 44;

export type SlotState = 'empty' | 'valid-target' | 'filled' | 'locked';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format the actual computed effect of a placed die. */
function formatResult(effect: EquipmentEffect): string {
  const parts: string[] = [];
  if (effect.damage > 0) parts.push(`${effect.damage} dmg`);
  if (effect.shield > 0) parts.push(`${effect.shield} abs`);
  if (effect.heal > 0) parts.push(`${effect.heal} soin`);
  if (effect.poison > 0) parts.push(`${effect.poison}t poison`);
  return parts.join(' + ') || '0';
}

function typeLabel(type: Equipment['type']): string {
  switch (type) {
    case 'weapon': return 'ATK';
    case 'shield': return 'DEF';
    case 'utility': return 'UTL';
  }
}

function typeColor(type: Equipment['type']): number {
  switch (type) {
    case 'weapon': return RUST;
    case 'shield': return MOSS;
    case 'utility': return BONE;
  }
}

// ---------------------------------------------------------------------------
// EquipmentSlot
// ---------------------------------------------------------------------------

export class EquipmentSlot extends Container {
  private _bg = new Graphics();
  private _nameText: Text;
  private _rangeText: Text;
  private _previewText: Text;
  private _equipment: Equipment;
  private _equipmentIndex: number;
  private _state: SlotState = 'empty';
  private _placedDieValue: number | null = null;

  constructor(equipment: Equipment, equipmentIndex: number) {
    super();
    this._equipment = equipment;
    this._equipmentIndex = equipmentIndex;

    this.addChild(this._bg);

    const icon = typeLabel(equipment.type);
    const tColor = typeColor(equipment.type);

    this._nameText = new Text({
      text: `${icon} ${equipment.name}`,
      style: {
        fontFamily: '"Courier New", monospace',
        fontSize: 10,
        fontWeight: 'bold',
        fill: tColor,
      },
    });
    this._nameText.position.set(6, 4);
    this.addChild(this._nameText);

    this._rangeText = new Text({
      text: `[${equipment.minDie}-${equipment.maxDie}] ${equipment.description}`,
      style: {
        fontFamily: '"Courier New", monospace',
        fontSize: 9,
        fill: BONE,
      },
    });
    this._rangeText.position.set(6, 18);
    this.addChild(this._rangeText);

    this._previewText = new Text({
      text: '',
      style: {
        fontFamily: '"Courier New", monospace',
        fontSize: 10,
        fontWeight: 'bold',
        fill: BONE,
      },
    });
    this._previewText.position.set(6, 34);
    this.addChild(this._previewText);

    this.eventMode = 'static';
    this.cursor = 'pointer';
    // Ensure minimum touch target
    this.hitArea = {
      contains: (x: number, y: number) =>
        x >= 0 && x <= Math.max(SLOT_WIDTH, MIN_TOUCH_SIZE)
        && y >= 0 && y <= Math.max(SLOT_HEIGHT, MIN_TOUCH_SIZE),
    };

    this._draw();
  }

  get equipment(): Equipment { return this._equipment; }
  get equipmentIndex(): number { return this._equipmentIndex; }
  get slotState(): SlotState { return this._state; }
  get placedDieValue(): number | null { return this._placedDieValue; }

  /** Check if a die value is compatible with this slot. */
  isCompatible(dieValue: number): boolean {
    return canUseDie(this._equipment, dieValue);
  }

  /** Update slot state. */
  setState(state: SlotState): void {
    this._state = state;
    this._draw();
  }

  /** Place a die in this slot. Shows the actual calculated result. */
  placeDie(dieValue: number): void {
    this._placedDieValue = dieValue;
    this._state = 'filled';
    const effect = this._equipment.effect(dieValue);
    this._previewText.text = `-> ${formatResult(effect)}`;
    this._previewText.style.fill = typeColor(this._equipment.type);
    this._draw();
  }

  /** Remove the placed die and revert to empty. */
  removeDie(): void {
    this._placedDieValue = null;
    this._state = 'empty';
    this._previewText.text = '';
    this._draw();
  }

  /** Lock after commit — no more changes. */
  lock(): void {
    this._state = 'locked';
    this.cursor = 'default';
    this._draw();
  }

  /** Show hover preview for a die value (without placing). */
  showPreview(dieValue: number): void {
    if (!this.isCompatible(dieValue)) {
      this._previewText.text = 'X incompatible';
      this._previewText.style.fill = BLOOD;
      return;
    }
    const effect = this._equipment.effect(dieValue);
    this._previewText.text = `-> ${formatResult(effect)}`;
    this._previewText.style.fill = typeColor(this._equipment.type);
  }

  /** Clear hover preview. */
  clearPreview(): void {
    if (this._state !== 'filled') {
      this._previewText.text = '';
    }
  }

  // --- Drawing ---

  private _draw(): void {
    this._bg.clear();

    let borderColor = 0x555555;
    let borderWidth = 1;
    let fillColor = CHARCOAL;
    let fillAlpha = 0.7;
    let dashed = false;

    switch (this._state) {
      case 'empty':
        dashed = true;
        borderColor = 0x666666;
        break;
      case 'valid-target':
        borderColor = RUST;
        borderWidth = 2;
        fillAlpha = 0.85;
        break;
      case 'filled':
        borderColor = typeColor(this._equipment.type);
        borderWidth = 2;
        fillColor = 0x222222;
        fillAlpha = 0.9;
        break;
      case 'locked':
        borderColor = 0x444444;
        fillColor = 0x1A1A1A;
        fillAlpha = 0.6;
        break;
    }

    // Fill
    this._bg.roundRect(0, 0, SLOT_WIDTH, SLOT_HEIGHT, CORNER_RADIUS);
    this._bg.fill({ color: fillColor, alpha: fillAlpha });

    // Border (dashed for empty via short segments)
    if (dashed) {
      this._drawDashedBorder(borderColor);
    } else {
      this._bg.roundRect(0, 0, SLOT_WIDTH, SLOT_HEIGHT, CORNER_RADIUS);
      this._bg.stroke({ color: borderColor, width: borderWidth });
    }

    // Dim text when locked
    this._nameText.alpha = this._state === 'locked' ? 0.5 : 1;
    this._rangeText.alpha = this._state === 'locked' ? 0.4 : 0.7;
  }

  private _drawDashedBorder(color: number): void {
    const dashLen = 6;
    const gapLen = 4;
    const w = SLOT_WIDTH;
    const h = SLOT_HEIGHT;

    // Top edge
    for (let x = 0; x < w; x += dashLen + gapLen) {
      const end = Math.min(x + dashLen, w);
      this._bg.moveTo(x, 0);
      this._bg.lineTo(end, 0);
    }
    // Right edge
    for (let y = 0; y < h; y += dashLen + gapLen) {
      const end = Math.min(y + dashLen, h);
      this._bg.moveTo(w, y);
      this._bg.lineTo(w, end);
    }
    // Bottom edge
    for (let x = 0; x < w; x += dashLen + gapLen) {
      const end = Math.min(x + dashLen, w);
      this._bg.moveTo(x, h);
      this._bg.lineTo(end, h);
    }
    // Left edge
    for (let y = 0; y < h; y += dashLen + gapLen) {
      const end = Math.min(y + dashLen, h);
      this._bg.moveTo(0, y);
      this._bg.lineTo(0, end);
    }
    this._bg.stroke({ color, width: 1, alpha: 0.5 });
  }
}
