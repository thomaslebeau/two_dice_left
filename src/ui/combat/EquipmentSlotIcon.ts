/**
 * Compact 44×44px equipment slot icon — drop target for dice.
 * States: empty, valid-target, dimmed, filled, locked.
 */

import { Container, Graphics, Text } from 'pixi.js';
import type { Equipment, EquipmentEffect } from '../../engine/types';
import { canUseDie } from '../../engine/dice';

const BONE = 0xD9CFBA;
const RUST = 0x8B3A1A;
const MOSS = 0x2D4A2E;
const CHARCOAL = 0x1A1A1A;

export const ICON_SIZE = 44;
const CORNER_R = 5;

export type SlotState = 'empty' | 'valid-target' | 'dimmed' | 'filled' | 'locked';

function fmtEffect(e: EquipmentEffect): string {
  if (e.damage > 0) return `${e.damage}dmg`;
  if (e.shield > 0) return `${e.shield}abs`;
  if (e.heal > 0) return `${e.heal}hp`;
  if (e.poison > 0) return `${e.poison}psn`;
  return '0';
}

function typeIcon(t: Equipment['type']): string {
  return t === 'weapon' ? '\u2694' : t === 'shield' ? '\u{1F6E1}' : '\u2695';
}

function typeColor(t: Equipment['type']): number {
  return t === 'weapon' ? RUST : t === 'shield' ? MOSS : BONE;
}

function brighten(c: number): number {
  const r = Math.min(255, ((c >> 16) & 0xFF) + 40);
  const g = Math.min(255, ((c >> 8) & 0xFF) + 40);
  const b = Math.min(255, (c & 0xFF) + 40);
  return (r << 16) | (g << 8) | b;
}

function mkText(
  txt: string, size: number, color: number, bold = false,
): Text {
  const t = new Text({
    text: txt,
    style: {
      fontFamily: '"Courier New", monospace', fontSize: size,
      fontWeight: bold ? 'bold' : 'normal', fill: color,
    },
  });
  t.anchor.set(0.5, 0);
  return t;
}

export class EquipmentSlotIcon extends Container {
  private _bg = new Graphics();
  private _iconText: Text;
  private _rangeText: Text;
  private _valueText: Text;
  private _effectText: Text;
  private _equipment: Equipment;
  private _equipmentIndex: number;
  private _state: SlotState = 'empty';
  private _placedDieValue: number | null = null;

  constructor(equipment: Equipment, equipmentIndex: number) {
    super();
    this._equipment = equipment;
    this._equipmentIndex = equipmentIndex;
    const c = typeColor(equipment.type);
    const half = ICON_SIZE / 2;

    this.addChild(this._bg);
    this._iconText = mkText(typeIcon(equipment.type), 10, c, true);
    this._iconText.position.set(half, 3);
    this._rangeText = mkText(`[${equipment.minDie}-${equipment.maxDie}]`, 8, BONE);
    this._rangeText.position.set(half, 16);
    this._valueText = mkText('', 14, BONE, true);
    this._valueText.position.set(half, 4);
    this._valueText.visible = false;
    this._effectText = mkText('', 8, c);
    this._effectText.position.set(half, 22);
    this._effectText.visible = false;
    this.addChild(this._iconText, this._rangeText, this._valueText, this._effectText);

    this.eventMode = 'static';
    this.cursor = 'pointer';
    this.hitArea = {
      contains: (x: number, y: number) =>
        x >= 0 && x <= ICON_SIZE && y >= 0 && y <= ICON_SIZE,
    };
    this._draw();
  }

  get equipment(): Equipment { return this._equipment; }
  get equipmentIndex(): number { return this._equipmentIndex; }
  get slotState(): SlotState { return this._state; }
  get placedDieValue(): number | null { return this._placedDieValue; }

  isCompatible(dieValue: number): boolean {
    return canUseDie(this._equipment, dieValue);
  }

  setState(state: SlotState): void { this._state = state; this._draw(); }

  placeDie(dieValue: number): void {
    this._placedDieValue = dieValue;
    this._state = 'filled';
    this._valueText.text = `${dieValue}`;
    this._effectText.text = `\u2192${fmtEffect(this._equipment.effect(dieValue))}`;
    this._toggleFilled(true);
    this._draw();
  }

  removeDie(): void {
    this._placedDieValue = null;
    this._state = 'empty';
    this._toggleFilled(false);
    this._draw();
  }

  lock(): void { this._state = 'locked'; this.cursor = 'default'; this._draw(); }

  showPreview(dieValue: number): void {
    if (!this.isCompatible(dieValue)) return;
    this._effectText.text = `\u2192${fmtEffect(this._equipment.effect(dieValue))}`;
    this._effectText.visible = true;
  }

  clearPreview(): void {
    if (this._state !== 'filled') this._effectText.visible = false;
  }

  private _toggleFilled(filled: boolean): void {
    this._iconText.visible = !filled;
    this._rangeText.visible = !filled;
    this._valueText.visible = filled;
    this._effectText.visible = filled;
  }

  private _draw(): void {
    this._bg.clear();
    const tc = typeColor(this._equipment.type);
    let bc = 0x555555, bw = 1, fc = CHARCOAL, fa = 0.7, dashed = false;

    switch (this._state) {
      case 'empty': dashed = true; bc = tc; break;
      case 'valid-target': bc = tc; bw = 2; fc = brighten(tc); fa = 0.25; break;
      case 'dimmed':
        this.alpha = 0.35;
        this._rect(fc, 0.35, 0x444444, 1);
        return;
      case 'filled': bc = tc; bw = 2; fc = 0x222222; fa = 0.9; break;
      case 'locked': bc = 0x444444; fc = 0x1A1A1A; fa = 0.6; break;
    }
    this.alpha = 1;
    if (dashed) {
      this._bg.roundRect(0, 0, ICON_SIZE, ICON_SIZE, CORNER_R);
      this._bg.fill({ color: fc, alpha: fa });
      this._dashed(bc);
    } else {
      this._rect(fc, fa, bc, bw);
    }
    this._iconText.alpha = this._state === 'locked' ? 0.5 : 1;
    this._rangeText.alpha = this._state === 'locked' ? 0.4 : 0.7;
  }

  private _rect(f: number, fa: number, b: number, bw: number): void {
    this._bg.roundRect(0, 0, ICON_SIZE, ICON_SIZE, CORNER_R);
    this._bg.fill({ color: f, alpha: fa });
    this._bg.roundRect(0, 0, ICON_SIZE, ICON_SIZE, CORNER_R);
    this._bg.stroke({ color: b, width: bw });
  }

  private _dashed(color: number): void {
    const d = 4, g = 3, s = ICON_SIZE;
    for (let i = 0; i < s; i += d + g) {
      const e = Math.min(i + d, s);
      this._bg.moveTo(i, 0).lineTo(e, 0);
      this._bg.moveTo(s, i).lineTo(s, e);
      this._bg.moveTo(i, s).lineTo(e, s);
      this._bg.moveTo(0, i).lineTo(0, e);
    }
    this._bg.stroke({ color, width: 1, alpha: 0.5 });
  }
}
