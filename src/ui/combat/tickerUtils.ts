/**
 * Ticker-based timing utilities — replaces setTimeout/setInterval
 * with frame-synced equivalents driven by Pixi's shared Ticker.
 *
 * All animations pause when the tab is hidden (Ticker stops),
 * avoiding drift and wasted CPU.
 */

import { Ticker } from 'pixi.js';

/**
 * Promise that resolves after `ms` milliseconds of Ticker time.
 * Replaces `await new Promise(r => setTimeout(r, ms))`.
 */
export function tickerWait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    let elapsed = 0;
    const cb = (ticker: Ticker): void => {
      elapsed += ticker.deltaMS;
      if (elapsed >= ms) {
        Ticker.shared.remove(cb);
        resolve();
      }
    };
    Ticker.shared.add(cb);
  });
}

/**
 * Run a stepped animation over `durationMs`, calling `onStep(t)`
 * each frame with t in [0, 1]. Resolves when complete.
 */
export function tickerTween(
  durationMs: number,
  onStep: (t: number) => void,
): Promise<void> {
  return new Promise((resolve) => {
    let elapsed = 0;
    const cb = (ticker: Ticker): void => {
      elapsed += ticker.deltaMS;
      const t = Math.min(1, elapsed / durationMs);
      onStep(t);
      if (t >= 1) {
        Ticker.shared.remove(cb);
        resolve();
      }
    };
    Ticker.shared.add(cb);
  });
}

/** Callback handle for cancellable ticker loops. */
export interface TickerHandle {
  stop(): void;
}

/**
 * Run `onTick(elapsedMs)` every frame until stopped.
 * Returns a handle with stop(). Replaces setInterval.
 */
export function tickerLoop(
  onTick: (elapsedMs: number) => void,
): TickerHandle {
  let elapsed = 0;
  const cb = (ticker: Ticker): void => {
    elapsed += ticker.deltaMS;
    onTick(elapsed);
  };
  Ticker.shared.add(cb);
  return { stop: () => Ticker.shared.remove(cb) };
}

/**
 * Run a stepped animation: calls `onStep(step)` at intervals of
 * `intervalMs`, for `steps` total steps. Resolves when done.
 * Replaces setInterval-based step counters.
 */
export function tickerSteps(
  steps: number,
  intervalMs: number,
  onStep: (step: number) => void,
): Promise<void> {
  return new Promise((resolve) => {
    let elapsed = 0;
    let step = 0;
    const cb = (ticker: Ticker): void => {
      elapsed += ticker.deltaMS;
      while (elapsed >= intervalMs && step < steps) {
        elapsed -= intervalMs;
        step++;
        onStep(step);
      }
      if (step >= steps) {
        Ticker.shared.remove(cb);
        resolve();
      }
    };
    Ticker.shared.add(cb);
  });
}
