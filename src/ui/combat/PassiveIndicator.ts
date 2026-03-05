/**
 * Reusable passive feedback indicator — icon + value text.
 * Three animation modes: popup (float up + fade), persist (bounce in),
 * consume (slide toward target + fade). Uses tickerTween from tickerUtils.
 */

import { Container, Text } from 'pixi.js';
import { tickerTween } from './tickerUtils';
import { timings, FONTS } from '../../theme';

export class PassiveIndicator extends Container {
  private _label: Text;

  constructor() {
    super();
    this._label = new Text({
      text: '',
      style: { fontFamily: FONTS.HEADING, fontSize: 12, fontWeight: 'bold', fill: 0xD9CFBA },
    });
    this._label.anchor.set(0.5);
    this.addChild(this._label);
    this.visible = false;
  }

  /** Float up 8px + fade out. For Survivant/Ingenieux "+1". */
  popup(text: string, color: number, x: number, y: number): Promise<void> {
    this._show(text, color, x, y);
    const startY = y;
    return tickerTween(timings.passivePopupDuration, (t) => {
      this.y = startY - t * 8;
      this.alpha = 1 - t;
    }).then(() => this._hide());
  }

  /** Bounce in (scale 0→1). Stays visible. For Rempart carry. */
  persist(text: string, color: number, x: number, y: number): void {
    this._show(text, color, x, y);
    this.scale.set(0);
    void tickerTween(200, (t) => {
      // easeOutBack
      const c1 = 1.70158;
      const c3 = c1 + 1;
      const p = 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
      this.scale.set(p);
    });
  }

  /** Slide toward target + fade out. For Rempart carry consumed. */
  consume(targetX: number, targetY: number): Promise<void> {
    const startX = this.x, startY = this.y;
    return tickerTween(timings.passiveGlowDuration, (t) => {
      this.x = startX + (targetX - startX) * t;
      this.y = startY + (targetY - startY) * t;
      this.alpha = 1 - t;
    }).then(() => this._hide());
  }

  /** Immediate cleanup. */
  hide(): void { this._hide(); }

  private _show(text: string, color: number, x: number, y: number): void {
    this._label.text = text;
    this._label.style.fill = color;
    this.position.set(x, y);
    this.alpha = 1;
    this.scale.set(1);
    this.visible = true;
  }

  private _hide(): void {
    this.visible = false;
    this.alpha = 0;
  }
}
