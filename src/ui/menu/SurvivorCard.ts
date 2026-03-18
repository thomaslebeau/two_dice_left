/**
 * SurvivorCard — full-bleed portrait with semi-transparent info overlay.
 * Layer stack: blood red bg → portrait sprite (full card) → info overlay (bottom).
 * HP badge at overlay junction. Locked: greyscale + padlock.
 */

import {
  Assets, ColorMatrixFilter, Container, Graphics, Sprite, Text,
} from 'pixi.js';
import type { Survivor, Equipment, EquipmentType, PassiveId } from '../../engine/types';
import { PASSIVE_INFO } from '../../data/passives';
import { FONTS } from '../../theme';

// ---------------------------------------------------------------------------
// Palette
// ---------------------------------------------------------------------------

const BONE = 0xD9CFBA;
const RUST = 0x8B3A1A;
const BLOOD = 0x6B1C1C;
const CHARCOAL = 0x1A1A1A;
const MOSS = 0x2D4A2E;
const INFO_OVERLAY = 0x060606;
const INFO_OVERLAY_ALPHA = 0.4;

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------

const HP_BADGE_SIZE = 44;
const HP_BADGE_R = HP_BADGE_SIZE / 2;
const INFO_PAD_TOP = 20;
const INFO_PAD_X = 16;
const INFO_PAD_BOTTOM = 16;
const EQUIP_CARD_H = 36;
const EQUIP_GAP = 6;
const EQUIP_BG = 0x2A2A2A;
const EQUIP_STRIPE_W = 3;
const BORDER_W = 2;

/** Map survivor id → portrait asset path. Only illustrated survivors. */
const PORTRAIT_ASSETS: Record<number, string> = {
  1: '/assets/survivors/rescape.png',
};

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
  private _survivor: Survivor;
  private _isLocked: boolean;
  private _selected = false;
  private _cardWidth = 330;
  private _cardHeight = 440;

  // Layer 1: background
  private _bg = new Graphics();
  // Layer 2: portrait
  private _portraitLabel: Text;
  private _portrait: Sprite | null = null;
  // Card-level mask (clips all layers)
  private _cardMask = new Graphics();
  // Layer 3: info overlay
  private _infoOverlay = new Container();
  private _infoBg = new Graphics();
  private _nameText: Text;
  private _passiveNameText: Text | null = null;
  private _passiveDescText: Text | null = null;
  private _equipContainer = new Container();
  // Layer 4: HP badge + borders
  private _cardBorder = new Graphics();
  private _selectionBorder = new Graphics();
  private _hpBadge: Container;
  private _lockOverlay = new Container();

  constructor(survivor: Survivor, isLocked: boolean) {
    super();
    this._survivor = survivor;
    this._isLocked = isLocked;

    // Layer 1: blood red bg
    this.addChild(this._bg);

    // Layer 2: portrait placeholder (sprite added async)
    this._portraitLabel = new Text({
      text: survivor.name,
      style: {
        fontFamily: FONTS.HEADING, fontSize: 20,
        fontWeight: 'bold', fill: BONE, letterSpacing: 2,
      },
    });
    this._portraitLabel.anchor.set(0.5);
    this.addChild(this._portraitLabel);

    // Card mask (clips everything to card rect)
    this.addChild(this._cardMask);
    this.mask = this._cardMask;

    // Layer 3: info overlay
    this._infoOverlay.addChild(this._infoBg);
    this._nameText = new Text({
      text: survivor.name,
      style: {
        fontFamily: FONTS.HEADING, fontSize: 28,
        fontWeight: 'bold', fill: BONE, letterSpacing: 2,
      },
    });
    this._nameText.anchor.set(0.5, 0);
    this._infoOverlay.addChild(this._nameText);
    if (!isLocked && survivor.passive) {
      this._buildPassiveTexts(survivor.passive);
    }
    if (!isLocked) {
      this._buildEquipCards(survivor.equipment, 280);
    }
    this._infoOverlay.addChild(this._equipContainer);
    this.addChild(this._infoOverlay);

    // Card border
    this.addChild(this._cardBorder);
    this.addChild(this._selectionBorder);

    // Layer 4: HP badge (topmost)
    this._hpBadge = this._buildHpBadge();
    this.addChild(this._hpBadge);

    // Lock overlay
    if (isLocked) {
      this._applyLockedState();
    }

    this.eventMode = isLocked ? 'none' : 'static';
    this.cursor = isLocked ? 'default' : 'pointer';

    if (!isLocked) this._loadPortrait();
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
    this._drawBorders();
  }

  setWidth(width: number): void {
    this.setSize(width, this._cardHeight);
  }

  // -----------------------------------------------------------------------
  // Passive texts
  // -----------------------------------------------------------------------

  private _buildPassiveTexts(passiveId: PassiveId): void {
    const info = PASSIVE_INFO[passiveId];
    this._passiveNameText = new Text({
      text: info.name,
      style: {
        fontFamily: FONTS.BODY, fontSize: 18,
        fontWeight: 'bold', fill: RUST, letterSpacing: 1,
      },
    });
    this._passiveNameText.anchor.set(0.5, 0);
    this._infoOverlay.addChild(this._passiveNameText);

    this._passiveDescText = new Text({
      text: info.description,
      style: {
        fontFamily: FONTS.BODY, fontSize: 16,
        fill: BONE, wordWrap: true, wordWrapWidth: 280,
        lineHeight: 22,
      },
    });
    this._passiveDescText.anchor.set(0.5, 0);
    this._passiveDescText.alpha = 0.8;
    this._infoOverlay.addChild(this._passiveDescText);
  }

  // -----------------------------------------------------------------------
  // HP badge
  // -----------------------------------------------------------------------

  private _buildHpBadge(): Container {
    const badge = new Container();
    const bg = new Graphics();
    bg.circle(HP_BADGE_R, HP_BADGE_R, HP_BADGE_R);
    bg.fill({ color: CHARCOAL });
    bg.circle(HP_BADGE_R, HP_BADGE_R, HP_BADGE_R);
    bg.stroke({ color: MOSS, width: 3 });
    badge.addChild(bg);

    const hp = new Text({
      text: `${this._survivor.hp}`,
      style: {
        fontFamily: FONTS.HEADING, fontSize: 20,
        fontWeight: 'bold', fill: BONE,
      },
    });
    hp.anchor.set(0.5);
    hp.position.set(HP_BADGE_R, HP_BADGE_R);
    badge.addChild(hp);
    return badge;
  }

  // -----------------------------------------------------------------------
  // Equipment mini-cards
  // -----------------------------------------------------------------------

  private _buildEquipCards(
    equipment: readonly Equipment[], cardW: number,
  ): void {
    this._equipContainer.removeChildren();
    for (let i = 0; i < equipment.length; i++) {
      const eq = equipment[i];
      const row = new Container();
      const tc = typeColor(eq.type);

      const bg = new Graphics();
      bg.roundRect(0, 0, cardW, EQUIP_CARD_H, 3);
      bg.fill({ color: EQUIP_BG, alpha: 0.8 });
      row.addChild(bg);

      const stripe = new Graphics();
      stripe.rect(0, 0, EQUIP_STRIPE_W, EQUIP_CARD_H);
      stripe.fill(tc);
      row.addChild(stripe);

      const glyph = new Text({
        text: typeGlyph(eq.type),
        style: { fontSize: 20, fill: tc },
      });
      glyph.anchor.set(0, 0.5);
      glyph.position.set(12, EQUIP_CARD_H / 2);
      row.addChild(glyph);

      const name = new Text({
        text: eq.name,
        style: {
          fontFamily: FONTS.HEADING, fontSize: 15, fill: BONE,
        },
      });
      name.anchor.set(0, 0.5);
      name.position.set(36, EQUIP_CARD_H / 2);
      row.addChild(name);

      const effect = new Text({
        text: eq.description,
        style: {
          fontFamily: FONTS.BODY, fontSize: 14, fill: BONE,
        },
      });
      effect.anchor.set(1, 0.5);
      effect.alpha = 0.7;
      effect.position.set(cardW - 40, EQUIP_CARD_H / 2);
      row.addChild(effect);

      const range = new Text({
        text: `${eq.minDie}-${eq.maxDie}`,
        style: {
          fontFamily: FONTS.BODY, fontSize: 14, fill: BONE,
        },
      });
      range.anchor.set(1, 0.5);
      range.alpha = 0.5;
      range.position.set(cardW - 8, EQUIP_CARD_H / 2);
      row.addChild(range);

      row.y = i * (EQUIP_CARD_H + EQUIP_GAP);
      this._equipContainer.addChild(row);
    }
  }

  // -----------------------------------------------------------------------
  // Portrait loading
  // -----------------------------------------------------------------------

  private async _loadPortrait(): Promise<void> {
    const path = PORTRAIT_ASSETS[this._survivor.id];
    if (!path) return;
    try {
      const texture = await Assets.load(path);
      if (this.destroyed) return;
      const sprite = new Sprite(texture);
      sprite.anchor.set(0, 1); // bottom-left
      this._portrait = sprite;
      // Insert above bg, below card mask
      const maskIdx = this.getChildIndex(this._cardMask);
      this.addChildAt(sprite, maskIdx);
      this._portraitLabel.visible = false;
      this._layoutPortrait();
    } catch {
      // Keep text placeholder
    }
  }

  private _layoutPortrait(): void {
    if (!this._portrait) return;
    const h = this._cardHeight;
    const texH = this._portrait.texture.height;
    const scale = h / texH;
    this._portrait.scale.set(scale);
    this._portrait.position.set(0, h);
  }

  // -----------------------------------------------------------------------
  // Locked state
  // -----------------------------------------------------------------------

  private _applyLockedState(): void {
    // Greyscale + dim filter on the whole card
    const grey = new ColorMatrixFilter();
    grey.desaturate();
    grey.brightness(0.4, false);
    this.filters = [grey];

    // Padlock icon
    const lock = new Text({
      text: '\u{1F512}', style: { fontSize: 48, fill: BONE },
    });
    lock.anchor.set(0.5);
    this._lockOverlay.addChild(lock);
    this.addChild(this._lockOverlay);
  }

  // -----------------------------------------------------------------------
  // Layout
  // -----------------------------------------------------------------------

  private _layout(): void {
    const w = this._cardWidth;
    const h = this._cardHeight;
    const cx = w / 2;

    // Layer 1: blood red bg
    this._bg.clear();
    this._bg.rect(0, 0, w, h);
    this._bg.fill({ color: BLOOD });

    // Card mask
    this._cardMask.clear();
    this._cardMask.roundRect(0, 0, w, h, 6);
    this._cardMask.fill({ color: 0xffffff });

    // Portrait placeholder
    this._portraitLabel.position.set(cx, h / 2);

    // Portrait sprite
    this._layoutPortrait();

    // Info overlay — compute content height
    const equipW = w - INFO_PAD_X * 2;
    let y = INFO_PAD_TOP;

    this._nameText.position.set(cx, y);
    y += 36;

    if (this._passiveNameText) {
      this._passiveNameText.position.set(cx, y);
      y += 24;
    }
    if (this._passiveDescText) {
      this._passiveDescText.style.wordWrapWidth = equipW;
      this._passiveDescText.position.set(cx, y);
      y += Math.min(this._passiveDescText.height, 50) + 12;
    }

    if (!this._isLocked) {
      this._buildEquipCards(this._survivor.equipment, equipW);
    }
    this._equipContainer.position.set(INFO_PAD_X, y);

    const eqH = this._isLocked ? 0
      : this._survivor.equipment.length
        * (EQUIP_CARD_H + EQUIP_GAP) - EQUIP_GAP;
    const infoH = y + eqH + INFO_PAD_BOTTOM;

    // Semi-transparent overlay bg
    this._infoBg.clear();
    this._infoBg.rect(0, 0, w, infoH);
    this._infoBg.fill({ color: INFO_OVERLAY, alpha: INFO_OVERLAY_ALPHA });

    // Position overlay at bottom of card
    this._infoOverlay.y = h - infoH;

    // HP badge at junction
    this._hpBadge.position.set(
      w - 20 - HP_BADGE_SIZE,
      h - infoH - HP_BADGE_R,
    );

    // Lock overlay centered
    if (this._isLocked) {
      this._lockOverlay.position.set(cx, h / 2);
    }

    this._drawBorders();
  }

  private _drawBorders(): void {
    const w = this._cardWidth;
    const h = this._cardHeight;

    this._cardBorder.clear();
    this._cardBorder.roundRect(0, 0, w, h, 6);
    this._cardBorder.stroke({ color: BLOOD, width: BORDER_W });

    this._selectionBorder.clear();
    if (!this._selected) return;
    this._selectionBorder.roundRect(-1, -1, w + 2, h + 2, 7);
    this._selectionBorder.stroke({ color: RUST, width: BORDER_W });
  }
}

export const SURVIVOR_CARD_HEIGHT = 440;
