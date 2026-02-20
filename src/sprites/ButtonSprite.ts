import { Container, Graphics, Text } from 'pixi.js';
import { colors, fonts, spacing } from '@/theme.ts';

const DEFAULT_HEIGHT = 44;
const PADDING_H = spacing.lg;

/**
 * Interactive button sprite with text, hover/press states, and disabled mode.
 */
export class ButtonSprite extends Container {
  private bg = new Graphics();
  private labelText: Text;
  private _enabled = true;
  private _color: number;
  private _width: number;
  private _height: number;

  /** Set this to handle button presses. */
  onPress: (() => void) | null = null;

  constructor(text: string, options?: { width?: number; height?: number; color?: number; fontSize?: number }) {
    super();
    this._color = options?.color ?? colors.primary;
    this._height = options?.height ?? DEFAULT_HEIGHT;

    this.addChild(this.bg);

    this.labelText = new Text({
      text,
      style: {
        fontFamily: fonts.heading,
        fontSize: options?.fontSize ?? fonts.sizes.body,
        fontWeight: 'bold',
        fill: colors.text,
      },
    });
    this.labelText.anchor.set(0.5);
    this.addChild(this.labelText);

    // Compute width from text if not specified
    this._width = options?.width ?? Math.ceil(this.labelText.width + PADDING_H * 2);

    this.labelText.position.set(this._width / 2, this._height / 2);

    this.eventMode = 'static';
    this.cursor = 'pointer';

    this.on('pointerdown', this.handlePress, this);
    this.on('pointerover', this.handleOver, this);
    this.on('pointerout', this.handleOut, this);

    this.draw();
  }

  get buttonWidth(): number { return this._width; }
  get buttonHeight(): number { return this._height; }

  setLabel(text: string): void {
    this.labelText.text = text;
  }

  setEnabled(enabled: boolean): void {
    this._enabled = enabled;
    this.cursor = enabled ? 'pointer' : 'default';
    this.alpha = enabled ? 1 : 0.4;
  }

  private draw(): void {
    this.bg.clear();
    this.bg.rect(0, 0, this._width, this._height);
    this.bg.fill({ color: this._color });
    this.bg.rect(0, 0, this._width, this._height);
    this.bg.stroke({ color: colors.playerAccent, width: 2 });
  }

  private handlePress(): void {
    if (!this._enabled) return;
    this.onPress?.();
  }

  private handleOver(): void {
    if (!this._enabled) return;
    this.alpha = 0.85;
  }

  private handleOut(): void {
    this.alpha = this._enabled ? 1 : 0.4;
  }
}
