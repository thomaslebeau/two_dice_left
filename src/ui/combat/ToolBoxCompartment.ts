/**
 * Single toolbox compartment — metal plate on wood for equipment,
 * bare wood for empty slots. Implements SlotLike for DiceAllocator
 * compatibility. Supports die reparenting (DiceSprite centered on plate).
 */

import { Container, Graphics, Text } from 'pixi.js';
import type { Equipment, EquipmentEffect, EffectContext } from '../../engine/types';
import { canUseDie } from '../../engine/dice';
import { FONTS, TEXT_COLORS } from '../../theme';
import { STRINGS } from '../../data/strings';
import type { SlotLike, SlotState } from './SlotLike';
import type { DiceSprite } from './DiceSprite';

// Diegetic palette (same as LootPlank)
const IRON_FILL = 0x3A3A3A;
const IRON_BORDER = 0x555555;
const RIVET_FILL = 0x888888;
const RIVET_SHADOW = 0x555555;
const BONE = 0xD9CFBA;
const RUST = 0x8B3A1A;
const MOSS = 0x2D4A2E;
const CHARCOAL = 0x1A1A1A;

const GOLD = 0xF0C040;
const PLATE_MARGIN = 2;
const RIVET_R = 2;
const RIVET_INNER = 1.5;

function typeGlyph(t: Equipment['type']): string {
  return t === 'weapon' ? '\u2694' : t === 'shield' ? '\uD83D\uDEE1' : '\u2695';
}

/** Brand colors for borders/accents (NOT text on dark bg). */
function typeColor(t: Equipment['type']): number {
  return t === 'weapon' ? RUST : t === 'shield' ? MOSS : BONE;
}

/** High-contrast colors for text on dark backgrounds. */
function typeTextColor(t: Equipment['type']): number {
  return t === 'weapon' ? TEXT_COLORS.PLAYER_ACTION
    : t === 'shield' ? TEXT_COLORS.BLOCK
    : TEXT_COLORS.NEUTRAL;
}

function fmtEffect(e: EquipmentEffect): string {
  if (e.damage > 0) return `${e.damage} ${STRINGS.DAMAGE}`;
  if (e.shield > 0) return `${e.shield} ${STRINGS.BLOCK}`;
  if (e.heal > 0) return `${e.heal} ${STRINGS.HEAL}`;
  if (e.poison > 0) return `${e.poison} ${STRINGS.POISON}`;
  return '0';
}

export class ToolBoxCompartment extends Container implements SlotLike {
  private _equipment: Equipment;
  private _equipmentIndex: number;
  private _state: SlotState = 'empty';
  private _placedDieValue: number | null = null;
  private _placedDie: DiceSprite | null = null;

  private _plate = new Graphics();
  private _glyphText: Text;
  private _rangeText: Text;
  private _valueText: Text;
  private _effectText: Text;
  private _passiveBonusText: Text;
  private _borderGlow = new Graphics();

  private _w = 70;
  private _h = 73;

  constructor(equipment: Equipment, equipmentIndex: number) {
    super();
    this._equipment = equipment;
    this._equipmentIndex = equipmentIndex;

    this.addChild(this._plate);
    this._borderGlow.visible = false;
    this.addChild(this._borderGlow);

    const tc = typeColor(equipment.type);

    this._glyphText = this._mkText(typeGlyph(equipment.type), 16, tc, true);
    this._rangeText = this._mkText(
      `${equipment.minDie}-${equipment.maxDie}`, 14, TEXT_COLORS.MUTED,
    );
    this._valueText = this._mkText('', 16, BONE, true);
    this._valueText.visible = false;
    this._effectText = this._mkText('', 14, typeTextColor(equipment.type));
    this._effectText.visible = false;
    this._passiveBonusText = this._mkText('', 14, BONE, true);
    this._passiveBonusText.visible = false;

    this._rangeText.visible = false; // shown only on valid-target (drag)

    this.addChild(
      this._glyphText, this._rangeText,
      this._valueText, this._effectText, this._passiveBonusText,
    );

    this.eventMode = 'static';
    this.cursor = 'pointer';
    this._draw();
  }

  get equipment(): Equipment { return this._equipment; }
  get equipmentIndex(): number { return this._equipmentIndex; }
  get slotState(): SlotState { return this._state; }
  get placedDieValue(): number | null { return this._placedDieValue; }

  /** Resize compartment dimensions (called by ToolBox). */
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
    // Show range only when a die is being dragged over (valid-target)
    if (!this._placedDie && state !== 'filled') {
      this._rangeText.visible = state === 'valid-target';
    }
    this._draw();
  }

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

  lock(): void {
    this._state = 'locked';
    this.cursor = 'default';
    this._draw();
  }

  showPreview(dieValue: number, context?: EffectContext): void {
    if (!this.isCompatible(dieValue)) return;
    this._effectText.text = `\u2192${fmtEffect(this._equipment.effect(dieValue, context))}`;
    this._effectText.visible = true;
  }

  clearPreview(): void {
    if (this._state !== 'filled') this._effectText.visible = false;
  }

  /** Recalculate effect text with full allocation context (synergies). */
  updateEffectWithContext(context?: EffectContext): void {
    if (this._placedDieValue === null) return;
    const base = this._equipment.effect(this._placedDieValue);
    const full = this._equipment.effect(this._placedDieValue, context);
    const bonusDmg = full.damage - base.damage;
    const bonusShd = full.shield - base.shield;
    const bonusHeal = full.heal - base.heal;
    const bonus = bonusDmg + bonusShd + bonusHeal;
    if (bonus > 0) {
      this._effectText.text = `\u2192${fmtEffect(full)}`;
      this._passiveBonusText.text = `+${bonus}`;
      this._passiveBonusText.style.fill = GOLD;
      this._passiveBonusText.visible = true;
    } else {
      this._effectText.text = `\u2192${fmtEffect(full)}`;
      this._passiveBonusText.visible = false;
    }
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

  /** Receive a DiceSprite — reparent it into this compartment. */
  receiveDie(die: DiceSprite): void {
    this._placedDie = die;
    this.addChild(die);
    // Center die on the plate
    const pw = this._w - PLATE_MARGIN * 2;
    const ph = this._h - PLATE_MARGIN * 2;
    die.position.set(
      PLATE_MARGIN + (pw - 36) / 2,
      PLATE_MARGIN + (ph - 36) / 2 - 4,
    );
    die.visible = true;
    die.setState('placed');
    // Hide text layers behind die
    this._glyphText.visible = false;
    this._rangeText.visible = false;
  }

  /** Release the reparented DiceSprite back. Does NOT call setState — caller owns die lifecycle. */
  releaseDie(): DiceSprite | null {
    const die = this._placedDie;
    if (!die) return null;
    this._placedDie = null;
    if (!die.destroyed) this.removeChild(die);
    this._glyphText.visible = true;
    this._rangeText.visible = true;
    return die;
  }

  // -----------------------------------------------------------------------
  // Private
  // -----------------------------------------------------------------------

  private _mkText(
    txt: string, size: number, color: number, bold = false,
  ): Text {
    const t = new Text({
      text: txt,
      style: {
        fontFamily: FONTS.HEADING, fontSize: size,
        fontWeight: bold ? 'bold' : 'normal', fill: color,
      },
    });
    t.anchor.set(0.5, 0);
    return t;
  }

  private _layoutTexts(): void {
    const cx = this._w / 2;
    this._glyphText.position.set(cx, PLATE_MARGIN + 6);
    this._rangeText.position.set(cx, this._h - PLATE_MARGIN - 14);
    this._valueText.position.set(cx, PLATE_MARGIN + 8);
    this._effectText.position.set(cx, this._h - PLATE_MARGIN - 16);
    this._passiveBonusText.position.set(cx, this._h - PLATE_MARGIN - 4);
  }

  private _toggleFilled(filled: boolean): void {
    if (this._placedDie) {
      // Die sprite is visible, hide all text
      this._glyphText.visible = false;
      this._rangeText.visible = false;
    } else {
      this._glyphText.visible = !filled;
      this._rangeText.visible = !filled;
    }
    this._valueText.visible = filled && !this._placedDie;
    this._effectText.visible = filled;
  }

  private _draw(): void {
    const g = this._plate;
    g.clear();

    const pw = this._w - PLATE_MARGIN * 2;
    const ph = this._h - PLATE_MARGIN * 2;
    const tc = typeColor(this._equipment.type);

    // Metal plate fill
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

    // Plate
    g.rect(PLATE_MARGIN, PLATE_MARGIN, pw, ph);
    g.fill({ color: fillColor, alpha: fillAlpha });
    g.rect(PLATE_MARGIN, PLATE_MARGIN, pw, ph);
    g.stroke({ color: borderColor, width: borderWidth });

    // Corner rivets
    const rivets = [
      [PLATE_MARGIN + 4, PLATE_MARGIN + 4],
      [this._w - PLATE_MARGIN - 4, PLATE_MARGIN + 4],
      [PLATE_MARGIN + 4, this._h - PLATE_MARGIN - 4],
      [this._w - PLATE_MARGIN - 4, this._h - PLATE_MARGIN - 4],
    ];
    for (const [rx, ry] of rivets) {
      g.circle(rx, ry, RIVET_R);
      g.fill(RIVET_SHADOW);
      g.circle(rx - 0.3, ry - 0.3, RIVET_INNER);
      g.fill(RIVET_FILL);
    }

    // Hit area
    this.hitArea = {
      contains: (x: number, y: number) =>
        x >= 0 && x <= this._w && y >= 0 && y <= this._h,
    };
  }
}
