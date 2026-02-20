import type { Point, Leaf, VinePath } from "./types";

// ── Helpers ──────────────────────────────────────────────────────

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

// ── Background ───────────────────────────────────────────────────

function drawBackground(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number
) {
  const grad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.7);
  grad.addColorStop(0, "#101010");
  grad.addColorStop(1, "#0A0A0A");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
}

// ── Vine polygon drawing (tapered fill) ──────────────────────────

function drawVinePolygon(
  ctx: CanvasRenderingContext2D,
  vine: VinePath,
  progress: number,
  time: number,
  isIdle: boolean
) {
  const { samples, baseThickness, tipThickness, color, swayPhase } = vine;
  const visibleCount = Math.max(2, Math.floor(samples.length * clamp01(progress)));

  if (visibleCount < 2) return;

  const leftEdge: Point[] = [];
  const rightEdge: Point[] = [];

  for (let i = 0; i < visibleCount; i++) {
    const t = i / Math.max(1, samples.length - 1);
    let thickness = baseThickness + (tipThickness - baseThickness) * t;

    // Extra taper at the growing tip (last 6 samples)
    const tipDist = visibleCount - 1 - i;
    if (tipDist < 6) {
      thickness *= tipDist / 6;
    }
    thickness = Math.max(0.25, thickness);

    // Smooth tangent using a wider window
    const lo = Math.max(0, i - 2);
    const hi = Math.min(visibleCount - 1, i + 2);
    const dx = samples[hi].x - samples[lo].x;
    const dy = samples[hi].y - samples[lo].y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;

    let px = samples[i].x;
    let py = samples[i].y;

    // Idle sway on thin tips
    if (isIdle && t > 0.75) {
      const swayStr = (t - 0.75) / 0.25;
      const amp = swayStr * 1.8;
      px += Math.sin(time * 0.45 + swayPhase + i * 0.04) * amp;
      py += Math.cos(time * 0.3 + swayPhase + i * 0.06) * amp * 0.5;
    }

    const halfW = thickness / 2;
    leftEdge.push({ x: px + nx * halfW, y: py + ny * halfW });
    rightEdge.push({ x: px - nx * halfW, y: py - ny * halfW });
  }

  // Opacity by depth
  const opacity = vine.depth === 0 ? 0.88 : vine.depth === 1 ? 0.75 : 0.6;

  const { r, g, b } = color;
  ctx.fillStyle = `rgba(${r},${g},${b},${opacity})`;
  ctx.beginPath();

  // Left edge forward
  ctx.moveTo(leftEdge[0].x, leftEdge[0].y);
  for (let i = 1; i < leftEdge.length; i++) {
    ctx.lineTo(leftEdge[i].x, leftEdge[i].y);
  }
  // Converge to tip point
  const tipL = leftEdge[leftEdge.length - 1];
  const tipR = rightEdge[rightEdge.length - 1];
  ctx.lineTo((tipL.x + tipR.x) / 2, (tipL.y + tipR.y) / 2);

  // Right edge backward
  for (let i = rightEdge.length - 1; i >= 0; i--) {
    ctx.lineTo(rightEdge[i].x, rightEdge[i].y);
  }

  ctx.closePath();
  ctx.fill();
}

// ── Leaf drawing ─────────────────────────────────────────────────

function drawLeaf(
  ctx: CanvasRenderingContext2D,
  leaf: Leaf,
  vineProgress: number,
  time: number,
  isIdle: boolean
) {
  if (vineProgress < leaf.pathProgress) return;

  // Fade in as vine passes
  const fadeIn = clamp01((vineProgress - leaf.pathProgress) / 0.08);
  const alpha = leaf.opacity * fadeIn;
  if (alpha < 0.02) return;

  let swayX = 0;
  let swayY = 0;
  let swayRot = 0;

  if (isIdle) {
    const amp = 1.5;
    swayX = Math.sin(time * 0.55 + leaf.swayPhase) * amp;
    swayY = Math.cos(time * 0.4 + leaf.swayPhase) * amp * 0.5;
    swayRot = Math.sin(time * 0.3 + leaf.swayPhase) * 0.06;
  }

  const { r, g, b } = leaf.color;
  const s = leaf.size;

  ctx.save();
  ctx.translate(leaf.position.x + swayX, leaf.position.y + swayY);
  ctx.rotate(leaf.angle + swayRot);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = `rgb(${r},${g},${b})`;

  // Teardrop / pointed oval
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(s * 0.45, -s * 0.32, s, 0);
  ctx.quadraticCurveTo(s * 0.45, s * 0.32, 0, 0);
  ctx.fill();

  ctx.restore();
}

// ── Recursive vine tree drawing ──────────────────────────────────

function drawVineTree(
  ctx: CanvasRenderingContext2D,
  vine: VinePath,
  elapsed: number,
  time: number,
  isIdle: boolean
) {
  const vineElapsed = elapsed - vine.startTime;
  if (vineElapsed <= 0) return;

  const progress = clamp01(vineElapsed / vine.growthDuration);

  // Draw this vine
  drawVinePolygon(ctx, vine, progress, time, isIdle);

  // Draw leaves
  for (const leaf of vine.leaves) {
    drawLeaf(ctx, leaf, progress, time, isIdle);
  }

  // Draw children
  for (const child of vine.children) {
    drawVineTree(ctx, child, elapsed, time, isIdle);
  }
}

// ── Public: draw one full frame ──────────────────────────────────

export function drawFrame(
  ctx: CanvasRenderingContext2D,
  vines: VinePath[],
  elapsed: number,
  time: number,
  width: number,
  height: number,
  maxGrowthTime: number
) {
  const isIdle = elapsed > maxGrowthTime;

  ctx.clearRect(0, 0, width, height);
  drawBackground(ctx, width, height);

  for (const vine of vines) {
    drawVineTree(ctx, vine, elapsed, time, isIdle);
  }
}
