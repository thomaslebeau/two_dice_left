/**
 * Small "AJUSTER" button for Recycleur passive.
 * Positioned to the right of the pulsing die.
 * Manages die pulse loop + flip animation on activate.
 */

import { Container, Graphics, Text } from 'pixi.js';
import { tickerTween, tickerLoop, type TickerHandle } from './tickerUtils';
import { timings, FONTS } from '../../theme';
import type { DiceSprite } from './DiceSprite';

const BONE = 0xD9CFBA, RUST = 0x8B3A1A;
const BTN_W = 80, BTN_H = 48;

export class RecycleurButton extends Container {
  private _bg = new Graphics();
  private _text: Text;
  private _pulseHandle: TickerHandle | null = null;
  onActivate: (() => void) | null = null;

  constructor() {
    super();
    this._bg.roundRect(0, 0, BTN_W, BTN_H, 3);
    this._bg.fill({ color: 0x1A1A1A, alpha: 0.9 });
    this._bg.roundRect(0, 0, BTN_W, BTN_H, 3);
    this._bg.stroke({ color: RUST, width: 2 });
    this.addChild(this._bg);

    this._text = new Text({
      text: 'AJUSTER',
      style: {
        fontFamily: FONTS.HEADING, fontSize: 14,
        fontWeight: 'bold', fill: BONE, letterSpacing: 1,
      },
    });
    this._text.anchor.set(0.5);
    this._text.position.set(BTN_W / 2, BTN_H / 2);
    this.addChild(this._text);

    this.eventMode = 'static';
    this.cursor = 'pointer';
    this.on('pointerdown', () => this.onActivate?.());
    this.visible = false;
  }

  /** Fade in at position, start pulsing the target die. */
  show(x: number, y: number, die: DiceSprite): void {
    this.position.set(x, y);
    this.alpha = 0;
    this.visible = true;
    void tickerTween(200, (t) => { this.alpha = t; });
    this._startPulse(die);
  }

  /** Fade out and stop die pulse. */
  hide(): void {
    this._stopPulse();
    if (!this.visible) return;
    void tickerTween(200, (t) => { this.alpha = 1 - t; })
      .then(() => { this.visible = false; });
  }

  /** Play die flip animation: scaleX 1→0, setValue(2), 0→1, moss flash. */
  async playFlip(die: DiceSprite): Promise<void> {
    this._stopPulse();
    const half = timings.recycleurSpinDuration / 2;
    // Squeeze to 0
    await tickerTween(half, (t) => { die.scale.x = 1 - t; });
    die.setValue(2);
    // Expand with easeOutBack
    await tickerTween(half, (t) => {
      const c1 = 1.70158;
      const c3 = c1 + 1;
      die.scale.x = 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    });
    die.scale.x = 1;
    // Moss border flash
    await tickerTween(timings.passiveGlowDuration, (_t) => {
      // DiceSprite handles its own glow; this is a visual marker
    });
  }

  private _startPulse(die: DiceSprite): void {
    this._stopPulse();
    this._pulseHandle = tickerLoop((elapsed) => {
      const s = 1 + 0.06 * Math.sin(elapsed / 200);
      die.scale.set(s);
    });
  }

  private _stopPulse(): void {
    this._pulseHandle?.stop();
    this._pulseHandle = null;
  }

  destroy(): void {
    this._stopPulse();
    super.destroy({ children: true });
  }
}
