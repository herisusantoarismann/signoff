export interface RectLike {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface Point2D {
  x: number;
  y: number;
}

export interface NormalizedPoint {
  xNorm: number;
  yNorm: number;
}

export type NormalizedSelection =
  | { kind: "point"; xNorm: number; yNorm: number }
  | { kind: "box"; xNorm: number; yNorm: number; wNorm: number; hNorm: number };

export const MIN_BOX_NORM_SIZE = 0.015;
export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 3.0;

/** Clamp a finite number to [0, 1]. Non-finite values default to 0. */
export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

/** Clamp zoom factor within [MIN_ZOOM, MAX_ZOOM]. */
export function clampZoom(scale: number, min = MIN_ZOOM, max = MAX_ZOOM): number {
  if (!Number.isFinite(scale)) return 1;
  return Math.min(max, Math.max(min, Number(scale.toFixed(2))));
}

/**
 * Convert viewport pointer coordinates into [0.0, 1.0] normalized coordinates
 * relative to the rendered canvas rect (which already reflects CSS zoom/pan).
 */
export function clientPointToNormalized(
  clientX: number,
  clientY: number,
  rect: RectLike
): NormalizedPoint {
  if (rect.width <= 0 || rect.height <= 0) {
    return { xNorm: 0, yNorm: 0 };
  }
  return {
    xNorm: clamp01((clientX - rect.left) / rect.width),
    yNorm: clamp01((clientY - rect.top) / rect.height),
  };
}

/**
 * Normalize a pointer drag box across any drag direction (left/up/right/down).
 * Collapses accidental micro-drags smaller than minSize on both axes into a point pin.
 */
export function dragRectToNormalizedBox(
  start: Point2D,
  end: Point2D,
  rect: RectLike,
  minSize = MIN_BOX_NORM_SIZE
): NormalizedSelection {
  const p1 = clientPointToNormalized(start.x, start.y, rect);
  const p2 = clientPointToNormalized(end.x, end.y, rect);

  const round6 = (n: number) => Number(n.toFixed(6));
  const xNorm = round6(Math.min(p1.xNorm, p2.xNorm));
  const yNorm = round6(Math.min(p1.yNorm, p2.yNorm));
  const wNorm = round6(Math.abs(p2.xNorm - p1.xNorm));
  const hNorm = round6(Math.abs(p2.yNorm - p1.yNorm));

  if (wNorm < minSize && hNorm < minSize) {
    return { kind: "point", xNorm: p1.xNorm, yNorm: p1.yNorm };
  }

  return { kind: "box", xNorm, yNorm, wNorm, hNorm };
}

/**
 * Compute subtle pixel nudge offsets for pins placed nearly on the exact same
 * normalized spot so every pin keeps a distinct 44x44px tap target.
 */
export function computePinDisplayOffsets<T extends { id: string; x_norm: number; y_norm: number }>(
  pins: T[],
  proximityThreshold = 0.025
): Record<string, { dx: number; dy: number }> {
  const offsets: Record<string, { dx: number; dy: number }> = {};
  for (let i = 0; i < pins.length; i++) {
    const cur = pins[i];
    let overlapIndex = 0;
    for (let j = 0; j < i; j++) {
      const prev = pins[j];
      const dist = Math.hypot(cur.x_norm - prev.x_norm, cur.y_norm - prev.y_norm);
      if (dist < proximityThreshold) {
        overlapIndex++;
      }
    }
    if (overlapIndex === 0) {
      offsets[cur.id] = { dx: 0, dy: 0 };
    } else {
      const angle = (overlapIndex * 2 * Math.PI) / 6;
      const radius = 16 + Math.floor(overlapIndex / 6) * 12;
      offsets[cur.id] = {
        dx: Math.round(Math.cos(angle) * radius),
        dy: Math.round(Math.sin(angle) * radius),
      };
    }
  }
  return offsets;
}
