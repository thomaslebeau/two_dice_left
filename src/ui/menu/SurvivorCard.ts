/**
 * SurvivorCard — horizontal card for survivor selection screen.
 * Left: portrait frame (charcoal + blood red border).
 * Right: name, passive, equipment loadout icons.
 * Locked state: greyed out with padlock.
 */

import { Container, Graphics, Text } from 'pixi.js';
import type { Survivor, Equipment, EquipmentType } from '../../engine/types';
import { PASSIVE_INFO } from '../../data/passives';
import { FONTS } from '../../theme';

// ---------------------------------------------------------------------------
// V6 palette
// ---------------------------------------------------------------------------

const BONE = 0xD9CFBA;
const RUST = 0x8B3A1A;
const BLOOD = 0x6B1C1C;
const CHARCOAL = 0x1A1A1A;
const MOSS = 0x2D4A2E;
const STEEL_BG = 0x333333;
const STEEL_BORDER = 0x666666;

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------

const CARD_HEIGHT = 140;
const DIAG_TOP_RATIO = 0.55;   // diagonal starts at 55% width (top)
const DIAG_BOT_RATIO = 0.35;   // diagonal ends at 35% width (bottom)
const BORDER_W = 3;
const EQUIP_ICON_SIZE = 36;
const EQUIP_GAP = 6;
const HP_BADGE_SIZE = 28;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function typeGlyph(t: EquipmentType): string {
  return t === 'weapon' ? '\u2694' : t === 'shield' ? '\u{1F6E1}' : '\u2695';
}

function mkText(
  txt: string, size: number, color: number, bold = false,
  font: string = FONTS.HEADING,
): Text {
  return new Text({
    text: txt,
    style: {
      fontFamily: font,
      fontSize: size,
      fontWeight: bold ? 'bold' : 'normal',
      fill: color,
    },
  });
}

function mkWrapText(
  txt: string, size: number, color: number,
  wrapWidth: number,
): Text {
  return new Text({
    text: txt,
    style: {
      fontFamily: FONTS.BODY,
      fontSize: size,
      fill: color,
      wordWrap: true,
      wordWrapWidth: wrapWidth,
      lineHeight: size + 4,
    },
  });
}

// ---------------------------------------------------------------------------
// SurvivorCard
// ---------------------------------------------------------------------------

export class SurvivorCard extends Container {
  private _bg = new Graphics();
  private _selectionBorder = new Graphics();
  private _portraitContainer = new Container();
  private _infoContainer = new Container();
  private _lockOverlay = new Container();
  private _hpBadge: Container;
  private _survivor: Survivor;
  private _isLocked: boolean;
  private _selected = false;
  private _cardWidth = 350;

  constructor(survivor: Survivor, isLocked: boolean) {
    super();
    this._survivor = survivor;
    this._isLocked = isLocked;

    this.addChild(this._selectionBorder);
    this.addChild(this._bg);
    this.addChild(this._portraitContainer);
    this.addChild(this._infoContainer);

    // Portrait placeholder text
    const portraitLabel = mkText(survivor.name, 12, BONE, true);
    portraitLabel.anchor.set(0.5);
    this._portraitContainer.addChild(portraitLabel);

    // HP badge (built once, repositioned in _layout)
    this._hpBadge = this._buildHpBadge();
    this._portraitContainer.addChild(this._hpBadge);

    // Lock overlay
    if (isLocked) {
      const lock = mkText('\u{1F512}', 28, BONE, true);
      lock.anchor.set(0.5);
      this._lockOverlay.addChild(lock);
      this.addChild(this._lockOverlay);
      this.alpha = 0.4;
    }

    this.eventMode = isLocked ? 'none' : 'static';
    this.cursor = isLocked ? 'default' : 'pointer';
  }

  get survivor(): Survivor { return this._survivor; }
  get isLocked(): boolean { return this._isLocked; }

  setWidth(width: number): void {
    this._cardWidth = width;
    this._layout();
  }

  setSelected(selected: boolean): void {
    this._selected = selected;
    this._drawSelectionBorder();
  }

  // -----------------------------------------------------------------------
  // HP badge (built once)
  // -----------------------------------------------------------------------

  private _buildHpBadge(): Container {
    const badge = new Container();
    const bg = new Graphics();
    const r = HP_BADGE_SIZE / 2;
    bg.circle(r, r, r);
    bg.fill({ color: MOSS, alpha: 0.9 });
    bg.circle(r, r, r);
    bg.stroke({ color: 0x444444, width: 1 });
    badge.addChild(bg);

    const hp = mkText(`${this._survivor.hp}`, 12, BONE, true);
    hp.anchor.set(0.5);
    hp.position.set(r, r);
    badge.addChild(hp);
    return badge;
  }

  // -----------------------------------------------------------------------
  // Equipment icon block
  // -----------------------------------------------------------------------

  private _buildEquipBlock(eq: Equipment): Container {
    const block = new Container();
    const bg = new Graphics();
    bg.roundRect(0, 0, EQUIP_ICON_SIZE, EQUIP_ICON_SIZE, 3);
    bg.fill({ color: STEEL_BG });
    bg.roundRect(0, 0, EQUIP_ICON_SIZE, EQUIP_ICON_SIZE, 3);
    bg.stroke({ color: STEEL_BORDER, width: 1 });
    block.addChild(bg);

    const icon = mkText(typeGlyph(eq.type), 14, BONE, true);
    icon.anchor.set(0.5);
    icon.position.set(EQUIP_ICON_SIZE / 2, EQUIP_ICON_SIZE / 2 - 2);
    block.addChild(icon);

    const range = mkText(`[${eq.minDie}-${eq.maxDie}]`, 9, BONE);
    range.anchor.set(0.5, 0);
    range.position.set(EQUIP_ICON_SIZE / 2, EQUIP_ICON_SIZE + 2);
    block.addChild(range);
    return block;
  }

  // -----------------------------------------------------------------------
  // Layout
  // -----------------------------------------------------------------------

  private _layout(): void {
    const w = this._cardWidth;
    const h = CARD_HEIGHT;
    const diagTop = Math.floor(w * DIAG_TOP_RATIO);
    const diagBot = Math.floor(w * DIAG_BOT_RATIO);
    const pad = 10;

    // Draw background polygons
    this._bg.clear();

    // Portrait zone (left) — wider at top, narrower at bottom
    this._bg.poly([0, 0, diagTop, 0, diagBot, h, 0, h]);
    this._bg.fill({ color: CHARCOAL });
    this._bg.poly([0, 0, diagTop, 0, diagBot, h, 0, h]);
    this._bg.stroke({ color: BLOOD, width: BORDER_W });

    // Info zone (right) — fills remaining space
    this._bg.poly([diagTop, 0, w, 0, w, h, diagBot, h]);
    this._bg.fill({ color: BLOOD });

    // Diagonal stroke (subtle cut line)
    this._bg.moveTo(diagTop, 0);
    this._bg.lineTo(diagBot, h);
    this._bg.stroke({ color: BONE, width: 1, alpha: 0.3 });

    // Portrait label — centered in the portrait polygon
    const portraitCx = (diagTop + diagBot) / 2 / 2;
    const portraitLabel = this._portraitContainer.getChildAt(0) as Text;
    portraitLabel.position.set(portraitCx, h / 2);

    // HP badge — on the diagonal, ~45% width, 50% height
    const badgeMidX = w * 0.45;
    const badgeMidY = h * 0.5;
    this._hpBadge.position.set(
      badgeMidX - HP_BADGE_SIZE / 2,
      badgeMidY - HP_BADGE_SIZE / 2,
    );

    // Info panel — positioned right of the diagonal top edge
    const infoX = diagTop + pad;
    const infoW = w - infoX - pad;
    this._rebuildInfo(infoW);
    this._infoContainer.position.set(infoX, pad);

    // Lock overlay position
    if (this._isLocked) {
      this._lockOverlay.position.set(w / 2, h / 2);
    }

    this._drawSelectionBorder();
  }

  private _rebuildInfo(wrapWidth: number): void {
    // Destroy all previous info children
    while (this._infoContainer.children.length > 0) {
      const child = this._infoContainer.getChildAt(0);
      this._infoContainer.removeChild(child);
      child.destroy();
    }

    // Survivor name
    const name = mkText(this._survivor.name, 18, BONE, true);
    this._infoContainer.addChild(name);

    if (this._isLocked) {
      const mystery = mkText('???', 14, BONE);
      mystery.position.set(0, 26);
      this._infoContainer.addChild(mystery);
      return;
    }

    let y = 24;
    const passiveId = this._survivor.passive;
    if (passiveId) {
      const info = PASSIVE_INFO[passiveId];
      const pName = mkText(info.name, 13, RUST, true);
      pName.position.set(0, y);
      this._infoContainer.addChild(pName);
      y += 17;

      const desc = mkWrapText(info.description, 11, BONE, wrapWidth);
      desc.position.set(0, y);
      this._infoContainer.addChild(desc);
      y += Math.min(desc.height, 36) + 6;
    }

    // Equipment row
    const equipment = this._survivor.equipment;
    for (let i = 0; i < equipment.length; i++) {
      const block = this._buildEquipBlock(equipment[i]);
      block.position.set(i * (EQUIP_ICON_SIZE + EQUIP_GAP), y);
      this._infoContainer.addChild(block);
    }
  }

  private _drawSelectionBorder(): void {
    this._selectionBorder.clear();
    if (!this._selected) return;
    const pad = 2;
    this._selectionBorder.rect(
      -pad, -pad,
      this._cardWidth + pad * 2,
      CARD_HEIGHT + pad * 2,
    );
    this._selectionBorder.stroke({ color: RUST, width: 2 });
  }
}

export const SURVIVOR_CARD_HEIGHT = CARD_HEIGHT;
