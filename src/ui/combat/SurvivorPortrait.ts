/**
 * Diegetic survivor portrait — metal circle frame with rivets
 * and survivor name. Badge HP is managed by PlayerZone directly.
 * Matches LootPlank iron aesthetic.
 */

import { Container, Graphics, Text } from 'pixi.js';
import { FONTS } from '../../theme';

const IRON_FILL = 0x3A3A3A;
const IRON_BORDER = 0x555555;
const INNER_RING = 0x888888;
const RIVET_FILL = 0x888888;
const RIVET_SHADOW = 0x555555;
const BONE = 0xD9CFBA;
const CHARCOAL = 0x1A1A1A;

const FRAME_RADIUS = 38;
const RIVET_R = 3;
const RIVET_INNER = 2.5;

export class SurvivorPortrait extends Container {
  private _nameText: Text;
  private _frame = new Graphics();

  constructor() {
    super();

    this.addChild(this._frame);
    this._drawFrame();

    // Name below frame
    this._nameText = new Text({
      text: '',
      style: {
        fontFamily: FONTS.BODY, fontSize: 14,
        fill: BONE, align: 'center',
      },
    });
    this._nameText.anchor.set(0.5, 0);
    this.addChild(this._nameText);
  }

  setName(name: string): void {
    this._nameText.text = name;
  }

  layout(_availHeight: number): void {
    const cx = FRAME_RADIUS + 4;

    // Frame centered
    this._frame.position.set(cx, FRAME_RADIUS + 4);

    // Name below frame
    this._nameText.position.set(cx, FRAME_RADIUS * 2 + 10);
  }

  private _drawFrame(): void {
    const g = this._frame;
    g.clear();

    // Outer circle
    g.circle(0, 0, FRAME_RADIUS);
    g.fill(IRON_FILL);
    g.circle(0, 0, FRAME_RADIUS);
    g.stroke({ color: IRON_BORDER, width: 3 });

    // Inner ring
    g.circle(0, 0, FRAME_RADIUS - 6);
    g.stroke({ color: INNER_RING, width: 2 });

    // Inner fill (dark bg for portrait area)
    g.circle(0, 0, FRAME_RADIUS - 8);
    g.fill(CHARCOAL);

    // 4 rivets at N/S/E/W
    const offsets = [
      [0, -(FRAME_RADIUS - 4)],
      [0, FRAME_RADIUS - 4],
      [FRAME_RADIUS - 4, 0],
      [-(FRAME_RADIUS - 4), 0],
    ];
    for (const [rx, ry] of offsets) {
      g.circle(rx, ry, RIVET_R);
      g.fill(RIVET_SHADOW);
      g.circle(rx - 0.5, ry - 0.5, RIVET_INNER);
      g.fill(RIVET_FILL);
    }
  }
}
