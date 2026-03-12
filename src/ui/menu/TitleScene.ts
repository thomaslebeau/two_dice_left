/**
 * Title screen — "TWO DICE LEFT" with tap-to-continue prompt.
 * Fades out on any input, then invokes onContinue callback.
 */

import { Assets, Container, Sprite, Text } from 'pixi.js';
import type { Scene } from '../../engine/SceneManager';
import { tickerLoop, tickerTween, type TickerHandle } from '../combat/tickerUtils';
import { FONTS } from '../../theme';
import { STRINGS } from '../../data/strings';

// ---------------------------------------------------------------------------
// V6 palette
// ---------------------------------------------------------------------------

const BONE = 0xD9CFBA;
// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PULSE_DURATION_MS = 1500;
const FADE_OUT_MS = 400;

// ---------------------------------------------------------------------------
// TitleScene
// ---------------------------------------------------------------------------

export interface TitleSceneData {
  onContinue: () => void;
}

export class TitleScene extends Container implements Scene {
  private _logo: Sprite | null = null;
  private _prompt: Text;
  private _pulseHandle: TickerHandle | null = null;
  private _onContinue: (() => void) | null = null;
  private _transitioning = false;
  private _keyHandler: ((e: KeyboardEvent) => void) | null = null;
  private _gamepadHandle: TickerHandle | null = null;

  private _sw = 390;
  private _sh = 844;

  constructor() {
    super();

    this._prompt = new Text({
      text: STRINGS.TAP_TO_START,
      style: {
        fontFamily: FONTS.HEADING,
        fontSize: 16,
        fill: BONE,
        letterSpacing: 3,
      },
    });
    this._prompt.anchor.set(0.5);
    this.addChild(this._prompt);

    // Tap/click anywhere
    this.eventMode = 'static';
    this.cursor = 'pointer';
    this.on('pointerdown', this._handleInput, this);
  }

  // -----------------------------------------------------------------------
  // Scene lifecycle
  // -----------------------------------------------------------------------

  onEnter(data?: unknown): void {
    const d = data as TitleSceneData;
    this._onContinue = d.onContinue;
    this._transitioning = false;
    this.alpha = 1;

    const base = import.meta.env.BASE_URL ?? '/';
    void Assets.load(`${base}logo-two-dice-left.png`).then((texture) => {
      this._logo = Sprite.from(texture);
      this._logo.anchor.set(0.5);
      this.addChildAt(this._logo, 0);
      this._layout();
    });

    this._startPulse();
    this._bindKeyboard();
    this._bindGamepad();
  }

  onExit(): void {
    this._stopPulse();
    this._unbindKeyboard();
    this._unbindGamepad();
    this._onContinue = null;
  }

  onResize(w: number, h: number): void {
    this._sw = w;
    this._sh = h;
    this._layout();
  }

  // -----------------------------------------------------------------------
  // Layout
  // -----------------------------------------------------------------------

  private _layout(): void {
    const cx = this._sw / 2;

    // Logo: fit within 70% screen width and 25% screen height
    if (this._logo) {
      this._logo.scale.set(1);
      const natW = this._logo.width;
      const natH = this._logo.height;
      const maxW = this._sw * 0.7;
      const maxH = this._sh * 0.25;
      const scale = Math.min(maxW / natW, maxH / natH);
      this._logo.scale.set(scale);
      this._logo.position.set(cx, this._sh * 0.35);
    }

    this._prompt.position.set(cx, this._sh * 0.75);

    // Hit area covers full screen
    this.hitArea = {
      contains: () => true,
    };
  }

  // -----------------------------------------------------------------------
  // Pulse animation
  // -----------------------------------------------------------------------

  private _startPulse(): void {
    this._stopPulse();
    this._pulseHandle = tickerLoop((elapsed) => {
      // sineInOut oscillation between 0.3 and 1.0
      const t = (elapsed % PULSE_DURATION_MS) / PULSE_DURATION_MS;
      const sine = Math.sin(t * Math.PI * 2);
      this._prompt.alpha = 0.65 + 0.35 * sine;
    });
  }

  private _stopPulse(): void {
    this._pulseHandle?.stop();
    this._pulseHandle = null;
  }

  // -----------------------------------------------------------------------
  // Input handling
  // -----------------------------------------------------------------------

  private _handleInput(): void {
    if (this._transitioning) return;
    this._transitioning = true;
    this._stopPulse();
    this._unbindKeyboard();
    this._unbindGamepad();

    // Fade out then continue
    void tickerTween(FADE_OUT_MS, (t) => {
      this.alpha = 1 - t;
    }).then(() => {
      this._onContinue?.();
    });
  }

  private _bindKeyboard(): void {
    this._keyHandler = () => this._handleInput();
    window.addEventListener('keydown', this._keyHandler);
  }

  private _unbindKeyboard(): void {
    if (this._keyHandler) {
      window.removeEventListener('keydown', this._keyHandler);
      this._keyHandler = null;
    }
  }

  private _bindGamepad(): void {
    this._unbindGamepad();
    this._gamepadHandle = tickerLoop(() => {
      const gamepads = navigator.getGamepads?.() ?? [];
      for (const gp of gamepads) {
        if (!gp) continue;
        if (gp.buttons.some(b => b.pressed)) {
          this._handleInput();
          return;
        }
      }
    });
  }

  private _unbindGamepad(): void {
    this._gamepadHandle?.stop();
    this._gamepadHandle = null;
  }
}
