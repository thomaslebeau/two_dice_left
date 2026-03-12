/**
 * Survivor selection — horizontal carousel, one card per screen.
 * Swipe left/right to browse. Dots indicator. Full-width COMMENCER button.
 */

import { Container, Graphics, Text } from 'pixi.js';
import type { Scene } from '../../engine/SceneManager';
import type { Survivor } from '../../engine/types';
import { SurvivorCard } from './SurvivorCard';
import { FONTS } from '../../theme';

// ---------------------------------------------------------------------------
// V6 palette
// ---------------------------------------------------------------------------

const BONE = 0xD9CFBA;
const RUST = 0x8B3A1A;
const MOSS = 0x2D4A2E;

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------

const PADDING = 16;
const DOT_R = 5;
const DOT_GAP = 16;
const BTN_HEIGHT = 56;
const BTN_BOTTOM_PAD = 24;
const TITLE_TOP_PAD = 24;
const SWIPE_THRESHOLD = 30;

// ---------------------------------------------------------------------------
// SurvivorSelectionScene
// ---------------------------------------------------------------------------

export interface SurvivorSelectionData {
  survivors: readonly Survivor[];
  unlockedIds: readonly number[];
  onSelect: (survivor: Survivor) => void;
}

export class SurvivorSelectionScene extends Container implements Scene {
  private _title: Text;
  private _carouselContainer = new Container();
  private _carouselMask = new Graphics();
  private _cards: SurvivorCard[] = [];
  private _dots = new Graphics();
  private _startBtn = new Container();
  private _startBtnBg = new Graphics();
  private _startBtnLabel: Text;
  private _selected: Survivor | null = null;
  private _onSelect: ((s: Survivor) => void) | null = null;

  // Carousel state
  private _currentIndex = 0;
  private _dragStartX = 0;
  private _dragOffsetStart = 0;
  private _dragging = false;
  private _dragMoved = false;
  private _carouselOffset = 0; // current visual offset (px)

  private _sw = 390;
  private _sh = 844;

  constructor() {
    super();

    this._title = new Text({
      text: 'CHOISIR UN SURVIVANT',
      style: {
        fontFamily: FONTS.HEADING, fontSize: 22,
        fontWeight: 'bold', fill: BONE, letterSpacing: 3,
      },
    });
    this._title.anchor.set(0.5, 0);
    this.addChild(this._title);

    // Carousel mask + container
    this.addChild(this._carouselMask);
    this._carouselContainer.mask = this._carouselMask;
    this.addChild(this._carouselContainer);

    // Drag handling on the full scene
    this.eventMode = 'static';
    this.on('pointerdown', this._onDragStart, this);
    this.on('pointermove', this._onDragMove, this);
    this.on('pointerup', this._onDragEnd, this);
    this.on('pointerupoutside', this._onDragEnd, this);

    // Dots
    this.addChild(this._dots);

    // Start button
    this._startBtnLabel = new Text({
      text: 'COMMENCER',
      style: {
        fontFamily: FONTS.HEADING, fontSize: 22,
        fontWeight: 'bold', fill: BONE, letterSpacing: 3,
      },
    });
    this._startBtnLabel.anchor.set(0.5);
    this._startBtn.addChild(this._startBtnBg, this._startBtnLabel);
    this._startBtn.eventMode = 'static';
    this._startBtn.cursor = 'pointer';
    this._startBtn.on('pointerdown', this._handleStart, this);
    this.addChild(this._startBtn);

    this._setStartEnabled(false);
  }

  // -----------------------------------------------------------------------
  // Scene lifecycle
  // -----------------------------------------------------------------------

  onEnter(data?: unknown): void {
    const d = data as SurvivorSelectionData;
    this._onSelect = d.onSelect;
    this._selected = null;
    this._currentIndex = 0;
    this._carouselOffset = 0;
    this._setStartEnabled(false);
    this._buildCards(d.survivors, d.unlockedIds);
    this._layout();
  }

  onExit(): void {
    this._clearCards();
    this._onSelect = null;
    this._selected = null;
  }

  onResize(w: number, h: number): void {
    this._sw = w;
    this._sh = h;
    this._layout();
  }

  // -----------------------------------------------------------------------
  // Card management
  // -----------------------------------------------------------------------

  private _buildCards(
    survivors: readonly Survivor[],
    unlockedIds: readonly number[],
  ): void {
    this._clearCards();
    const unlocked = new Set(unlockedIds);

    for (const s of survivors) {
      const isLocked = !unlocked.has(s.id);
      const card = new SurvivorCard(s, isLocked);
      this._carouselContainer.addChild(card);
      this._cards.push(card);
    }
  }

  private _clearCards(): void {
    for (const card of this._cards) {
      this._carouselContainer.removeChild(card);
      card.destroy({ children: true });
    }
    this._cards.length = 0;
    this._currentIndex = 0;
    this._carouselOffset = 0;
  }

  // -----------------------------------------------------------------------
  // Carousel drag
  // -----------------------------------------------------------------------

  private _onDragStart(e: { global: { x: number } }): void {
    this._dragging = true;
    this._dragMoved = false;
    this._dragStartX = e.global.x;
    this._dragOffsetStart = this._carouselOffset;
  }

  private _onDragMove(e: { global: { x: number } }): void {
    if (!this._dragging) return;
    const dx = e.global.x - this._dragStartX;
    if (Math.abs(dx) > 4) this._dragMoved = true;
    this._carouselOffset = this._dragOffsetStart + dx;
    this._positionCards();
  }

  private _onDragEnd(e?: { global: { x: number } }): void {
    if (!this._dragging) return;
    this._dragging = false;

    const dx = e ? e.global.x - this._dragStartX : 0;

    if (!this._dragMoved) {
      // Tap — select current card
      this._handleCardTap(this._currentIndex);
      return;
    }

    // Swipe detection
    if (dx < -SWIPE_THRESHOLD && this._currentIndex < this._cards.length - 1) {
      this._currentIndex++;
    } else if (dx > SWIPE_THRESHOLD && this._currentIndex > 0) {
      this._currentIndex--;
    }

    this._snapToIndex();
    this._drawDots();
  }

  private _snapToIndex(): void {
    const cardW = this._cardWidth();
    const gap = PADDING;
    this._carouselOffset = -(this._currentIndex * (cardW + gap));
    this._positionCards();
  }

  private _cardWidth(): number {
    return Math.floor(this._sw * 0.85);
  }

  private _cardHeight(): number {
    const btnArea = BTN_HEIGHT + BTN_BOTTOM_PAD * 2;
    const topArea = TITLE_TOP_PAD + 34 + 12; // title + gap
    const dotsArea = DOT_R * 2 + 16;
    return Math.floor(
      this._sh - topArea - dotsArea - btnArea - PADDING,
    );
  }

  private _positionCards(): void {
    const cardW = this._cardWidth();
    const gap = PADDING;
    const startX = (this._sw - cardW) / 2;

    for (let i = 0; i < this._cards.length; i++) {
      this._cards[i].position.set(
        startX + i * (cardW + gap) + this._carouselOffset,
        0,
      );
    }
  }

  private _handleCardTap(index: number): void {
    const card = this._cards[index];
    if (!card || card.isLocked) return;

    for (const c of this._cards) c.setSelected(false);
    card.setSelected(true);
    this._selected = card.survivor;
    this._setStartEnabled(true);
  }

  private _handleStart(): void {
    if (!this._selected) return;
    this._onSelect?.(this._selected);
  }

  // -----------------------------------------------------------------------
  // Dots indicator
  // -----------------------------------------------------------------------

  private _drawDots(): void {
    this._dots.clear();
    const count = this._cards.length;
    if (count <= 1) return;
    const totalW = count * DOT_R * 2 + (count - 1) * DOT_GAP;
    const startX = this._sw / 2 - totalW / 2 + DOT_R;

    for (let i = 0; i < count; i++) {
      const x = startX + i * (DOT_R * 2 + DOT_GAP);
      this._dots.circle(x, DOT_R, DOT_R);
      this._dots.fill({
        color: i === this._currentIndex ? RUST : BONE,
        alpha: i === this._currentIndex ? 1 : 0.3,
      });
    }
  }

  // -----------------------------------------------------------------------
  // Start button
  // -----------------------------------------------------------------------

  private _setStartEnabled(enabled: boolean): void {
    this._startBtn.alpha = enabled ? 1 : 0.35;
    this._startBtn.cursor = enabled ? 'pointer' : 'default';
    this._drawStartBtn(enabled);
  }

  private _drawStartBtn(enabled: boolean): void {
    const btnW = this._sw - PADDING * 2;
    this._startBtnBg.clear();
    this._startBtnBg.roundRect(0, 0, btnW, BTN_HEIGHT, 6);
    this._startBtnBg.fill({ color: enabled ? MOSS : 0x333333 });
    this._startBtnBg.roundRect(0, 0, btnW, BTN_HEIGHT, 6);
    this._startBtnBg.stroke({
      color: enabled ? RUST : 0x555555, width: 2,
    });
    this._startBtnLabel.position.set(btnW / 2, BTN_HEIGHT / 2);
  }

  // -----------------------------------------------------------------------
  // Layout
  // -----------------------------------------------------------------------

  private _layout(): void {
    const w = this._sw;
    const h = this._sh;
    const cardW = this._cardWidth();
    const cardH = this._cardHeight();

    // Title
    this._title.position.set(w / 2, TITLE_TOP_PAD);

    // Carousel area
    const carouselTop = TITLE_TOP_PAD + 34 + 12;

    // Size cards
    for (const card of this._cards) {
      card.setSize(cardW, cardH);
    }

    this._carouselContainer.position.set(0, carouselTop);
    this._snapToIndex();

    // Carousel mask
    this._carouselMask.clear();
    this._carouselMask.rect(0, carouselTop, w, cardH);
    this._carouselMask.fill({ color: 0xFFFFFF });

    // Dots
    const dotsY = carouselTop + cardH + 8;
    this._dots.position.set(0, dotsY);
    this._drawDots();

    // Start button — full width
    this._startBtn.position.set(PADDING, h - BTN_HEIGHT - BTN_BOTTOM_PAD);
    this._drawStartBtn(this._selected !== null);

    // Hit area for swipe
    this.hitArea = {
      contains: (x: number, y: number) =>
        x >= 0 && x <= w && y >= 0 && y <= h,
    };
  }
}
