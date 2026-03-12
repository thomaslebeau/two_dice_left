/**
 * V6 draggable die sprite with pip display.
 * States: idle, dragging, placed, incompatible.
 * Supports drag-drop and tap-to-place.
 */

import { Container, Graphics, Text, Ticker } from 'pixi.js';
import { tickerSteps } from './tickerUtils';
import { FONTS } from '../../theme';

// ---------------------------------------------------------------------------
// V6 palette
// ---------------------------------------------------------------------------

const BONE = 0xD9CFBA;
const RUST = 0x8B3A1A;
const MOSS = 0x2D4A2E;
const CHARCOAL = 0x1A1A1A;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const DIE_SIZE = 52;
const CORNER_RADIUS = 7;
const PIP_RADIUS = 4;
const PIP_COLOR = CHARCOAL;
const ROLL_DURATION = 1800;
const ROLL_START_SPEED = 40;
const ROLL_SLOW_POINT = 0.6;
const ROLL_SLOW_SPEED = 120;
const ROLL_STOP_POINT = 0.92;

export type DieState = 'idle' | 'dragging' | 'placed' | 'incompatible';

// ---------------------------------------------------------------------------
// Pip layout patterns for 1–6
// ---------------------------------------------------------------------------

type PipPos = [number, number];

const PIP_PATTERNS: Record<number, PipPos[]> = {
  1: [[0.5, 0.5]],
  2: [[0.25, 0.25], [0.75, 0.75]],
  3: [[0.25, 0.25], [0.5, 0.5], [0.75, 0.75]],
  4: [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]],
  5: [[0.25, 0.25], [0.75, 0.25], [0.5, 0.5], [0.25, 0.75], [0.75, 0.75]],
  6: [[0.25, 0.25], [0.75, 0.25], [0.25, 0.5], [0.75, 0.5], [0.25, 0.75], [0.75, 0.75]],
};

export class DiceSprite extends Container {
  private _bg = new Graphics();
  private _pips = new Graphics();
  private _glowBorder = new Graphics();
  private _valueText: Text;
  private _state: DieState = 'idle';
  private _value = 1;
  private _dieIndex: number;
  private _rollCb: ((ticker: Ticker) => void) | null = null;
  private _rollElapsed = 0;
  private _rollNextAt = 0;
  private _finalValue = 1;

  constructor(dieIndex: number) {
    super();
    this._dieIndex = dieIndex;

    this.addChild(this._bg);
    this.addChild(this._pips);
    this.addChild(this._glowBorder);

    // Fallback text (hidden when pips are drawn)
    this._valueText = new Text({
      text: '',
      style: {
        fontFamily: FONTS.HEADING,
        fontSize: 16,
        fontWeight: 'bold',
        fill: CHARCOAL,
      },
    });
    this._valueText.anchor.set(0.5);
    this._valueText.position.set(DIE_SIZE / 2, DIE_SIZE / 2);
    this._valueText.visible = false;
    this.addChild(this._valueText);

    this.eventMode = 'static';
    this.cursor = 'grab';
    this._drawBg();
    this._drawPips(1);
  }

  get dieIndex(): number { return this._dieIndex; }
  get value(): number { return this._value; }
  get dieState(): DieState { return this._state; }

  /** Set die state and redraw visuals. */
  setState(state: DieState): void {
    this._state = state;
    this._drawBg();
    this._drawGlow();
    this.cursor = state === 'placed' ? 'default'
      : state === 'incompatible' ? 'not-allowed'
      : state === 'dragging' ? 'grabbing'
      : 'grab';
    this.alpha = state === 'incompatible' ? 0.4 : 1;
  }

  /** Immediately show a value. */
  setValue(value: number): void {
    this._stopRoll();
    this._value = value;
    this._drawPips(value);
  }

  /** Start slot-machine roll animation, landing on finalValue. */
  roll(finalValue: number): void {
    this._stopRoll();
    this._finalValue = finalValue;
    this._rollElapsed = 0;
    this._rollNextAt = ROLL_START_SPEED;
    this.alpha = 0.7;

    const cb = (ticker: Ticker): void => {
      this._rollElapsed += ticker.deltaMS;
      if (this._rollElapsed < this._rollNextAt) return;

      const progress = this._rollElapsed / ROLL_DURATION;
      if (progress >= ROLL_STOP_POINT) {
        this._value = this._finalValue;
        this._drawPips(this._finalValue);
        this.alpha = 1;
        this._stopRoll();
        return;
      }

      this._drawPips(Math.floor(Math.random() * 6) + 1);
      this._rollNextAt = this._rollElapsed + (
        progress >= ROLL_SLOW_POINT ? ROLL_SLOW_SPEED : ROLL_START_SPEED
      );
    };

    this._rollCb = cb;
    Ticker.shared.add(cb);
  }

  /** Play a brief shake to indicate incompatible drop. */
  shake(): void {
    const origX = this.x;
    void tickerSteps(6, 40, (step) => {
      this.x = origX + (step % 2 === 0 ? 3 : -3);
    }).then(() => { this.x = origX; });
  }

  destroy(): void {
    this._stopRoll();
    super.destroy({ children: true });
  }

  // --- Drawing ---

  private _drawBg(): void {
    this._bg.clear();
    // Always bone white — state communicated by stroke only
    this._bg.roundRect(0, 0, DIE_SIZE, DIE_SIZE, CORNER_RADIUS);
    this._bg.fill({ color: BONE });
    const strokeColor = this._state === 'dragging' ? RUST
      : this._state === 'placed' ? MOSS
      : 0x999999;
    const strokeWidth = (this._state === 'dragging' || this._state === 'placed') ? 2 : 1;
    this._bg.roundRect(0, 0, DIE_SIZE, DIE_SIZE, CORNER_RADIUS);
    this._bg.stroke({ color: strokeColor, width: strokeWidth });
  }

  private _drawGlow(): void {
    this._glowBorder.clear();
    if (this._state === 'dragging') {
      this._glowBorder.roundRect(-2, -2, DIE_SIZE + 4, DIE_SIZE + 4, CORNER_RADIUS + 2);
      this._glowBorder.stroke({ color: RUST, width: 3 });
    }
  }

  private _drawPips(value: number): void {
    this._pips.clear();
    const pattern = PIP_PATTERNS[value];
    if (!pattern) return;

    for (const [px, py] of pattern) {
      this._pips.circle(px * DIE_SIZE, py * DIE_SIZE, PIP_RADIUS);
      this._pips.fill({ color: PIP_COLOR });
    }
  }

  // --- Roll animation ---

  private _stopRoll(): void {
    if (this._rollCb) {
      Ticker.shared.remove(this._rollCb);
      this._rollCb = null;
    }
  }
}
