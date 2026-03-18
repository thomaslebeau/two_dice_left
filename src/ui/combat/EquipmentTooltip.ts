/**
 * Equipment tooltip — shows name, effect, and range when tapping
 * a filled compartment in the toolbox.
 * Lives as a child of CombatScene for global z-ordering.
 */

import { Container, Graphics, Text } from 'pixi.js';
import type { Equipment } from '../../engine/types';
import { FONTS } from '../../theme';
import { formatRange } from '../../data/strings';
import { tickerTween, tickerLoop, type TickerHandle } from './tickerUtils';

const BONE = 0xD9CFBA;
const CHARCOAL = 0x1A1A1A;
const BORDER_COLOR = 0x555555;

const TT_H = 36;
const TT_PAD_X = 12;
const TT_MIN_W = 200;
const TT_MAX_W = 300;
const ARROW_SIZE = 6;
const FADE_MS = 150;
const AUTO_HIDE_MS = 2000;

export class EquipmentTooltip extends Container {
  private _bg = new Graphics();
  private _arrow = new Graphics();
  private _nameText: Text;
  private _effectText: Text;
  private _rangeText: Text;
  private _hideHandle: TickerHandle | null = null;
  private _viewportW = 390;
  private _justShown = false;

  constructor() {
    super();
    this.visible = false;
    this.alpha = 0;

    this.addChild(this._bg);

    this._nameText = new Text({
      text: '',
      style: {
        fontFamily: FONTS.HEADING, fontSize: 16,
        fontWeight: 'bold', fill: BONE,
      },
    });
    this._nameText.anchor.set(0, 0.5);
    this.addChild(this._nameText);

    this._effectText = new Text({
      text: '',
      style: {
        fontFamily: FONTS.BODY, fontSize: 14, fill: BONE,
      },
    });
    this._effectText.anchor.set(0, 0.5);
    this._effectText.alpha = 0.8;
    this.addChild(this._effectText);

    this._rangeText = new Text({
      text: '',
      style: {
        fontFamily: FONTS.BODY, fontSize: 14, fill: BONE,
      },
    });
    this._rangeText.anchor.set(1, 0.5);
    this._rangeText.alpha = 0.5;
    this.addChild(this._rangeText);

    this._arrow.moveTo(-ARROW_SIZE, 0);
    this._arrow.lineTo(ARROW_SIZE, 0);
    this._arrow.lineTo(0, ARROW_SIZE);
    this._arrow.closePath();
    this._arrow.fill(CHARCOAL);
    this.addChild(this._arrow);
  }

  setViewportWidth(w: number): void {
    this._viewportW = w;
  }

  /** Show tooltip above the given global position for the given equipment. */
  show(eq: Equipment, globalX: number, globalY: number): void {
    this._clearHideTimer();

    this._nameText.text = eq.name;
    this._effectText.text = eq.description;
    this._rangeText.text = formatRange(eq.minDie, eq.maxDie);

    // Measure content width
    const nameW = this._nameText.width;
    const effectW = this._effectText.width;
    const rangeW = this._rangeText.width;
    const gap = 10;
    const contentW = nameW + gap + effectW + gap + rangeW;
    const ttW = Math.min(TT_MAX_W, Math.max(TT_MIN_W, contentW + TT_PAD_X * 2));

    // Draw background
    this._bg.clear();
    this._bg.roundRect(0, 0, ttW, TT_H, 4);
    this._bg.fill({ color: CHARCOAL, alpha: 0.9 });
    this._bg.roundRect(0, 0, ttW, TT_H, 4);
    this._bg.stroke({ color: BORDER_COLOR, width: 1 });

    // Position texts vertically centered
    const cy = TT_H / 2;
    this._nameText.position.set(TT_PAD_X, cy);
    this._effectText.position.set(TT_PAD_X + nameW + gap, cy);
    this._rangeText.position.set(ttW - TT_PAD_X, cy);

    // Arrow centered at bottom
    this._arrow.position.set(ttW / 2, TT_H);

    // Position tooltip: centered above target, clamped to viewport
    let x = globalX - ttW / 2;
    const margin = 4;
    x = Math.max(margin, Math.min(x, this._viewportW - ttW - margin));
    const y = globalY - TT_H - ARROW_SIZE - 4;

    this.position.set(x, y);

    // Fade in
    this.visible = true;
    this.alpha = 0;
    void tickerTween(FADE_MS, (t) => { this.alpha = t; });

    // Auto-hide after 2s (ticker-based, pauses when tab hidden)
    this._hideHandle = tickerLoop((elapsed) => {
      if (elapsed >= AUTO_HIDE_MS) this.hide();
    });

    // Guard: prevent immediate dismiss from same pointerdown event
    this._justShown = true;
    queueMicrotask(() => { this._justShown = false; });
  }

  /** Dismiss if visible and not just shown in this event cycle. */
  dismissOnTapElsewhere(): void {
    if (!this.visible || this._justShown) return;
    this.hide();
  }

  hide(): void {
    this._clearHideTimer();
    this.visible = false;
    this.alpha = 0;
  }

  private _clearHideTimer(): void {
    if (this._hideHandle !== null) {
      this._hideHandle.stop();
      this._hideHandle = null;
    }
  }

  cleanup(): void {
    this._clearHideTimer();
    this.visible = false;
  }
}
