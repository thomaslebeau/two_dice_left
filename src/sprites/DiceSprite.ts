import { Container, Graphics, Text } from 'pixi.js';
import { colors, fonts } from '@/theme.ts';

export const DICE_SIZE = 80;

const ROLL_CONFIG = {
  totalDuration: 2000,
  startSpeed: 50,
  slowPoint1: 0.5,
  slowSpeed1: 100,
  slowPoint2: 0.7,
  slowSpeed2: 150,
  stopPoint: 0.95,
};

/**
 * A single animated dice that shows a slot-machine rolling effect
 * then stops on a final value.
 */
export class DiceSprite extends Container {
  private bg = new Graphics();
  private valueText: Text;
  private isPlayer: boolean;
  private timerId: ReturnType<typeof setTimeout> | null = null;
  private startTime = 0;
  private _finalValue = 1;

  constructor(isPlayer: boolean) {
    super();
    this.isPlayer = isPlayer;

    this.addChild(this.bg);

    this.valueText = new Text({
      text: '?',
      style: {
        fontFamily: fonts.heading,
        fontSize: 36,
        fontWeight: 'bold',
        fill: 0xffffff,
      },
    });
    this.valueText.anchor.set(0.5);
    this.valueText.position.set(DICE_SIZE / 2, DICE_SIZE / 2);
    this.addChild(this.valueText);

    this.drawBg();
  }

  /** Start a new roll animation that lands on the given value. */
  roll(finalValue: number): void {
    this.stopAnimation();
    this._finalValue = finalValue;
    this.startTime = Date.now();
    this.alpha = 0.6;
    this.scheduleNext(ROLL_CONFIG.startSpeed);
  }

  /** Immediately show a value without animation. */
  setValue(value: number): void {
    this.stopAnimation();
    this._finalValue = value;
    this.valueText.text = String(value);
    this.alpha = 1;
  }

  destroy(): void {
    this.stopAnimation();
    super.destroy();
  }

  private drawBg(): void {
    const fillColor = this.isPlayer ? colors.player : colors.enemy;
    const strokeColor = this.isPlayer ? colors.playerAccent : colors.enemyAccent;

    this.bg.clear();
    this.bg.rect(0, 0, DICE_SIZE, DICE_SIZE);
    this.bg.fill({ color: fillColor });
    this.bg.rect(0, 0, DICE_SIZE, DICE_SIZE);
    this.bg.stroke({ color: strokeColor, width: 3 });
  }

  private scheduleNext(speed: number): void {
    this.timerId = setTimeout(() => {
      const elapsed = Date.now() - this.startTime;
      const progress = elapsed / ROLL_CONFIG.totalDuration;

      if (progress >= ROLL_CONFIG.stopPoint) {
        // Stop — show final value
        this.valueText.text = String(this._finalValue);
        this.alpha = 1;
        this.timerId = null;
        return;
      }

      // Show random value
      this.valueText.text = String(Math.floor(Math.random() * 6) + 1);

      // Calculate next speed based on progress
      let nextSpeed = ROLL_CONFIG.startSpeed;
      if (progress >= ROLL_CONFIG.slowPoint2) {
        nextSpeed = ROLL_CONFIG.slowSpeed2;
      } else if (progress >= ROLL_CONFIG.slowPoint1) {
        nextSpeed = ROLL_CONFIG.slowSpeed1;
      }

      this.scheduleNext(nextSpeed);
    }, speed);
  }

  private stopAnimation(): void {
    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
  }
}
