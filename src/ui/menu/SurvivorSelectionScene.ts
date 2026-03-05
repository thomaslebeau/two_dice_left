/**
 * Survivor selection scene — vertical list of SurvivorCards.
 * Scrollable if more than 3 cards. Tap to select, button to start.
 */

import { Container, Graphics, Text } from 'pixi.js';
import type { Scene } from '../../engine/SceneManager';
import type { Survivor } from '../../engine/types';
import { SurvivorCard, SURVIVOR_CARD_HEIGHT } from './SurvivorCard';
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

const MARGIN_X = 20;
const CARD_GAP = 12;
const BTN_WIDTH = 200;
const BTN_HEIGHT = 44;
const BTN_BOTTOM_PAD = 24;
const TITLE_TOP_PAD = 32;

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
  private _scrollContainer = new Container();
  private _scrollMask = new Graphics();
  private _cards: SurvivorCard[] = [];
  private _startBtn = new Container();
  private _startBtnBg = new Graphics();
  private _startBtnLabel: Text;
  private _selected: Survivor | null = null;
  private _onSelect: ((s: Survivor) => void) | null = null;

  // Scroll state
  private _scrollY = 0;
  private _maxScroll = 0;
  private _dragStartY = 0;
  private _dragScrollStart = 0;
  private _dragging = false;
  private _dragMoved = false;
  private _scrollBg = new Graphics();

  private _sw = 390;
  private _sh = 844;

  constructor() {
    super();

    this._title = new Text({
      text: 'CHOISIR UN SURVIVANT',
      style: {
        fontFamily: FONTS.HEADING,
        fontSize: 20,
        fontWeight: 'bold',
        fill: BONE,
        letterSpacing: 3,
      },
    });
    this._title.anchor.set(0.5, 0);
    this.addChild(this._title);

    // Scroll background — catches drag events behind cards
    this._scrollBg.eventMode = 'static';
    this._scrollBg.on('pointerdown', this._onDragStart, this);
    this._scrollBg.on('pointermove', this._onDragMove, this);
    this._scrollBg.on('pointerup', this._onDragEnd, this);
    this._scrollBg.on('pointerupoutside', this._onDragEnd, this);
    this.addChild(this._scrollBg);

    // Scroll container with mask (no eventMode — cards handle their own)
    this.addChild(this._scrollMask);
    this._scrollContainer.mask = this._scrollMask;
    this.addChild(this._scrollContainer);

    // Start button
    this._startBtnLabel = new Text({
      text: 'COMMENCER',
      style: {
        fontFamily: FONTS.HEADING,
        fontSize: 18,
        fontWeight: 'bold',
        fill: BONE,
        letterSpacing: 3,
      },
    });
    this._startBtnLabel.anchor.set(0.5);
    this._startBtn.addChild(this._startBtnBg, this._startBtnLabel);
    this._startBtn.eventMode = 'static';
    this._startBtn.cursor = 'pointer';
    this._startBtn.on('pointerdown', this._handleStart, this);
    this._startBtn.on('pointerover', () => {
      if (this._selected) this._startBtn.alpha = 0.85;
    });
    this._startBtn.on('pointerout', () => {
      this._startBtn.alpha = this._selected ? 1 : 0.35;
    });
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
      // Drag events forwarded to scroll handler
      card.on('pointerdown', (e: { global: { y: number } }) => {
        this._onDragStart(e);
      });
      card.on('pointermove', (e: { global: { y: number } }) => {
        this._onDragMove(e);
      });
      card.on('pointerup', () => {
        // Tap (no drag) → select card
        if (!this._dragMoved) this._handleCardTap(card);
        this._onDragEnd();
      });
      card.on('pointerupoutside', () => this._onDragEnd());
      card.on('pointerover', () => {
        if (!isLocked) card.alpha = 0.9;
      });
      card.on('pointerout', () => {
        card.alpha = isLocked ? 0.4 : 1;
      });
      this._scrollContainer.addChild(card);
      this._cards.push(card);
    }
  }

  private _clearCards(): void {
    for (const card of this._cards) {
      this._scrollContainer.removeChild(card);
      card.destroy({ children: true });
    }
    this._cards.length = 0;
    this._scrollY = 0;
  }

  private _handleCardTap(card: SurvivorCard): void {
    if (card.isLocked) return;

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
  // Start button
  // -----------------------------------------------------------------------

  private _setStartEnabled(enabled: boolean): void {
    this._startBtn.alpha = enabled ? 1 : 0.35;
    this._startBtn.cursor = enabled ? 'pointer' : 'default';
    this._drawStartBtn(enabled);
  }

  private _drawStartBtn(enabled: boolean): void {
    this._startBtnBg.clear();
    this._startBtnBg.roundRect(0, 0, BTN_WIDTH, BTN_HEIGHT, 6);
    this._startBtnBg.fill({ color: enabled ? MOSS : 0x333333 });
    this._startBtnBg.roundRect(0, 0, BTN_WIDTH, BTN_HEIGHT, 6);
    this._startBtnBg.stroke({
      color: enabled ? RUST : 0x555555, width: 2,
    });
    this._startBtnLabel.position.set(BTN_WIDTH / 2, BTN_HEIGHT / 2);
  }

  // -----------------------------------------------------------------------
  // Scroll
  // -----------------------------------------------------------------------

  private _onDragStart(e: { global: { y: number } }): void {
    this._dragging = true;
    this._dragMoved = false;
    this._dragStartY = e.global.y;
    this._dragScrollStart = this._scrollY;
  }

  private _onDragMove(e: { global: { y: number } }): void {
    if (!this._dragging) return;
    const dy = e.global.y - this._dragStartY;
    if (Math.abs(dy) > 4) this._dragMoved = true;
    this._scrollY = Math.max(
      -this._maxScroll,
      Math.min(0, this._dragScrollStart + dy),
    );
    this._scrollContainer.y = this._scrollAreaTop() + this._scrollY;
  }

  private _onDragEnd(): void {
    this._dragging = false;
  }

  private _scrollAreaTop(): number {
    return TITLE_TOP_PAD + 30 + 16;
  }

  // -----------------------------------------------------------------------
  // Layout
  // -----------------------------------------------------------------------

  private _layout(): void {
    const w = this._sw;
    const h = this._sh;
    const cardW = w - MARGIN_X * 2;

    // Title
    this._title.position.set(w / 2, TITLE_TOP_PAD);

    // Cards
    const scrollTop = this._scrollAreaTop();
    const btnAreaH = BTN_HEIGHT + BTN_BOTTOM_PAD * 2;
    const scrollH = h - scrollTop - btnAreaH;

    let cardY = 0;
    for (const card of this._cards) {
      card.setWidth(cardW);
      card.position.set(MARGIN_X, cardY);
      cardY += SURVIVOR_CARD_HEIGHT + CARD_GAP;
    }

    // Scroll bounds
    const totalH = Math.max(0, cardY - CARD_GAP);
    this._maxScroll = Math.max(0, totalH - scrollH);
    this._scrollY = Math.max(-this._maxScroll, this._scrollY);

    // Scroll mask
    this._scrollMask.clear();
    this._scrollMask.rect(0, scrollTop, w, scrollH);
    this._scrollMask.fill({ color: 0xFFFFFF });

    // Scroll drag background (behind cards, covers scroll area)
    this._scrollBg.clear();
    this._scrollBg.rect(0, scrollTop, w, scrollH);
    this._scrollBg.fill({ color: 0x000000, alpha: 0.001 });

    this._scrollContainer.position.set(0, scrollTop + this._scrollY);

    // Start button
    this._startBtn.position.set(
      (w - BTN_WIDTH) / 2,
      h - BTN_HEIGHT - BTN_BOTTOM_PAD,
    );
    this._drawStartBtn(this._selected !== null);
  }
}
