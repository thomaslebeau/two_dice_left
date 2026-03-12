/**
 * Compact enemy zone — name + HP bar + equipment icons + dice.
 * Two rows, ~80px total. Replaces stacked CombatantHud + EquipmentGrid + EnemyDiceRow.
 */

import { Container, Graphics, Text } from 'pixi.js';
import type { Equipment } from '../../engine/types';
import { EquipmentSlotIcon, ICON_SIZE } from './EquipmentSlotIcon';
import { DiceSprite, DIE_SIZE } from './DiceSprite';
import { tickerWait, tickerSteps } from './tickerUtils';
import { FONTS, TEXT_COLORS } from '../../theme';

const BONE = 0xD9CFBA;
const MOSS = 0x2D4A2E;
const BLOOD = 0x6B1C1C;
const VENOM = 0x7B2D8B;
const HP_BAR_H = 10;
const SLOT_GAP = 3;
const DICE_SCALE = 0.75;
const DICE_GAP = 4;
const ROW_GAP = 4;

export class EnemyZone extends Container {
  private _nameText: Text;
  private _hpBg = new Graphics();
  private _hpFill = new Graphics();
  private _hpText: Text;
  private _poisonBadge = new Container();
  private _poisonBg = new Graphics();
  private _poisonLabel: Text;
  private _slots: EquipmentSlotIcon[] = [];
  private _dice: DiceSprite[] = [];
  private _diceValues: number[] = [];
  private _zoneHeight = 0;

  constructor() {
    super();
    this._nameText = this._mkText(20, BONE, true);
    this.addChild(this._nameText);
    this.addChild(this._hpBg, this._hpFill);
    this._hpText = this._mkText(14, BONE);
    this.addChild(this._hpText);
    this._poisonBadge.visible = false;
    this._poisonBadge.addChild(this._poisonBg);
    this._poisonLabel = this._mkText(16, BONE, true);
    this._poisonLabel.position.set(4, 2);
    this._poisonBadge.addChild(this._poisonLabel);
    this.addChild(this._poisonBadge);
  }

  get hpFillGraphics(): Graphics { return this._hpFill; }
  get zoneHeight(): number { return this._zoneHeight; }
  get slots(): readonly EquipmentSlotIcon[] { return this._slots; }
  get diceValues(): readonly number[] { return this._diceValues; }

  setName(name: string): void { this._nameText.text = name; }

  buildSlots(equipment: readonly Equipment[]): void {
    for (const s of this._slots) s.destroy({ children: true });
    this._slots = [];
    for (let i = 0; i < equipment.length; i++) {
      const slot = new EquipmentSlotIcon(equipment[i], i);
      slot.lock();
      this.addChild(slot);
      this._slots.push(slot);
    }
  }

  buildDice(values: number[]): void {
    this.clearDice();
    this._diceValues = values;
    for (let i = 0; i < values.length; i++) {
      const d = new DiceSprite(i);
      d.eventMode = 'none';
      d.alpha = 0.6;
      d.scale.set(DICE_SCALE);
      this._dice.push(d);
      this.addChild(d);
      d.roll(values[i]);
    }
  }

  clearDice(): void {
    for (const d of this._dice) d.destroy();
    this._dice = [];
    this._diceValues = [];
  }

  updateHp(current: number, max: number, barW: number): void {
    const barY = this._nameText.height + 1;
    this._hpBg.clear();
    this._hpBg.roundRect(0, barY, barW, HP_BAR_H, 2);
    this._hpBg.fill({ color: 0x333333 });
    this._hpFill.clear();
    this._hpFill.position.set(0, barY);
    const pct = Math.max(0, current / max);
    const fw = pct * barW;
    if (fw > 0) {
      this._hpFill.roundRect(0, 0, fw, HP_BAR_H, 2);
      this._hpFill.fill({ color: pct > 0.3 ? MOSS : BLOOD });
    }
    this._hpText.text = `${current}/${max}`;
    this._hpText.position.set(barW + 4, barY - 1);
    this._poisonBadge.position.set(barW + 4 + this._hpText.width + 4, barY - 1);
  }

  setPoisonTurns(turns: number): void {
    if (turns <= 0) { this._poisonBadge.visible = false; return; }
    this._poisonBadge.visible = true;
    this._poisonLabel.text = `\u2620${turns}`;
    this._redrawPoisonBg();
  }

  showPoisonStack(before: number, after: number): void {
    if (after <= 0) return;
    this._poisonBadge.visible = true;
    this._poisonLabel.text = `\u2620${before}\u2192${after}`;
    this._redrawPoisonBg();
    void tickerWait(800).then(() => {
      if (after <= 0) { this._poisonBadge.visible = false; return; }
      this._poisonLabel.text = `\u2620${after}`;
      this._redrawPoisonBg();
    });
  }

  pulsePoisonBadge(): void {
    if (!this._poisonBadge.visible) return;
    void tickerSteps(6, 80, (s) => { this._poisonBadge.alpha = s % 2 === 0 ? 1 : 0.3; })
      .then(() => { this._poisonBadge.alpha = 1; });
  }

  placeDie(equipmentIndex: number, dieValue: number): void {
    const slot = this._slots.find(s => s.equipmentIndex === equipmentIndex);
    if (!slot) return;
    slot.placeDie(dieValue);
    const color = slot.equipment.type === 'weapon'
      ? TEXT_COLORS.ENEMY_ACTION : TEXT_COLORS.NEUTRAL;
    slot.setEffectColor(color);
  }

  resetSlots(): void { for (const s of this._slots) s.removeDie(); }

  layout(_availW: number): void {
    this._nameText.position.set(0, 0);
    const row1H = this._nameText.height + 1 + HP_BAR_H + 2;
    const row2Y = row1H + ROW_GAP;
    let sx = 0;
    for (const slot of this._slots) {
      slot.position.set(sx, row2Y);
      sx += ICON_SIZE + SLOT_GAP;
    }
    const dieW = DIE_SIZE * DICE_SCALE;
    let dx = sx + (this._slots.length > 0 ? DICE_GAP : 0);
    for (const d of this._dice) {
      d.position.set(dx, row2Y + (ICON_SIZE - dieW) / 2);
      dx += dieW + DICE_GAP;
    }
    this._zoneHeight = row2Y + ICON_SIZE;
  }

  clear(): void {
    for (const s of this._slots) s.destroy({ children: true });
    this._slots = [];
    this.clearDice();
  }

  private _redrawPoisonBg(): void {
    this._poisonBg.clear();
    const w = this._poisonLabel.width + 10;
    this._poisonBg.roundRect(0, 0, w, 22, 3);
    this._poisonBg.fill({ color: VENOM, alpha: 0.85 });
  }

  private _mkText(size: number, color: number, bold = false): Text {
    return new Text({
      text: '', style: {
        fontFamily: FONTS.HEADING, fontSize: size,
        fontWeight: bold ? 'bold' : 'normal', fill: color,
      },
    });
  }
}
