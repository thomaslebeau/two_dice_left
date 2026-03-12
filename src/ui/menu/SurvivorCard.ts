/**
 * SurvivorCard — full-screen carousel card for survivor selection.
 * Vertical layout: portrait area, name, passive, equipment icons, HP badge.
 * Locked state: greyed out with 48px padlock.
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

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------

const EQUIP_CARD_H = 36;
const EQUIP_GAP = 6;
const HP_BADGE_SIZE = 44;
const PORTRAIT_H = 220;
const PAD = 16;
const EQUIP_BG = 0x2A2A2A;
const TYPE_STRIPE_W = 3;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function typeGlyph(t: EquipmentType): string {
  return t === 'weapon' ? '\u2694' : t === 'shield' ? '\u{1F6E1}' : '\u2695';
}

function typeColor(t: EquipmentType): number {
  return t === 'weapon' ? RUST : t === 'shield' ? MOSS : BONE;
}

// ---------------------------------------------------------------------------
// SurvivorCard
// ---------------------------------------------------------------------------

export class SurvivorCard extends Container {
  private _bg = new Graphics();
  private _selectionBorder = new Graphics();
  private _lockOverlay = new Container();
  private _survivor: Survivor;
  private _isLocked: boolean;
  private _selected = false;
  private _cardWidth = 330;
  private _cardHeight = 500;

  // Text elements stored for layout updates
  private _portraitLabel: Text;
  private _nameText: Text;
  private _passiveNameText: Text | null = null;
  private _passiveDescText: Text | null = null;
  private _equipContainer = new Container();
  private _hpBadge: Container;

  constructor(survivor: Survivor, isLocked: boolean) {
    super();
    this._survivor = survivor;
    this._isLocked = isLocked;

    this.addChild(this._selectionBorder);
    this.addChild(this._bg);

    // Portrait placeholder
    this._portraitLabel = new Text({
      text: survivor.name,
      style: {
        fontFamily: FONTS.HEADING, fontSize: 20,
        fontWeight: 'bold', fill: BONE, letterSpacing: 2,
      },
    });
    this._portraitLabel.anchor.set(0.5);
    this.addChild(this._portraitLabel);

    // Name
    this._nameText = new Text({
      text: survivor.name,
      style: {
        fontFamily: FONTS.HEADING, fontSize: 28,
        fontWeight: 'bold', fill: BONE, letterSpacing: 3,
      },
    });
    this._nameText.anchor.set(0.5, 0);
    this.addChild(this._nameText);

    // Passive info (if not locked)
    if (!isLocked && survivor.passive) {
      const info = PASSIVE_INFO[survivor.passive];
      this._passiveNameText = new Text({
        text: info.name,
        style: {
          fontFamily: FONTS.HEADING, fontSize: 18,
          fontWeight: 'bold', fill: RUST, letterSpacing: 1,
        },
      });
      this._passiveNameText.anchor.set(0.5, 0);
      this.addChild(this._passiveNameText);

      this._passiveDescText = new Text({
        text: info.description,
        style: {
          fontFamily: FONTS.BODY, fontSize: 16,
          fill: BONE, wordWrap: true, wordWrapWidth: 280,
          lineHeight: 22,
        },
      });
      this._passiveDescText.anchor.set(0.5, 0);
      this.addChild(this._passiveDescText);
    }

    // Equipment mini-cards
    if (!isLocked) {
      this._buildEquipCards(survivor.equipment, 280);
    }
    this.addChild(this._equipContainer);

    // HP badge
    this._hpBadge = this._buildHpBadge();
    this.addChild(this._hpBadge);

    // Lock overlay
    if (isLocked) {
      const lock = new Text({
        text: '\u{1F512}',
        style: { fontSize: 48, fill: BONE },
      });
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

  setSize(width: number, height: number): void {
    this._cardWidth = width;
    this._cardHeight = height;
    this._layout();
  }

  setSelected(selected: boolean): void {
    this._selected = selected;
    this._drawSelectionBorder();
  }

  // kept for backward compat with scene
  setWidth(width: number): void {
    this.setSize(width, this._cardHeight);
  }

  // -----------------------------------------------------------------------
  // HP badge
  // -----------------------------------------------------------------------

  private _buildHpBadge(): Container {
    const badge = new Container();
    const r = HP_BADGE_SIZE / 2;
    const bg = new Graphics();
    bg.circle(r, r, r);
    bg.fill({ color: MOSS, alpha: 0.9 });
    bg.circle(r, r, r);
    bg.stroke({ color: 0x444444, width: 1 });
    badge.addChild(bg);

    const hp = new Text({
      text: `${this._survivor.hp}`,
      style: {
        fontFamily: FONTS.HEADING, fontSize: 18,
        fontWeight: 'bold', fill: BONE,
      },
    });
    hp.anchor.set(0.5);
    hp.position.set(r, r);
    badge.addChild(hp);
    return badge;
  }

  // -----------------------------------------------------------------------
  // Equipment icons
  // -----------------------------------------------------------------------

  /** Build horizontal mini-cards stacked vertically. */
  private _buildEquipCards(
    equipment: readonly Equipment[], cardW: number,
  ): void {
    for (let i = 0; i < equipment.length; i++) {
      const eq = equipment[i];
      const row = new Container();
      const tc = typeColor(eq.type);

      // Background
      const bg = new Graphics();
      bg.roundRect(0, 0, cardW, EQUIP_CARD_H, 4);
      bg.fill({ color: EQUIP_BG });
      row.addChild(bg);

      // Left color stripe
      const stripe = new Graphics();
      stripe.rect(0, 0, TYPE_STRIPE_W, EQUIP_CARD_H);
      stripe.fill(tc);
      row.addChild(stripe);

      // Type glyph
      const glyph = new Text({
        text: typeGlyph(eq.type),
        style: { fontSize: 18, fill: tc },
      });
      glyph.anchor.set(0, 0.5);
      glyph.position.set(TYPE_STRIPE_W + 8, EQUIP_CARD_H / 2);
      row.addChild(glyph);

      // Name
      const name = new Text({
        text: eq.name,
        style: {
          fontFamily: FONTS.HEADING, fontSize: 14,
          fill: BONE,
        },
      });
      name.anchor.set(0, 0.5);
      name.position.set(TYPE_STRIPE_W + 30, EQUIP_CARD_H / 2);
      row.addChild(name);

      // Effect (description) — centered area
      const effect = new Text({
        text: eq.description,
        style: {
          fontFamily: FONTS.BODY, fontSize: 14,
          fill: BONE,
        },
      });
      effect.anchor.set(1, 0.5);
      effect.alpha = 0.7;
      effect.position.set(cardW - 40, EQUIP_CARD_H / 2);
      row.addChild(effect);

      // Range — right aligned
      const range = new Text({
        text: `${eq.minDie}-${eq.maxDie}`,
        style: {
          fontFamily: FONTS.BODY, fontSize: 14,
          fill: BONE,
        },
      });
      range.anchor.set(1, 0.5);
      range.alpha = 0.5;
      range.position.set(cardW - 8, EQUIP_CARD_H / 2);
      row.addChild(range);

      row.position.set(0, i * (EQUIP_CARD_H + EQUIP_GAP));
      this._equipContainer.addChild(row);
    }
  }

  // -----------------------------------------------------------------------
  // Layout
  // -----------------------------------------------------------------------

  private _layout(): void {
    const w = this._cardWidth;
    const h = this._cardHeight;
    const cx = w / 2;

    // Background
    this._bg.clear();
    this._bg.roundRect(0, 0, w, h, 8);
    this._bg.fill({ color: CHARCOAL });
    this._bg.roundRect(0, 0, w, h, 8);
    this._bg.stroke({ color: BLOOD, width: 3 });

    // Portrait area — top portion
    this._bg.rect(PAD, PAD, w - PAD * 2, PORTRAIT_H);
    this._bg.fill({ color: 0x111111, alpha: 0.5 });

    let y = PAD + PORTRAIT_H / 2;
    this._portraitLabel.position.set(cx, y);

    // HP badge — top-right of portrait
    this._hpBadge.position.set(
      w - PAD - HP_BADGE_SIZE - 4,
      PAD + 4,
    );

    y = PAD + PORTRAIT_H + 16;

    // Name
    this._nameText.position.set(cx, y);
    y += 36;

    // Passive
    if (this._passiveNameText) {
      this._passiveNameText.position.set(cx, y);
      y += 24;
    }
    if (this._passiveDescText) {
      this._passiveDescText.style.wordWrapWidth = w - PAD * 4;
      this._passiveDescText.position.set(cx, y);
      y += Math.min(this._passiveDescText.height, 50) + 12;
    }

    // Equipment mini-cards — stacked vertically, centered
    const eqCount = this._equipContainer.children.length;
    if (eqCount > 0) {
      const cardW = w - PAD * 4;
      // Rebuild cards at correct width if changed
      if (!this._isLocked) {
        this._equipContainer.removeChildren();
        this._buildEquipCards(this._survivor.equipment, cardW);
      }
      this._equipContainer.position.set(cx - cardW / 2, y);
    }

    // Lock overlay
    if (this._isLocked) {
      this._lockOverlay.position.set(cx, h / 2);
    }

    this._drawSelectionBorder();
  }

  private _drawSelectionBorder(): void {
    this._selectionBorder.clear();
    if (!this._selected) return;
    const pad = 3;
    this._selectionBorder.roundRect(
      -pad, -pad,
      this._cardWidth + pad * 2,
      this._cardHeight + pad * 2,
      10,
    );
    this._selectionBorder.stroke({ color: RUST, width: 3 });
  }
}

export const SURVIVOR_CARD_HEIGHT = 500; // default, overridden by setSize
