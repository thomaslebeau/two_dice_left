/**
 * PipBar — row of small circles representing a numeric value.
 * Used under equipment slots to visualize damage/block/heal/poison.
 * Max pips drawn inline; above threshold shows number instead.
 */

import { Container, Graphics, Text } from 'pixi.js';
import { tickerTween } from '../combat/tickerUtils';
import { FONTS } from '../../theme';

const EMPTY_COLOR = 0x333333;
const MAX_INLINE = 12;
const FILL_MS = 200;

export class PipBar extends Container {
  private _maxPips: number;
  private _color: number;
  private _pipSize: number;
  private _gap: number;
  private _gfx = new Graphics();
  private _numText: Text;
  private _filled = 0;

  constructor(
    maxPips: number, color: number,
    pipSize = 6, gap = 3,
  ) {
    super();
    this._maxPips = maxPips;
    this._color = color;
    this._pipSize = pipSize;
    this._gap = gap;

    this.addChild(this._gfx);

    // Fallback number (shown when pips > MAX_INLINE)
    this._numText = new Text({
      text: '',
      style: { fontFamily: FONTS.HEADING, fontSize: 12, fill: color },
    });
    this._numText.anchor.set(0, 0.5);
    this._numText.visible = false;
    this.addChild(this._numText);

    this._draw(0);
  }

  get totalWidth(): number {
    const n = Math.min(this._maxPips, MAX_INLINE);
    return n * this._pipSize + (n - 1) * this._gap;
  }

  /** Set max pips and redraw empty. */
  setMax(maxPips: number): void {
    this._maxPips = maxPips;
    this._filled = 0;
    this._draw(0);
  }

  /** Light up N pips, optionally animated left-to-right. */
  fillPips(count: number, animated = true): void {
    this._filled = count;
    if (!animated || count <= 0) {
      this._draw(count);
      return;
    }
    // Animate: draw progressively over FILL_MS
    void tickerTween(FILL_MS, (t) => {
      const n = Math.round(count * t);
      this._draw(n);
    }).then(() => this._draw(count));
  }

  /** Reset all pips to empty (grey). */
  reset(): void {
    this._filled = 0;
    this._draw(0);
  }

  /** Update color (e.g. weapon→green, shield→blue). */
  setColor(color: number): void {
    this._color = color;
    this._numText.style.fill = color;
    this._draw(this._filled);
  }

  private _draw(filledCount: number): void {
    this._gfx.clear();
    const max = this._maxPips;
    const r = this._pipSize / 2;

    // If too many pips, show number instead
    if (max > MAX_INLINE) {
      this._gfx.visible = false;
      this._numText.visible = true;
      this._numText.text = filledCount > 0
        ? `${filledCount}/${max}` : `0/${max}`;
      this._numText.position.set(0, r);
      return;
    }

    this._gfx.visible = true;
    this._numText.visible = false;

    for (let i = 0; i < max; i++) {
      const cx = i * (this._pipSize + this._gap) + r;
      const cy = r;
      this._gfx.circle(cx, cy, r);
      this._gfx.fill({
        color: i < filledCount ? this._color : EMPTY_COLOR,
      });
    }
  }
}
