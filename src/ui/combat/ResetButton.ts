/**
 * Secondary "ANNULER" button — clears all dice allocations.
 * Visible only when at least 1 die is allocated.
 * Less prominent than the primary CommitButton.
 */

import { Container, Graphics, Text } from 'pixi.js';
import { FONTS } from '../../theme';

const BONE = 0xD9CFBA;
const BTN_WIDTH = 140;
const BTN_HEIGHT = 48;
const CORNER_R = 6;

export class ResetButton extends Container {
  private _bg = new Graphics();
  private _label: Text;

  onReset: (() => void) | null = null;

  constructor() {
    super();
    this.addChild(this._bg);

    this._label = new Text({
      text: 'ANNULER',
      style: {
        fontFamily: FONTS.HEADING,
        fontSize: 16, fontWeight: 'bold',
        fill: BONE, letterSpacing: 3,
      },
    });
    this._label.anchor.set(0.5);
    this._label.position.set(BTN_WIDTH / 2, BTN_HEIGHT / 2);
    this.addChild(this._label);

    this.eventMode = 'static';
    this.cursor = 'pointer';
    this.on('pointerdown', () => this.onReset?.());

    this.visible = false;
    this._draw();
  }

  get buttonWidth(): number { return BTN_WIDTH; }
  get buttonHeight(): number { return BTN_HEIGHT; }

  /** Show when at least 1 die is allocated, hide otherwise. */
  setVisible(show: boolean): void {
    this.visible = show;
  }

  private _draw(): void {
    this._bg.clear();
    this._bg.roundRect(0, 0, BTN_WIDTH, BTN_HEIGHT, CORNER_R);
    this._bg.fill({ color: 0x333333 });
    this._bg.roundRect(0, 0, BTN_WIDTH, BTN_HEIGHT, CORNER_R);
    this._bg.stroke({ color: 0x555555, width: 1 });
  }
}
