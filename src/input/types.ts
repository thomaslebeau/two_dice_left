import type { Container } from 'pixi.js';

export type NavigationDirection = 'up' | 'down' | 'left' | 'right';

/**
 * Simple rectangle matching what Pixi's getBounds() returns.
 */
export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * A focusable element registered with the InputManager.
 */
export interface FocusableItem {
  id: string;
  container: Container;
  group?: string;
  disabled?: boolean;
  priority?: number;
  onActivate?: () => void;
  /** Return true to prevent default navigation. */
  onNavigate?: (direction: NavigationDirection) => boolean;
}

export interface InputManagerConfig {
  enableHapticFeedback?: boolean;
  joystickDeadzone?: number;
  navigationMode?: 'spatial' | 'sequential';
  navigationDelay?: number;
}
