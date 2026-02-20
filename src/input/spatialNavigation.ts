import type { FocusableItem, NavigationDirection, Bounds } from './types';

/**
 * Get screen-space bounds for a focusable item.
 */
function getBounds(item: FocusableItem): Bounds {
  const b = item.container.getBounds();
  return { x: b.x, y: b.y, width: b.width, height: b.height };
}

function center(b: Bounds): { x: number; y: number } {
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

/**
 * Check if target is in the given direction from source.
 */
function isInDirection(from: Bounds, to: Bounds, direction: NavigationDirection): boolean {
  const fc = center(from);
  const tc = center(to);

  const dx = tc.x - fc.x;
  const dy = tc.y - fc.y;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);

  // ~63° cone from the primary axis
  const TOLERANCE = 0.5;

  switch (direction) {
    case 'up':    return dy < 0 && absDy >= absDx * TOLERANCE;
    case 'down':  return dy > 0 && absDy >= absDx * TOLERANCE;
    case 'left':  return dx < 0 && absDx >= absDy * TOLERANCE;
    case 'right': return dx > 0 && absDx >= absDy * TOLERANCE;
  }
}

function calculateOverlap(s1: number, e1: number, s2: number, e2: number): number {
  return Math.max(0, Math.min(e1, e2) - Math.max(s1, s2));
}

function navigationScore(from: FocusableItem, to: FocusableItem, direction: NavigationDirection): number {
  const fb = getBounds(from);
  const tb = getBounds(to);
  const fc = center(fb);
  const tc = center(tb);

  let primary: number;
  let secondary: number;

  if (direction === 'up' || direction === 'down') {
    primary = Math.abs(tc.y - fc.y);
    secondary = Math.abs(tc.x - fc.x);

    if (calculateOverlap(fb.x, fb.x + fb.width, tb.x, tb.x + tb.width) > 0) {
      secondary *= 0.3;
    }
  } else {
    primary = Math.abs(tc.x - fc.x);
    secondary = Math.abs(tc.y - fc.y);

    if (calculateOverlap(fb.y, fb.y + fb.height, tb.y, tb.y + tb.height) > 0) {
      secondary *= 0.3;
    }
  }

  return primary * 3 + secondary * 0.3;
}

/**
 * Find the closest element in a given direction using spatial navigation.
 */
export function findClosestElement(
  from: FocusableItem | null,
  direction: NavigationDirection,
  elements: Map<string, FocusableItem>,
): FocusableItem | null {
  const all = Array.from(elements.values()).filter(el => !el.disabled);
  if (all.length === 0) return null;

  if (!from) {
    return all.reduce((best, cur) =>
      (cur.priority ?? 0) > (best.priority ?? 0) ? cur : best,
    all[0]);
  }

  const fromBounds = getBounds(from);
  const candidates = all.filter(el =>
    el.id !== from.id && isInDirection(fromBounds, getBounds(el), direction),
  );

  if (candidates.length === 0) return null;

  return candidates.reduce((closest, candidate) =>
    navigationScore(from, candidate, direction) < navigationScore(from, closest, direction)
      ? candidate
      : closest,
  );
}

function getSequentialElements(elements: Map<string, FocusableItem>): FocusableItem[] {
  return Array.from(elements.values())
    .filter(el => !el.disabled)
    .sort((a, b) => {
      const pa = a.priority ?? 0;
      const pb = b.priority ?? 0;
      if (pa !== pb) return pb - pa;

      const ab = getBounds(a);
      const bb = getBounds(b);
      if (Math.abs(ab.y - bb.y) > 5) return ab.y - bb.y;
      return ab.x - bb.x;
    });
}

export function findNextSequential(
  currentId: string | null,
  elements: Map<string, FocusableItem>,
): FocusableItem | null {
  const seq = getSequentialElements(elements);
  if (seq.length === 0) return null;
  if (!currentId) return seq[0];

  const idx = seq.findIndex(el => el.id === currentId);
  if (idx === -1) return seq[0];
  return seq[(idx + 1) % seq.length];
}

export function findPreviousSequential(
  currentId: string | null,
  elements: Map<string, FocusableItem>,
): FocusableItem | null {
  const seq = getSequentialElements(elements);
  if (seq.length === 0) return null;
  if (!currentId) return seq[0];

  const idx = seq.findIndex(el => el.id === currentId);
  if (idx === -1) return seq[0];
  return seq[(idx - 1 + seq.length) % seq.length];
}
