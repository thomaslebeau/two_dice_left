/**
 * V6 loot card — displays an equipment option during events.
 *
 * Shows: type icon, name, die range (visual dice faces), effect text,
 * and a "synergy" line showing how it extends the loadout.
 * Selected state: highlighted border + scale bump.
 * Minimum 44px touch target enforced via hitArea.
 */

import { Container, Graphics, Text } from 'pixi.js';
import type { Equipment } from '../../engine/types';
import { FONTS } from '../../theme';

// ---------------------------------------------------------------------------
// V6 palette
// ---------------------------------------------------------------------------

const BONE = 0xD9CFBA;
const RUST = 0x8B3A1A;
const MOSS = 0x2D4A2E;
const CHARCOAL = 0x1A1A1A;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const CARD_W = 160;
const CORNER_R = 8;
const MIN_TOUCH = 44;
const DIE_FACE_SIZE = 20;
const DIE_FACE_GAP = 3;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
// LootCard
// ---------------------------------------------------------------------------

export class LootCard extends Container {
  private _bg = new Graphics();
  private _equipment: Equipment;
  private _selected = false;
  private _cardH: number;

  /** Fired when the user taps this card. */
  onSelect: (() => void) | null = null;

  constructor(equipment: Equipment, currentSlotCount: number) {
    super();
    this._equipment = equipment;

    this.addChild(this._bg);

    const tColor = typeColor(equipment.type);
    let y = 10;

    // Type icon + name
    const nameText = new Text({
      text: `${typeLabel(equipment.type)} ${equipment.name}`,
      style: {
        fontFamily: FONTS.HEADING,
        fontSize: 16,
        fontWeight: 'bold',
        fill: tColor,
        letterSpacing: 1,
        wordWrap: true,
        wordWrapWidth: CARD_W - 20,
      },
    });
    nameText.position.set(10, y);
    this.addChild(nameText);
    y += nameText.height + 6;

    // Die range — visual dice faces [1-6], highlight accepted
    const diceRow = this._buildDiceRange(equipment.minDie, equipment.maxDie);
    diceRow.position.set(10, y);
    this.addChild(diceRow);
    y += DIE_FACE_SIZE + 6;

    // Effect formula (from data, no effect() calls)
    const effectText = new Text({
      text: `-> ${equipment.description}`,
      style: {
        fontFamily: FONTS.BODY,
        fontSize: 12,
        fill: tColor,
        wordWrap: true,
        wordWrapWidth: CARD_W - 20,
      },
    });
    effectText.position.set(10, y);
    this.addChild(effectText);
    y += effectText.height + 6;

    // Synergy line: slot count context — flows right after effect
    const slotLabel = currentSlotCount === 2
      ? '3e emplacement'
      : `${currentSlotCount + 1}e emplacement`;
    const synergyText = new Text({
      text: `\u2192 ${slotLabel}`,
      style: {
        fontFamily: FONTS.BODY,
        fontSize: 12,
        fontStyle: 'italic',
        fill: tColor,
      },
    });
    synergyText.position.set(10, y);
    this.addChild(synergyText);
    y += synergyText.height + 10;

    // Auto height from content
    this._cardH = y;

    // Interaction
    this.eventMode = 'static';
    this.cursor = 'pointer';
    this.hitArea = {
      contains: (hx: number, hy: number) =>
        hx >= 0 && hx <= Math.max(CARD_W, MIN_TOUCH)
        && hy >= 0 && hy <= Math.max(this._cardH, MIN_TOUCH),
    };
    this.on('pointerdown', this._handlePress, this);
    this.on('pointerover', this._handleOver, this);
    this.on('pointerout', this._handleOut, this);

    this._draw();
  }

  get equipment(): Equipment { return this._equipment; }
  get cardHeight(): number { return this._cardH; }

  /** Toggle selected state with visual feedback. */
  setSelected(selected: boolean): void {
    this._selected = selected;
    this.scale.set(selected ? 1.04 : 1);
    this._draw();
  }

  // --- Drawing ---

  private _draw(): void {
    this._bg.clear();

    // Fill
    this._bg.roundRect(0, 0, CARD_W, this._cardH, CORNER_R);
    this._bg.fill({ color: CHARCOAL, alpha: 0.9 });

    // Border
    const borderColor = this._selected
      ? typeColor(this._equipment.type)
      : 0x555555;
    const borderWidth = this._selected ? 3 : 1;
    this._bg.roundRect(0, 0, CARD_W, this._cardH, CORNER_R);
    this._bg.stroke({ color: borderColor, width: borderWidth });
  }

  /** Build a row of 6 small die faces, highlighting the accepted range. */
  private _buildDiceRange(minDie: number, maxDie: number): Container {
    const row = new Container();

    for (let face = 1; face <= 6; face++) {
      const inRange = face >= minDie && face <= maxDie;
      const g = new Graphics();

      // Die face square
      g.roundRect(0, 0, DIE_FACE_SIZE, DIE_FACE_SIZE, 3);
      g.fill({ color: inRange ? BONE : 0x333333 });
      g.roundRect(0, 0, DIE_FACE_SIZE, DIE_FACE_SIZE, 3);
      g.stroke({ color: inRange ? RUST : 0x444444, width: 1 });

      // Number
      const num = new Text({
        text: `${face}`,
        style: {
          fontFamily: FONTS.HEADING,
          fontSize: 11,
          fontWeight: 'bold',
          fill: inRange ? CHARCOAL : 0x666666,
        },
      });
      num.anchor.set(0.5);
      num.position.set(DIE_FACE_SIZE / 2, DIE_FACE_SIZE / 2);

      const faceContainer = new Container();
      faceContainer.addChild(g, num);
      faceContainer.position.set(
        (face - 1) * (DIE_FACE_SIZE + DIE_FACE_GAP), 0,
      );
      row.addChild(faceContainer);
    }

    return row;
  }

  // --- Interaction ---

  private _handlePress(): void {
    this.onSelect?.();
  }

  private _handleOver(): void {
    if (!this._selected) this.alpha = 0.85;
  }

  private _handleOut(): void {
    this.alpha = 1;
  }
}
