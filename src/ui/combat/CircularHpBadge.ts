/**
 * Circular HP badge — 60px diameter arc display for the player.
 * Arc depletes clockwise from 12 o'clock. Color transitions by HP%.
 * Includes optional poison badge below the circle.
 */

import { Container, Graphics, Text } from 'pixi.js';
import { tickerWait, tickerSteps } from './tickerUtils';

// ---------------------------------------------------------------------------
// V6 palette
// ---------------------------------------------------------------------------

const BONE = 0xD9CFBA;
const MOSS = 0x2D4A2E;
const BLOOD = 0x6B1C1C;
const ORANGE = 0xCC8833;
const VENOM = 0x7B2D8B;
const CHARCOAL = 0x1A1A1A;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const BADGE_DIAMETER = 60;
const RADIUS = BADGE_DIAMETER / 2;
const ARC_WIDTH = 4;
const BG_ALPHA = 0.85;

// ---------------------------------------------------------------------------
// CircularHpBadge
// ---------------------------------------------------------------------------

export class CircularHpBadge extends Container {
  private _bgCircle = new Graphics();
  private _arcGraphics = new Graphics();
  private _hpText: Text;
  private _poisonBadge = new Container();
  private _poisonBg = new Graphics();
  private _poisonLabel: Text;

  private _currentHp = 0;
  private _maxHp = 1;

  constructor() {
    super();

    this.addChild(this._bgCircle);
    this.addChild(this._arcGraphics);

    this._hpText = new Text({
      text: '',
      style: {
        fontFamily: '"Courier New", monospace',
        fontSize: 18,
        fontWeight: 'bold',
        fill: BONE,
      },
    });
    this._hpText.anchor.set(0.5);
    this._hpText.position.set(RADIUS, RADIUS);
    this.addChild(this._hpText);

    // Poison badge below circle
    this._poisonBadge.visible = false;
    this._poisonBadge.addChild(this._poisonBg);
    this._poisonLabel = new Text({
      text: '',
      style: {
        fontFamily: '"Courier New", monospace',
        fontSize: 9,
        fontWeight: 'bold',
        fill: BONE,
      },
    });
    this._poisonLabel.anchor.set(0.5, 0);
    this._poisonLabel.position.set(RADIUS, 0);
    this._poisonBadge.addChild(this._poisonLabel);
    this._poisonBadge.position.set(0, BADGE_DIAMETER + 2);
    this.addChild(this._poisonBadge);

    this._drawBg();
  }

  /** The arc Graphics — for ResolutionAnimation compatibility. */
  get hpFillGraphics(): Graphics { return this._arcGraphics; }

  get currentHp(): number { return this._currentHp; }
  get maxHp(): number { return this._maxHp; }

  // -----------------------------------------------------------------------
  // HP
  // -----------------------------------------------------------------------

  updateHp(current: number, max: number): void {
    this._currentHp = current;
    this._maxHp = max;
    this._hpText.text = `${current}`;
    this._drawArc(current, max);
  }

  // -----------------------------------------------------------------------
  // Poison
  // -----------------------------------------------------------------------

  setPoisonTurns(turns: number): void {
    if (turns <= 0) {
      this._poisonBadge.visible = false;
      return;
    }
    this._poisonBadge.visible = true;
    this._poisonLabel.text = `\u2620 ${turns}t`;
    this._redrawPoisonBg();
  }

  showPoisonStack(before: number, after: number): void {
    if (after <= 0) return;
    this._poisonBadge.visible = true;
    this._poisonLabel.text = `\u2620 ${before}\u2192${after}t`;
    this._redrawPoisonBg();
    void tickerWait(800).then(() => {
      if (after <= 0) { this._poisonBadge.visible = false; return; }
      this._poisonLabel.text = `\u2620 ${after}t`;
      this._redrawPoisonBg();
    });
  }

  pulsePoisonBadge(): void {
    if (!this._poisonBadge.visible) return;
    this._poisonBadge.alpha = 1;
    void tickerSteps(6, 80, (step) => {
      this._poisonBadge.alpha = step % 2 === 0 ? 1 : 0.3;
    }).then(() => { this._poisonBadge.alpha = 1; });
  }

  // -----------------------------------------------------------------------
  // Drawing
  // -----------------------------------------------------------------------

  private _drawBg(): void {
    this._bgCircle.clear();
    this._bgCircle.circle(RADIUS, RADIUS, RADIUS);
    this._bgCircle.fill({ color: CHARCOAL, alpha: BG_ALPHA });
    this._bgCircle.circle(RADIUS, RADIUS, RADIUS);
    this._bgCircle.stroke({ color: 0x333333, width: 1 });
  }

  private _drawArc(current: number, max: number): void {
    this._arcGraphics.clear();
    const pct = Math.max(0, Math.min(1, current / max));
    if (pct <= 0) return;

    const color = this._hpColor(pct);
    const startAngle = -Math.PI / 2;
    const endAngle = startAngle + pct * Math.PI * 2;

    this._arcGraphics.arc(
      RADIUS, RADIUS, RADIUS - ARC_WIDTH / 2,
      startAngle, endAngle,
    );
    this._arcGraphics.stroke({ color, width: ARC_WIDTH });
  }

  private _hpColor(pct: number): number {
    if (pct > 0.6) return MOSS;
    if (pct > 0.3) return ORANGE;
    return BLOOD;
  }

  private _redrawPoisonBg(): void {
    this._poisonBg.clear();
    const w = Math.max(BADGE_DIAMETER, 40);
    this._poisonBg.roundRect(0, 0, w, 16, 4);
    this._poisonBg.fill({ color: VENOM, alpha: 0.85 });
    this._poisonLabel.position.set(w / 2, 2);
  }
}
