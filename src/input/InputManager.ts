import { Graphics } from 'pixi.js';
import type { FocusableItem, NavigationDirection, InputManagerConfig } from './types';
import { findClosestElement, findNextSequential, findPreviousSequential } from './spatialNavigation';

const GAMEPAD_BUTTONS = {
  A: 0,
  DPAD_UP: 12,
  DPAD_DOWN: 13,
  DPAD_LEFT: 14,
  DPAD_RIGHT: 15,
} as const;

const GAMEPAD_AXES = {
  LEFT_STICK_X: 0,
  LEFT_STICK_Y: 1,
} as const;

type InputListener = (focusedId: string | null) => void;

/**
 * Global input manager: keyboard + gamepad navigation + focus state.
 * Pure TS — no React, no DOM focus.
 */
export class InputManager {
  private elements = new Map<string, FocusableItem>();
  private listeners = new Set<InputListener>();
  private _focusedId: string | null = null;

  private enableHaptic: boolean;
  private deadzone: number;
  private navMode: 'spatial' | 'sequential';
  private navDelay: number;

  private prevButtons = new Map<number, boolean>();
  private prevAxisDir: NavigationDirection | null = null;
  private lastNavTime = 0;
  private rafId = 0;

  /** Visual highlight drawn around the focused container. */
  private focusGfx = new Graphics();

  private boundKeyDown = this.onKeyDown.bind(this);
  private boundGamepadConnected = () => { /* no-op, polling detects it */ };
  private boundGamepadDisconnected = () => { /* no-op */ };

  constructor(config?: InputManagerConfig) {
    this.enableHaptic = config?.enableHapticFeedback ?? true;
    this.deadzone = config?.joystickDeadzone ?? 0.5;
    this.navMode = config?.navigationMode ?? 'spatial';
    this.navDelay = config?.navigationDelay ?? 150;

    this.focusGfx.label = 'focus-indicator';

    window.addEventListener('keydown', this.boundKeyDown);
    window.addEventListener('gamepadconnected', this.boundGamepadConnected);
    window.addEventListener('gamepaddisconnected', this.boundGamepadDisconnected);

    this.rafId = requestAnimationFrame(this.pollGamepad);
  }

  // --- Public API ---

  get focusedId(): string | null { return this._focusedId; }

  /** The Graphics object used as focus indicator. Add it to your stage/scene. */
  get focusIndicator(): Graphics { return this.focusGfx; }

  register(item: FocusableItem): void {
    this.elements.set(item.id, item);

    // Auto-focus if nothing focused
    if (this._focusedId === null && !item.disabled) {
      this.setFocus(item.id);
    }
  }

  unregister(id: string): void {
    this.elements.delete(id);
    if (this._focusedId === id) {
      this._focusedId = null;
      this.drawFocusIndicator();
      this.emit();
    }
  }

  unregisterAll(): void {
    this.elements.clear();
    this._focusedId = null;
    this.drawFocusIndicator();
    this.emit();
  }

  setFocus(id: string): void {
    const item = this.elements.get(id);
    if (!item || item.disabled) return;
    this._focusedId = id;
    this.drawFocusIndicator();
    this.triggerHaptic(0.2);
    this.emit();
  }

  onChange(listener: InputListener): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  destroy(): void {
    cancelAnimationFrame(this.rafId);
    window.removeEventListener('keydown', this.boundKeyDown);
    window.removeEventListener('gamepadconnected', this.boundGamepadConnected);
    window.removeEventListener('gamepaddisconnected', this.boundGamepadDisconnected);
    this.elements.clear();
    this.listeners.clear();
    this.focusGfx.destroy();
  }

  // --- Internals ---

  private emit(): void {
    for (const fn of this.listeners) fn(this._focusedId);
  }

  private navigate(direction: NavigationDirection): void {
    const now = Date.now();
    if (now - this.lastNavTime < this.navDelay) return;

    const current = this._focusedId ? this.elements.get(this._focusedId) ?? null : null;

    // Let element handle navigation first
    if (current?.onNavigate?.(direction)) return;

    let next: FocusableItem | null = null;

    if (this.navMode === 'spatial') {
      next = findClosestElement(current, direction, this.elements);
    } else {
      next = (direction === 'down' || direction === 'right')
        ? findNextSequential(this._focusedId, this.elements)
        : findPreviousSequential(this._focusedId, this.elements);
    }

    if (next) {
      this.lastNavTime = now;
      this.setFocus(next.id);
    }
  }

  private activate(): void {
    const item = this._focusedId ? this.elements.get(this._focusedId) : null;
    if (item) {
      this.triggerHaptic(0.5);
      item.onActivate?.();
    }
  }

  private focusNext(): void {
    const next = findNextSequential(this._focusedId, this.elements);
    if (next) this.setFocus(next.id);
  }

  private focusPrevious(): void {
    const prev = findPreviousSequential(this._focusedId, this.elements);
    if (prev) this.setFocus(prev.id);
  }

  // --- Keyboard ---

  private onKeyDown(e: KeyboardEvent): void {
    if (this.elements.size === 0) return;

    switch (e.key) {
      case 'ArrowUp':    e.preventDefault(); this.navigate('up'); break;
      case 'ArrowDown':  e.preventDefault(); this.navigate('down'); break;
      case 'ArrowLeft':  e.preventDefault(); this.navigate('left'); break;
      case 'ArrowRight': e.preventDefault(); this.navigate('right'); break;
      case 'Enter':
      case ' ':          e.preventDefault(); this.activate(); break;
      case 'Tab':
        e.preventDefault();
        if (e.shiftKey) this.focusPrevious();
        else this.focusNext();
        break;
    }
  }

  // --- Gamepad polling ---

  private pollGamepad = (): void => {
    const gamepads = navigator.getGamepads();

    for (let i = 0; i < gamepads.length; i++) {
      const gp = gamepads[i];
      if (!gp) continue;

      this.checkButton(gp, GAMEPAD_BUTTONS.DPAD_UP,    () => this.navigate('up'));
      this.checkButton(gp, GAMEPAD_BUTTONS.DPAD_DOWN,  () => this.navigate('down'));
      this.checkButton(gp, GAMEPAD_BUTTONS.DPAD_LEFT,  () => this.navigate('left'));
      this.checkButton(gp, GAMEPAD_BUTTONS.DPAD_RIGHT, () => this.navigate('right'));
      this.checkButton(gp, GAMEPAD_BUTTONS.A,           () => this.activate());

      this.checkStick(gp);
    }

    this.rafId = requestAnimationFrame(this.pollGamepad);
  };

  private checkButton(gp: Gamepad, idx: number, action: () => void): void {
    const pressed = gp.buttons[idx]?.pressed ?? false;
    const was = this.prevButtons.get(idx) ?? false;
    if (pressed && !was) action();
    this.prevButtons.set(idx, pressed);
  }

  private checkStick(gp: Gamepad): void {
    const x = gp.axes[GAMEPAD_AXES.LEFT_STICK_X] ?? 0;
    const y = gp.axes[GAMEPAD_AXES.LEFT_STICK_Y] ?? 0;

    let dir: NavigationDirection | null = null;

    if (Math.abs(x) > Math.abs(y)) {
      if (x < -this.deadzone) dir = 'left';
      else if (x > this.deadzone) dir = 'right';
    } else {
      if (y < -this.deadzone) dir = 'up';
      else if (y > this.deadzone) dir = 'down';
    }

    if (dir !== this.prevAxisDir) {
      if (dir) this.navigate(dir);
      this.prevAxisDir = dir;
    }
  }

  // --- Haptic feedback ---

  private triggerHaptic(intensity: number): void {
    if (!this.enableHaptic) return;
    try {
      const gamepads = navigator.getGamepads();
      for (let i = 0; i < gamepads.length; i++) {
        const gp = gamepads[i];
        if (!gp) continue;
        const actuator = (gp as unknown as Record<string, unknown>).vibrationActuator;
        if (actuator && typeof (actuator as Record<string, unknown>).playEffect === 'function') {
          (actuator as { playEffect: (type: string, params: Record<string, number>) => Promise<void> })
            .playEffect('dual-rumble', {
              startDelay: 0,
              duration: 50,
              weakMagnitude: intensity,
              strongMagnitude: intensity * 0.7,
            })
            .catch(() => {});
        }
      }
    } catch {
      // Gamepad API unavailable
    }
  }

  // --- Focus indicator ---

  private drawFocusIndicator(): void {
    this.focusGfx.clear();

    if (!this._focusedId) {
      this.focusGfx.visible = false;
      return;
    }

    const item = this.elements.get(this._focusedId);
    if (!item) {
      this.focusGfx.visible = false;
      return;
    }

    const b = item.container.getBounds();
    const pad = 4;

    this.focusGfx.visible = true;
    this.focusGfx.rect(b.x - pad, b.y - pad, b.width + pad * 2, b.height + pad * 2);
    this.focusGfx.stroke({ color: 0x7ED957, width: 3, alpha: 0.9 });
  }
}
