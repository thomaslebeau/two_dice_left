/**
 * Compact survivor portrait — metal circle frame with survivor initial.
 * Sized for placement above the toolbox (64px diameter).
 */

import { Container, Graphics, Text } from 'pixi.js';
import { FONTS } from '../../theme';

const IRON_FILL = 0x3A3A3A;
const IRON_BORDER = 0x555555;
const INNER_RING = 0x888888;
const BONE = 0xD9CFBA;
const CHARCOAL = 0x1A1A1A;

const FRAME_RADIUS = 28;

export class SurvivorPortrait extends Container {
  private _frame = new Graphics();
  private _initial: Text;

  constructor() {
    super();
    this.addChild(this._frame);
    this._drawFrame();

    this._initial = new Text({
      text: '',
      style: {
        fontFamily: FONTS.HEADING, fontSize: 22,
        fontWeight: 'bold', fill: BONE,
      },
    });
    this._initial.anchor.set(0.5);
    this.addChild(this._initial);
  }

  setName(name: string): void {
    this._initial.text = name.charAt(0).toUpperCase();
  }

  /** Position frame centered at (0,0). */
  layout(): void {
    this._frame.position.set(0, 0);
    this._initial.position.set(0, 0);
  }

  get diameter(): number { return FRAME_RADIUS * 2; }

  private _drawFrame(): void {
    const g = this._frame;
    g.clear();
    g.circle(0, 0, FRAME_RADIUS);
    g.fill(IRON_FILL);
    g.circle(0, 0, FRAME_RADIUS);
    g.stroke({ color: IRON_BORDER, width: 2 });
    g.circle(0, 0, FRAME_RADIUS - 5);
    g.stroke({ color: INNER_RING, width: 1 });
    g.circle(0, 0, FRAME_RADIUS - 7);
    g.fill(CHARCOAL);
  }
}
