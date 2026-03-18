/**
 * Single toolbox compartment — metal plate showing equipment info.
 * Layout: icon + effect (top), name (middle), range (bottom).
 * When die placed: die replaces icon, effect shows computed value.
 */

import { Container, Graphics, Text } from 'pixi.js';
import type { Equipment, EquipmentEffect, EffectContext } from '../../engine/types';
import { canUseDie } from '../../engine/dice';
import { FONTS, TEXT_COLORS } from '../../theme';
import { STRINGS, formatRange } from '../../data/strings';
import type { SlotLike, SlotState } from './SlotLike';
import type { DiceSprite } from './DiceSprite';
import { PipBar } from '../shared/PipBar';

const IRON_FILL = 0x3A3A3A;
const IRON_BORDER = 0x555555;
const BONE = 0xD9CFBA;
const RUST = 0x8B3A1A;
const MOSS = 0x2D4A2E;
const CHARCOAL = 0x1A1A1A;
const GOLD = 0xF0C040;
const PLATE_MARGIN = 2;

function typeGlyph(t: Equipment['type']): string {
  return t === 'weapon' ? '\u{1F5E1}' : t === 'shield' ? '\uD83D\uDEE1' : '\u2695';
}

function typeColor(t: Equipment['type']): number {
  return t === 'weapon' ? RUST : t === 'shield' ? MOSS : BONE;
}

function typeTextColor(t: Equipment['type']): number {
  return t === 'weapon' ? TEXT_COLORS.PLAYER_ACTION
    : t === 'shield' ? TEXT_COLORS.BLOCK
    : TEXT_COLORS.NEUTRAL;
}

function pipColor(t: Equipment['type']): number {
  return t === 'weapon' ? TEXT_COLORS.PLAYER_ACTION
    : t === 'shield' ? TEXT_COLORS.BLOCK
    : TEXT_COLORS.PLAYER_ACTION;
}

function maxPips(eq: Equipment): number {
  const eff = eq.effect(eq.maxDie);
  return Math.max(eff.damage + eff.shield + eff.heal + eff.poison, 1);
}

function effectPips(eff: EquipmentEffect): number {
  return eff.damage + eff.shield + eff.heal + eff.poison;
}

function fmtEffect(e: EquipmentEffect): string {
  const parts: string[] = [];
  if (e.damage > 0) parts.push(`${e.damage} ${STRINGS.DAMAGE}`);
  if (e.shield > 0) parts.push(`${e.shield} ${STRINGS.BLOCK}`);
  if (e.heal > 0) parts.push(`${e.heal} ${STRINGS.HEAL}`);
  if (e.poison > 0) parts.push(`${e.poison} ${STRINGS.POISON}`);
  return parts.join(' ') || '0';
}

export class ToolBoxCompartment extends Container implements SlotLike {
  private _equipment: Equipment;
  private _equipmentIndex: number;
  private _state: SlotState = 'empty';
  private _placedDieValue: number | null = null;
  private _placedDie: DiceSprite | null = null;

  private _plate = new Graphics();
  private _glyphText: Text;
  private _nameText: Text;
  private _rangeText: Text;
  private _effectText: Text;
  private _passiveBonusText: Text;
  private _borderGlow = new Graphics();
  private _pipBar: PipBar;

  private _w = 90;
  private _h = 72;

  constructor(equipment: Equipment, equipmentIndex: number) {
    super();
    this._equipment = equipment;
    this._equipmentIndex = equipmentIndex;

    this.addChild(this._plate);
    this._borderGlow.visible = false;
    this.addChild(this._borderGlow);

    const tc = typeColor(equipment.type);

    // Top-left: type icon
    this._glyphText = this._mkText(
      typeGlyph(equipment.type), 14, tc, true, 'left',
    );

    // Top-right: effect description
    this._effectText = this._mkText(
      equipment.description, 11, typeTextColor(equipment.type),
      false, 'right',
    );
    this._effectText.style.fontFamily = FONTS.BODY;

    // Middle: equipment name
    this._nameText = this._mkText(
      equipment.name, 11, BONE, true, 'center',
    );

    // Bottom: range
    const rng = formatRange(equipment.minDie, equipment.maxDie);
    this._rangeText = this._mkText(
      rng, 10, TEXT_COLORS.MUTED, false, 'center',
    );
    this._rangeText.style.fontFamily = FONTS.BODY;
    this._rangeText.visible = rng.length > 0;

    // Passive bonus (synergy "+2")
    this._passiveBonusText = this._mkText(
      '', 11, BONE, true, 'right',
    );
    this._passiveBonusText.visible = false;

    this.addChild(
      this._glyphText, this._effectText,
      this._nameText, this._rangeText, this._passiveBonusText,
    );

    // Pip bar below plate
    this._pipBar = new PipBar(
      maxPips(equipment), pipColor(equipment.type), 5, 2,
    );
    this._pipBar.visible = false;
    this.addChild(this._pipBar);

    this.eventMode = 'static';
    this.cursor = 'pointer';
    this._layoutTexts();
    this._draw();
  }

  get equipment(): Equipment { return this._equipment; }
  get equipmentIndex(): number { return this._equipmentIndex; }
  get slotState(): SlotState { return this._state; }
  get placedDieValue(): number | null { return this._placedDieValue; }

  resize(w: number, h: number): void {
    this._w = w;
    this._h = h;
    this._layoutTexts();
    this._draw();
  }

  isCompatible(dieValue: number): boolean {
    return canUseDie(this._equipment, dieValue);
  }

  setState(state: SlotState): void {
    this._state = state;
    this._draw();
  }

  placeDie(dieValue: number): void {
    this._placedDieValue = dieValue;
    this._state = 'filled';
    // Switch effect from description to computed value
    this._effectText.text = fmtEffect(
      this._equipment.effect(dieValue),
    );
    this._toggleFilled(true);
    this._updatePips(dieValue);
    this._draw();
  }

  removeDie(): void {
    this._placedDieValue = null;
    this._state = 'empty';
    // Restore description
    this._effectText.text = this._equipment.description;
    this._toggleFilled(false);
    this._pipBar.reset();
    this._pipBar.visible = false;
    this._draw();
  }

  lock(): void {
    this._state = 'locked';
    this.cursor = 'default';
    this._draw();
  }

  showPreview(dieValue: number, context?: EffectContext): void {
    if (!this.isCompatible(dieValue)) return;
    this._effectText.text = fmtEffect(
      this._equipment.effect(dieValue, context),
    );
  }

  clearPreview(): void {
    if (this._state !== 'filled') {
      this._effectText.text = this._equipment.description;
    }
  }

  updateEffectWithContext(context?: EffectContext): void {
    if (this._placedDieValue === null) return;
    const base = this._equipment.effect(this._placedDieValue);
    const full = this._equipment.effect(this._placedDieValue, context);
    const bonus = (full.damage - base.damage)
      + (full.shield - base.shield)
      + (full.heal - base.heal);
    this._effectText.text = fmtEffect(full);
    if (bonus > 0) {
      this._passiveBonusText.text = `+${bonus}`;
      this._passiveBonusText.style.fill = GOLD;
      this._passiveBonusText.visible = true;
    } else {
      this._passiveBonusText.visible = false;
    }
    this._updatePips(this._placedDieValue, context);
  }

  showPassiveBonus(value: number, color: number): void {
    this._passiveBonusText.text = `+${value}`;
    this._passiveBonusText.style.fill = color;
    this._passiveBonusText.visible = true;
  }

  clearPassiveBonus(): void {
    this._passiveBonusText.visible = false;
  }

  showBorderGlow(color: number): void {
    const pw = this._w - PLATE_MARGIN * 2;
    const ph = this._h - PLATE_MARGIN * 2;
    this._borderGlow.clear();
    this._borderGlow.rect(
      PLATE_MARGIN - 2, PLATE_MARGIN - 2, pw + 4, ph + 4,
    );
    this._borderGlow.stroke({ color, width: 2, alpha: 0.8 });
    this._borderGlow.visible = true;
  }

  clearBorderGlow(): void {
    this._borderGlow.clear();
    this._borderGlow.visible = false;
  }

  receiveDie(die: DiceSprite): void {
    this._placedDie = die;
    this.addChild(die);
    this._positionDie(die);
    die.visible = true;
    die.setState('placed');
    this._glyphText.visible = false;
  }

  releaseDie(): DiceSprite | null {
    const die = this._placedDie;
    if (!die) return null;
    this._placedDie = null;
    if (!die.destroyed) {
      this.removeChild(die);
      die.scale.set(1);
    }
    this._glyphText.visible = true;
    return die;
  }

  // -----------------------------------------------------------------------
  // Private
  // -----------------------------------------------------------------------

  private _mkText(
    txt: string, size: number, color: number,
    bold: boolean, anchor: 'left' | 'center' | 'right',
  ): Text {
    const t = new Text({
      text: txt,
      style: {
        fontFamily: FONTS.HEADING, fontSize: size,
        fontWeight: bold ? 'bold' : 'normal', fill: color,
      },
    });
    const ax = anchor === 'left' ? 0 : anchor === 'right' ? 1 : 0.5;
    t.anchor.set(ax, 0);
    return t;
  }

  private _updatePips(dieValue: number, context?: EffectContext): void {
    const eff = this._equipment.effect(dieValue, context);
    this._pipBar.setMax(maxPips(this._equipment));
    this._pipBar.fillPips(effectPips(eff));
    this._pipBar.visible = true;
  }

  /** Position and scale the die centered in the middle zone. */
  private _positionDie(die: DiceSprite): void {
    const nameH = 14;
    const bottomH = 14;
    const top = PLATE_MARGIN + nameH + 2;
    const bot = this._h - PLATE_MARGIN - bottomH - 2;
    const zoneH = bot - top;
    const maxSize = Math.min(zoneH - 2, this._w - PLATE_MARGIN * 2 - 8);
    const s = maxSize / 52;
    const dieW = 52 * s;
    die.scale.set(s);
    die.position.set(
      (this._w - dieW) / 2,
      top + (zoneH - dieW) / 2,
    );
  }

  private _layoutTexts(): void {
    const cx = this._w / 2;
    const pad = PLATE_MARGIN + 4;
    const nameH = 14;
    const bottomH = 14;

    // Top zone: name
    this._nameText.anchor.set(0.5, 0);
    this._nameText.position.set(cx, PLATE_MARGIN + 2);

    // Middle zone: glyph centered
    const midTop = PLATE_MARGIN + nameH + 2;
    const midBot = this._h - PLATE_MARGIN - bottomH - 2;
    const midCy = midTop + (midBot - midTop) / 2;
    this._glyphText.anchor.set(0.5, 0.5);
    this._glyphText.position.set(cx, midCy);

    // Bottom zone: effect (left) + range (right)
    const btmY = this._h - PLATE_MARGIN - bottomH;
    this._effectText.anchor.set(0, 0);
    this._effectText.position.set(pad, btmY);
    this._rangeText.anchor.set(1, 0);
    this._rangeText.position.set(this._w - pad, btmY);

    // Passive bonus next to effect
    this._passiveBonusText.anchor.set(1, 0);
    this._passiveBonusText.position.set(this._w - pad, btmY);

    // Pip bar below plate
    const pipW = this._pipBar.totalWidth;
    this._pipBar.position.set(cx - pipW / 2, this._h + 2);

    // Reposition die if present
    if (this._placedDie) this._positionDie(this._placedDie);
  }

  private _toggleFilled(filled: boolean): void {
    // Glyph: hidden when die sprite is present
    if (!this._placedDie) {
      this._glyphText.visible = true;
    }
    // Range: hidden when die is placed
    const rng = formatRange(
      this._equipment.minDie, this._equipment.maxDie,
    );
    this._rangeText.visible = !filled && rng.length > 0;
    // Name always visible
    this._nameText.visible = true;
    // Effect always visible
    this._effectText.visible = true;
  }

  private _draw(): void {
    const g = this._plate;
    g.clear();

    const pw = this._w - PLATE_MARGIN * 2;
    const ph = this._h - PLATE_MARGIN * 2;
    const tc = typeColor(this._equipment.type);

    let fillColor = IRON_FILL;
    let fillAlpha = 1;
    let borderColor = IRON_BORDER;
    let borderWidth = 1;

    switch (this._state) {
      case 'empty':
        borderColor = tc;
        break;
      case 'valid-target':
        borderColor = tc;
        borderWidth = 2;
        fillAlpha = 0.9;
        break;
      case 'dimmed':
        this.alpha = 0.35;
        fillColor = CHARCOAL;
        break;
      case 'filled':
        borderColor = tc;
        borderWidth = 2;
        fillColor = 0x2A2A2A;
        break;
      case 'locked':
        borderColor = 0x444444;
        fillColor = 0x1A1A1A;
        fillAlpha = 0.6;
        break;
    }

    if (this._state !== 'dimmed') this.alpha = 1;

    g.rect(PLATE_MARGIN, PLATE_MARGIN, pw, ph);
    g.fill({ color: fillColor, alpha: fillAlpha });
    g.rect(PLATE_MARGIN, PLATE_MARGIN, pw, ph);
    g.stroke({ color: borderColor, width: borderWidth });

    this.hitArea = {
      contains: (x: number, y: number) =>
        x >= 0 && x <= this._w && y >= 0 && y <= this._h,
    };
  }
}
