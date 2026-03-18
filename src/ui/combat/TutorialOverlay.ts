/**
 * Two-phase tutorial overlay for the first combat.
 * Phase 1: dims bottom half (enemy visible at top).
 * Phase 2: dims top half (dice + player visible at bottom).
 * No mask/cutout — just a partial rect overlay.
 */

import { Container, Graphics, Text } from 'pixi.js';
import { tickerTween } from './tickerUtils';
import { FONTS, TEXT_COLORS } from '../../theme';
import { STRINGS } from '../../data/strings';

const LS_KEY = 'tdl_tutorial_done';
const CHARCOAL = 0x1A1A1A;
const BONE = 0xD9CFBA;
const MOSS = 0x2D4A2E;
const OVERLAY_ALPHA = 0.8;
const MSG_PAD = 16;
const MSG_MAX_W = 300;
const BTN_W = 120;
const BTN_H = 44;
const FADE_MS = 250;

export class TutorialOverlay extends Container {
  private _sw: number;
  private _sh: number;
  private _dim = new Graphics();
  private _msgContainer = new Container();
  private _msgBg = new Graphics();
  private _msgText: Text;
  private _btnContainer = new Container();
  private _skipped = false;
  private _pendingResolve: (() => void) | null = null;

  constructor(sw: number, sh: number) {
    super();
    this._sw = sw;
    this._sh = sh;
    this.zIndex = 50;
    this.eventMode = 'static';

    this.addChild(this._dim);

    this._msgText = new Text({
      text: '',
      style: {
        fontFamily: FONTS.BODY, fontSize: 18, fill: BONE,
        wordWrap: true, wordWrapWidth: MSG_MAX_W - MSG_PAD * 2,
        lineHeight: 24,
      },
    });
    this._msgText.position.set(MSG_PAD, MSG_PAD);
    this._msgContainer.addChild(this._msgBg, this._msgText);
    this._msgContainer.visible = false;
    this.addChild(this._msgContainer);

    this.addChild(this._btnContainer);

    // SKIP always visible top-right
    const skip = this._makeBtn(
      STRINGS.TUTO_SKIP, TEXT_COLORS.MUTED, null,
      () => this._finish(),
    );
    skip.position.set(this._sw - 16 - 60, 12);
    this.addChild(skip);
  }

  static shouldShow(): boolean {
    try { return !localStorage.getItem(LS_KEY); }
    catch { return false; }
  }

  static markComplete(): void {
    try { localStorage.setItem(LS_KEY, '1'); }
    catch { /* ignore */ }
  }

  /**
   * Run both phases. splitY is the y-coordinate that divides
   * enemy zone (above) from player zone (below).
   */
  async run(splitY: number): Promise<void> {
    // Phase 1: dim below splitY — enemy visible at top
    this._drawDim(0, splitY, this._sw, this._sh - splitY);
    this._showMsg(STRINGS.TUTO_PHASE1, splitY + 24);
    await this._waitBtn(STRINGS.TUTO_NEXT);
    if (this._skipped) return;

    // Phase 2: dim above splitY — player + dice visible at bottom
    this._drawDim(0, 0, this._sw, splitY);
    this._showMsg(STRINGS.TUTO_PHASE2, 24);
    await this._waitBtn(STRINGS.TUTO_GOT_IT);
    if (this._skipped) return;

    this._finish();
  }

  // -----------------------------------------------------------------------
  // Internal
  // -----------------------------------------------------------------------

  private _drawDim(
    x: number, y: number, w: number, h: number,
  ): void {
    this._dim.clear();
    this._dim.rect(x, y, w, h);
    this._dim.fill({ color: CHARCOAL, alpha: OVERLAY_ALPHA });
  }

  private _showMsg(text: string, y: number): void {
    this._msgText.text = text;
    const tw = Math.min(MSG_MAX_W, this._sw - 32);
    this._msgText.style.wordWrapWidth = tw - MSG_PAD * 2;
    const th = this._msgText.height + MSG_PAD * 2;
    this._msgBg.clear();
    this._msgBg.roundRect(0, 0, tw, th, 4);
    this._msgBg.fill({ color: CHARCOAL, alpha: 0.95 });
    this._msgContainer.position.set(
      (this._sw - tw) / 2,
      Math.max(16, Math.min(y, this._sh - th - 60)),
    );
    this._msgContainer.visible = true;
  }

  private _waitBtn(label: string): Promise<void> {
    return new Promise((resolve) => {
      this._pendingResolve = resolve;
      const btn = this._makeBtn(label, BONE, MOSS, () => {
        this._pendingResolve = null;
        resolve();
      });
      const msgBot = this._msgContainer.y + this._msgBg.height + 12;
      btn.position.set(this._sw / 2 - BTN_W / 2, msgBot);
      this._btnContainer.removeChildren();
      this._btnContainer.addChild(btn);
    });
  }

  private _makeBtn(
    label: string, textColor: number,
    bgColor: number | null, cb: () => void,
  ): Container {
    const c = new Container();
    if (bgColor !== null) {
      const bg = new Graphics();
      bg.roundRect(0, 0, BTN_W, BTN_H, 4);
      bg.fill({ color: bgColor });
      c.addChild(bg);
    }
    const t = new Text({
      text: label,
      style: {
        fontFamily: bgColor ? FONTS.HEADING : FONTS.BODY,
        fontSize: bgColor ? 18 : 14,
        fontWeight: bgColor ? 'bold' : 'normal',
        fill: textColor, letterSpacing: bgColor ? 2 : 0,
      },
    });
    if (bgColor) {
      t.anchor.set(0.5);
      t.position.set(BTN_W / 2, BTN_H / 2);
    }
    c.addChild(t);
    c.eventMode = 'static';
    c.cursor = 'pointer';
    c.hitArea = { contains: (x: number, y: number) =>
      x >= -4 && x <= BTN_W + 4 && y >= -4 && y <= BTN_H + 4 };
    c.on('pointerdown', cb);
    return c;
  }

  private _finish(): void {
    if (this._skipped) return;
    this._skipped = true;
    TutorialOverlay.markComplete();
    const pending = this._pendingResolve;
    this._pendingResolve = null;
    pending?.();
    if (this.parent) {
      void tickerTween(FADE_MS, (p) => { this.alpha = 1 - p; })
        .then(() => {
          if (this.parent) this.parent.removeChild(this);
          this.destroy({ children: true });
        });
    }
  }
}
