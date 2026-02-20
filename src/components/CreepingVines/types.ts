export interface Point {
  x: number;
  y: number;
}

export interface Leaf {
  position: Point;
  angle: number;
  size: number;
  opacity: number;
  /** Position along parent vine (0-1) */
  pathProgress: number;
  /** Random phase offset for idle sway */
  swayPhase: number;
  color: { r: number; g: number; b: number };
}

export interface VinePath {
  /** Pre-sampled smooth curve points */
  samples: Point[];
  leaves: Leaf[];
  children: VinePath[];
  depth: number;
  baseThickness: number;
  tipThickness: number;
  /** Absolute time (seconds) when growth begins */
  startTime: number;
  /** Duration (seconds) for this vine's growth */
  growthDuration: number;
  color: { r: number; g: number; b: number };
  /** Random phase for idle sway */
  swayPhase: number;
}
