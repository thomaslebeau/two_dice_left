/**
 * Creature placeholder — dashed border rectangle filling center space.
 * Shows enemy name and pattern label. Placeholder for future illustrations.
 */

import { Container, Graphics, Text } from 'pixi.js';
import { FONTS } from '../../theme';

// ---------------------------------------------------------------------------
// V6 palette
// ---------------------------------------------------------------------------

const BONE = 0xD9CFBA;
const CHARCOAL = 0x1A1A1A;

// ---------------------------------------------------------------------------
// CreaturePlaceholder
// ---------------------------------------------------------------------------

export class CreaturePlaceholder extends Container {
  private _bg = new Graphics();
  private _nameText: Text;
  private _patternText: Text;
  private _width = 200;
  private _height = 120;

  constructor() {
    super();

    this.addChild(this._bg);

    this._nameText = new Text({
      text: '',
      style: {
        fontFamily: FONTS.HEADING,
        fontSize: 16,
        fontWeight: 'bold',
        fill: BONE,
        letterSpacing: 1,
      },
    });
    this._nameText.anchor.set(0.5);
    this.addChild(this._nameText);

    this._patternText = new Text({
      text: '',
      style: {
        fontFamily: FONTS.BODY,
        fontSize: 16,
        fill: BONE,
      },
    });
    this._patternText.anchor.set(0.5);
    this.addChild(this._patternText);
  }

  setEnemy(name: string, pattern: string, patternColor: number): void {
    this._nameText.text = name;
    this._patternText.text = pattern;
    this._patternText.style.fill = patternColor;
  }

  layout(width: number, height: number): void {
    this._width = width;
    this._height = height;
    this._nameText.position.set(width / 2, height / 2 - 8);
    this._patternText.position.set(width / 2, height / 2 + 10);
    this._drawBg();
  }

  private _drawBg(): void {
    this._bg.clear();
    const w = this._width;
    const h = this._height;

    // Semi-transparent fill
    this._bg.roundRect(0, 0, w, h, 6);
    this._bg.fill({ color: CHARCOAL, alpha: 0.3 });

    // Dashed border
    const dashLen = 6;
    const gapLen = 4;
    for (let i = 0; i < w; i += dashLen + gapLen) {
      const end = Math.min(i + dashLen, w);
      this._bg.moveTo(i, 0).lineTo(end, 0);
      this._bg.moveTo(i, h).lineTo(end, h);
    }
    for (let i = 0; i < h; i += dashLen + gapLen) {
      const end = Math.min(i + dashLen, h);
      this._bg.moveTo(0, i).lineTo(0, end);
      this._bg.moveTo(w, i).lineTo(w, end);
    }
    this._bg.stroke({ color: BONE, width: 1, alpha: 0.2 });
  }
}
