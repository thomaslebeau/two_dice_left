import type { Point, Leaf, VinePath } from "./types";

// ── Seeded PRNG ──────────────────────────────────────────────────

function createRNG(seed: number) {
  let s = Math.abs(Math.floor(seed)) % 2147483646 || 1;
  return (): number => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function range(rng: () => number, min: number, max: number): number {
  return min + rng() * (max - min);
}

// ── Smooth noise (sum of sines) ──────────────────────────────────

function smoothNoise(t: number, seed: number): number {
  return (
    Math.sin(t * 0.3 + seed * 7.13) * 0.5 +
    Math.sin(t * 0.7 + seed * 3.27) * 0.3 +
    Math.sin(t * 1.1 + seed * 11.4) * 0.2
  );
}

// ── Point utilities ──────────────────────────────────────────────

function dist(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function angleBetween(from: Point, to: Point): number {
  return Math.atan2(to.y - from.y, to.x - from.x);
}

// ── Curve sampling (midpoint quadratic Bézier) ──────────────────

function sampleCurve(points: Point[], samplesPerSeg: number = 6): Point[] {
  if (points.length < 2) return [...points];

  if (points.length === 2) {
    const result: Point[] = [];
    for (let i = 0; i <= samplesPerSeg; i++) {
      const t = i / samplesPerSeg;
      result.push({
        x: points[0].x + (points[1].x - points[0].x) * t,
        y: points[0].y + (points[1].y - points[0].y) * t,
      });
    }
    return result;
  }

  const result: Point[] = [{ ...points[0] }];

  for (let i = 1; i < points.length - 1; i++) {
    const start =
      i === 1
        ? points[0]
        : {
            x: (points[i - 1].x + points[i].x) / 2,
            y: (points[i - 1].y + points[i].y) / 2,
          };

    const cp = points[i];

    const end =
      i === points.length - 2
        ? points[points.length - 1]
        : {
            x: (points[i].x + points[i + 1].x) / 2,
            y: (points[i].y + points[i + 1].y) / 2,
          };

    for (let t = 1; t <= samplesPerSeg; t++) {
      const u = t / samplesPerSeg;
      const inv = 1 - u;
      result.push({
        x: inv * inv * start.x + 2 * inv * u * cp.x + u * u * end.x,
        y: inv * inv * start.y + 2 * inv * u * cp.y + u * u * end.y,
      });
    }
  }

  return result;
}

// ── Start point generation ───────────────────────────────────────

interface StartPoint {
  position: Point;
  angle: number;
}

function generateStartPoints(
  w: number,
  h: number,
  count: number,
  rng: () => number
): StartPoint[] {
  const m = 5;
  const points: StartPoint[] = [];

  // All 4 corners
  const corners: StartPoint[] = [
    { position: { x: m, y: m }, angle: Math.PI * 0.25 + range(rng, -0.15, 0.15) },
    { position: { x: w - m, y: m }, angle: Math.PI * 0.75 + range(rng, -0.15, 0.15) },
    { position: { x: m, y: h - m }, angle: -Math.PI * 0.25 + range(rng, -0.15, 0.15) },
    { position: { x: w - m, y: h - m }, angle: -Math.PI * 0.75 + range(rng, -0.15, 0.15) },
  ];

  // Shuffle corners
  for (let i = corners.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [corners[i], corners[j]] = [corners[j], corners[i]];
  }

  // Pick 3-4 corners
  const numCorners = Math.min(count, Math.max(3, Math.floor(count * 0.5)));
  for (let i = 0; i < numCorners && i < corners.length; i++) {
    points.push(corners[i]);
  }

  // Fill remaining from edges
  const edgeGenerators = [
    () => ({
      position: { x: m, y: range(rng, h * 0.15, h * 0.85) },
      angle: range(rng, -0.3, 0.3),
    }),
    () => ({
      position: { x: w - m, y: range(rng, h * 0.15, h * 0.85) },
      angle: Math.PI + range(rng, -0.3, 0.3),
    }),
    () => ({
      position: { x: range(rng, w * 0.15, w * 0.85), y: m },
      angle: Math.PI / 2 + range(rng, -0.3, 0.3),
    }),
    () => ({
      position: { x: range(rng, w * 0.15, w * 0.85), y: h - m },
      angle: -Math.PI / 2 + range(rng, -0.3, 0.3),
    }),
  ];

  for (let i = points.length; i < count; i++) {
    const gen = edgeGenerators[Math.floor(rng() * edgeGenerators.length)];
    points.push(gen());
  }

  return points;
}

// ── Color generation ─────────────────────────────────────────────

function vineColor(rng: () => number): { r: number; g: number; b: number } {
  const t = rng();
  return {
    r: Math.floor(40 + (59 - 40) * t),
    g: Math.floor(85 + (107 - 85) * t),
    b: Math.floor(35 + (53 - 35) * t),
  };
}

function leafColor(rng: () => number): { r: number; g: number; b: number } {
  const t = rng();
  return {
    r: Math.floor(55 + (74 - 55) * t),
    g: Math.floor(100 + (124 - 100) * t),
    b: Math.floor(48 + (64 - 48) * t),
  };
}

// ── Leaf generation ──────────────────────────────────────────────

function generateLeaves(
  samples: Point[],
  depth: number,
  rng: () => number
): Leaf[] {
  const leaves: Leaf[] = [];
  if (samples.length < 8) return leaves;

  // Skip first 30% of path (bare stem near base)
  const startIdx = Math.floor(samples.length * 0.3);
  const avgSpacing = depth === 0 ? 18 : 12;

  for (let i = startIdx; i < samples.length - 2; i++) {
    if (rng() > 1.0 / avgSpacing) continue;

    const prev = samples[Math.max(0, i - 1)];
    const next = samples[Math.min(samples.length - 1, i + 1)];
    const tangent = Math.atan2(next.y - prev.y, next.x - prev.x);

    const side = rng() > 0.5 ? 1 : -1;
    const leafAngle = tangent + side * (Math.PI / 2) + range(rng, -0.35, 0.35);

    leaves.push({
      position: { x: samples[i].x, y: samples[i].y },
      angle: leafAngle,
      size: range(rng, 4, 8),
      opacity: range(rng, 0.55, 0.95),
      pathProgress: i / (samples.length - 1),
      swayPhase: rng() * Math.PI * 2,
      color: leafColor(rng),
    });
  }

  return leaves;
}

// ── Single vine path generation ──────────────────────────────────

function generateVinePath(
  start: Point,
  baseAngle: number,
  depth: number,
  w: number,
  h: number,
  maxDepth: number,
  rng: () => number,
  seed: number,
  parentStartTime: number,
  parentDuration: number,
  parentProgress: number
): VinePath {
  const center = { x: w / 2, y: h / 2 };
  const centerRepulsion = Math.min(w, h) * 0.40;
  const margin = 15;

  // Scale parameters by depth
  const stepLen = depth === 0 ? range(rng, 32, 48) : range(rng, 18, 32);
  const numSteps =
    depth === 0
      ? Math.floor(range(rng, 24, 40))
      : depth === 1
        ? Math.floor(range(rng, 10, 20))
        : Math.floor(range(rng, 6, 12));
  const maxTurn = depth === 0 ? 0.22 : 0.32;

  // Generate guide points via smooth random walk
  const guidePoints: Point[] = [{ ...start }];
  let angle = baseAngle;

  for (let i = 0; i < numSteps; i++) {
    const current = guidePoints[guidePoints.length - 1];

    // Smooth noise steering
    angle += smoothNoise(i * 0.8, seed + depth * 100) * maxTurn;

    // Gentle momentum toward initial direction
    angle -= (angle - baseAngle) * 0.02;

    // Center avoidance
    const dCenter = dist(current, center);
    if (dCenter < centerRepulsion) {
      const away = angleBetween(center, current);
      angle += (away - angle) * (1 - dCenter / centerRepulsion) * 0.5;
    }

    // Screen boundary deflection
    if (current.x < margin && Math.cos(angle) < 0) angle = range(rng, -0.4, 0.4);
    if (current.x > w - margin && Math.cos(angle) > 0)
      angle = Math.PI + range(rng, -0.4, 0.4);
    if (current.y < margin && Math.sin(angle) < 0)
      angle = range(rng, 0.2, Math.PI - 0.2);
    if (current.y > h - margin && Math.sin(angle) > 0)
      angle = range(rng, -Math.PI + 0.2, -0.2);

    const next = {
      x: Math.max(margin, Math.min(w - margin, current.x + Math.cos(angle) * stepLen)),
      y: Math.max(margin, Math.min(h - margin, current.y + Math.sin(angle) * stepLen)),
    };
    guidePoints.push(next);
  }

  // Sample smooth curve
  const samples = sampleCurve(guidePoints, 6);

  // Thickness
  const baseThickness = Math.max(1.5, 8.25 - depth * 2.25);
  const tipThickness = Math.max(0.8, 2.7 - depth * 0.6);

  // Timing
  let startTime: number;
  let growthDuration: number;
  if (depth === 0) {
    startTime = range(rng, 0, 2.5);
    growthDuration = range(rng, 13, 18);
  } else {
    startTime = parentStartTime + parentProgress * parentDuration;
    growthDuration = range(rng, 5, 9);
  }

  // Generate branches
  const children: VinePath[] = [];
  if (depth < maxDepth) {
    const branchCount =
      depth === 0
        ? Math.floor(range(rng, 2, 4))
        : Math.floor(range(rng, 1, 2));

    const branchIndices: number[] = [];
    for (let b = 0; b < branchCount; b++) {
      branchIndices.push(Math.floor(range(rng, numSteps * 0.15, numSteps * 0.85)));
    }
    branchIndices.sort((a, b) => a - b);

    for (const bIdx of branchIndices) {
      if (bIdx >= guidePoints.length - 1) continue;

      const parentDir =
        bIdx < guidePoints.length - 1
          ? angleBetween(guidePoints[bIdx], guidePoints[bIdx + 1])
          : angle;

      const side = rng() > 0.5 ? 1 : -1;
      const branchAngle = parentDir + side * range(rng, 0.35, 0.78);
      const bProgress = bIdx / numSteps;

      const child = generateVinePath(
        guidePoints[bIdx],
        branchAngle,
        depth + 1,
        w,
        h,
        maxDepth,
        rng,
        seed * 13 + bIdx * 7 + depth * 37,
        startTime,
        growthDuration,
        bProgress
      );
      children.push(child);
    }
  }

  // Generate leaves
  const leaves = generateLeaves(samples, depth, rng);

  return {
    samples,
    leaves,
    children,
    depth,
    baseThickness,
    tipThickness,
    startTime,
    growthDuration,
    color: vineColor(rng),
    swayPhase: rng() * Math.PI * 2,
  };
}

// ── Public API ───────────────────────────────────────────────────

export function generateVines(
  width: number,
  height: number,
  vineCount: number = 8,
  maxDepth: number = 2,
  seed: number = 42
): VinePath[] {
  const rng = createRNG(seed);
  const startPoints = generateStartPoints(width, height, vineCount, rng);

  return startPoints.map((sp, i) =>
    generateVinePath(
      sp.position,
      sp.angle,
      0,
      width,
      height,
      maxDepth,
      rng,
      seed * 100 + i * 17,
      0,
      0,
      0
    )
  );
}

/** Recursively find the latest end time across all vines */
export function computeMaxGrowthTime(vines: VinePath[]): number {
  let max = 0;
  function walk(vine: VinePath) {
    const end = vine.startTime + vine.growthDuration;
    if (end > max) max = end;
    for (const child of vine.children) walk(child);
  }
  for (const v of vines) walk(v);
  return max;
}
