/**
 * First-combat onboarding hint — "GLISSE UN DÉ VERS UN EMPLACEMENT"
 * with animated pulsing arrow. Shown once, then persisted in localStorage.
 */

import { Container, Graphics, Text } from 'pixi.js';
import { FONTS } from '../../theme';
import { STRINGS } from '../../data/strings';
import { tickerLoop, type TickerHandle } from './tickerUtils';

const LS_KEY = 'tdl_onboarding_done';
const BONE = 0xD9CFBA;
const CHARCOAL = 0x1A1A1A;

export class OnboardingHint extends Container {
  private _text: Text;
  private _arrow = new Graphics();
  private _pulseHandle: TickerHandle | null = null;
  private _dismissed = false;

  constructor() {
    super();
    this.visible = false;

    // Background
    const bg = new Graphics();
    bg.roundRect(0, 0, 320, 48, 6);
    bg.fill({ color: CHARCOAL, alpha: 0.9 });
    this.addChild(bg);

    this._text = new Text({
      text: STRINGS.DRAG_HINT,
      style: {
        fontFamily: FONTS.HEADING, fontSize: 16,
        fontWeight: 'bold', fill: BONE, letterSpacing: 1,
      },
    });
    this._text.anchor.set(0.5);
    this._text.position.set(160, 24);
    this.addChild(this._text);

    // Arrow (drawn below text, points downward)
    this._arrow.moveTo(0, 0);
    this._arrow.lineTo(8, 14);
    this._arrow.lineTo(-8, 14);
    this._arrow.closePath();
    this._arrow.fill(BONE);
    this.addChild(this._arrow);
  }

  /** Check if onboarding should show. Only on first combat ever. */
  static shouldShow(): boolean {
    try {
      return !localStorage.getItem(LS_KEY);
    } catch {
      return false;
    }
  }

  /** Show the hint centered at (cx, y) with arrow pointing down to slots. */
  show(cx: number, y: number): void {
    if (this._dismissed) return;
    this.position.set(cx - 160, y);
    this._arrow.position.set(160, 48);
    this.visible = true;

    // Pulse the arrow up/down
    this._pulseHandle = tickerLoop((elapsed) => {
      this._arrow.y = 48 + 6 * Math.sin(elapsed / 300);
    });
  }

  /** Dismiss forever — called on first die placement. */
  dismiss(): void {
    if (this._dismissed) return;
    this._dismissed = true;
    this._pulseHandle?.stop();
    this._pulseHandle = null;
    this.visible = false;
    try {
      localStorage.setItem(LS_KEY, '1');
    } catch { /* storage full — ignore */ }
  }

  cleanup(): void {
    this._pulseHandle?.stop();
    this._pulseHandle = null;
    this.visible = false;
  }
}
