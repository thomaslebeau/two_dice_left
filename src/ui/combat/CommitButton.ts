/**
 * V6 commit button — locks allocations and triggers resolution.
 * Disabled until all dice are placed. Uses v6 palette.
 */

import { Container, Graphics, Text } from 'pixi.js';
import { FONTS } from '../../theme';

// ---------------------------------------------------------------------------
// V6 palette
// ---------------------------------------------------------------------------

const BONE = 0xD9CFBA;
const RUST = 0x8B3A1A;
const MOSS = 0x2D4A2E;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BTN_WIDTH = 160;
const BTN_HEIGHT = 36;
const CORNER_RADIUS = 6;

export class CommitButton extends Container {
  private _bg = new Graphics();
  private _labelText: Text;
  private _enabled = false;

  /** Called when the player taps commit. */
  onCommit: (() => void) | null = null;

  constructor() {
    super();

    this.addChild(this._bg);

    this._labelText = new Text({
      text: 'VALIDER',
      style: {
        fontFamily: FONTS.HEADING,
        fontSize: 18,
        fontWeight: 'bold',
        fill: BONE,
        letterSpacing: 3,
      },
    });
    this._labelText.anchor.set(0.5);
    this._labelText.position.set(BTN_WIDTH / 2, BTN_HEIGHT / 2);
    this.addChild(this._labelText);

    this.eventMode = 'static';
    this.cursor = 'default';
    this.on('pointerdown', this._handlePress, this);
    this.on('pointerover', this._handleOver, this);
    this.on('pointerout', this._handleOut, this);

    this._draw();
  }

  get buttonWidth(): number { return BTN_WIDTH; }
  get buttonHeight(): number { return BTN_HEIGHT; }

  /** Enable or disable the button. */
  setEnabled(enabled: boolean): void {
    this._enabled = enabled;
    this.cursor = enabled ? 'pointer' : 'default';
    this.alpha = enabled ? 1 : 0.35;
    this._draw();
  }

  private _draw(): void {
    this._bg.clear();
    const fillColor = this._enabled ? MOSS : 0x333333;
    this._bg.roundRect(0, 0, BTN_WIDTH, BTN_HEIGHT, CORNER_RADIUS);
    this._bg.fill({ color: fillColor });
    this._bg.roundRect(0, 0, BTN_WIDTH, BTN_HEIGHT, CORNER_RADIUS);
    this._bg.stroke({ color: this._enabled ? RUST : 0x555555, width: 2 });
  }

  private _handlePress(): void {
    if (!this._enabled) return;
    this.onCommit?.();
  }

  private _handleOver(): void {
    if (!this._enabled) return;
    this.alpha = 0.85;
  }

  private _handleOut(): void {
    this.alpha = this._enabled ? 1 : 0.35;
  }
}
