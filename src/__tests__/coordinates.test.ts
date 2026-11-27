import { describe, expect, it } from "vitest";
import {
  MIN_BOX_NORM_SIZE,
  clamp01,
  clampZoom,
  clientPointToNormalized,
  computePinDisplayOffsets,
  dragRectToNormalizedBox,
} from "@/lib/canvas/coordinates";

describe("coordinates math (positive, negative, & anomaly cases)", () => {
  it("clamps finite, out-of-bounds, negative-zero, NaN, and Infinity values into [0, 1]", () => {
    expect(clamp01(-0.25)).toBe(0);
    expect(clamp01(-1e9)).toBe(0);
    expect(clamp01(-0)).toBe(0);
    expect(clamp01(0)).toBe(0);
    expect(clamp01(0.37)).toBe(0.37);
    expect(clamp01(1)).toBe(1);
    expect(clamp01(1.42)).toBe(1);
    expect(clamp01(1e9)).toBe(1);
    expect(clamp01(Number.NaN)).toBe(0);
    expect(clamp01(Number.POSITIVE_INFINITY)).toBe(0);
    expect(clamp01(Number.NEGATIVE_INFINITY)).toBe(0);
  });

  it("handles zero, negative, and NaN rect dimensions without throwing or returning NaN", () => {
    expect(clientPointToNormalized(150, 200, { left: 0, top: 0, width: 0, height: 0 })).toEqual({
      xNorm: 0,
      yNorm: 0,
    });
    expect(clientPointToNormalized(150, 200, { left: 0, top: 0, width: -500, height: 100 })).toEqual({
      xNorm: 0,
      yNorm: 0,
    });
    expect(clientPointToNormalized(150, 200, { left: 0, top: 0, width: Number.NaN, height: 200 })).toEqual({
      xNorm: 0,
      yNorm: 1,
    });
    expect(clientPointToNormalized(Number.NaN, Number.POSITIVE_INFINITY, { left: 0, top: 0, width: 800, height: 600 })).toEqual({
      xNorm: 0,
      yNorm: 0,
    });
  });

  it("converts pointer coordinates accurately even when canvas rect is scrolled off-screen (negative top/left)", () => {
    const scrolledRect = { left: -200, top: -100, width: 800, height: 400 };
    expect(clientPointToNormalized(200, 100, scrolledRect)).toEqual({ xNorm: 0.5, yNorm: 0.5 });
    expect(clientPointToNormalized(-9999, -9999, scrolledRect)).toEqual({ xNorm: 0, yNorm: 0 });
    expect(clientPointToNormalized(9999, 9999, scrolledRect)).toEqual({ xNorm: 1, yNorm: 1 });
  });

  it("normalizes area boxes across all 4 drag directions and absurd outside-canvas drags", () => {
    const rect = { left: 0, top: 0, width: 1000, height: 500 };

    // Bottom-right to top-left
    expect(
      dragRectToNormalizedBox({ x: 600, y: 300 }, { x: 200, y: 100 }, rect)
    ).toEqual({
      kind: "box",
      xNorm: 0.2,
      yNorm: 0.2,
      wNorm: 0.4,
      hNorm: 0.4,
    });

    // Top-right to bottom-left
    expect(
      dragRectToNormalizedBox({ x: 800, y: 50 }, { x: 300, y: 250 }, rect)
    ).toEqual({
      kind: "box",
      xNorm: 0.3,
      yNorm: 0.1,
      wNorm: 0.5,
      hNorm: 0.4,
    });

    // Bottom-left to top-right starting outside canvas and ending beyond bottom-right
    expect(
      dragRectToNormalizedBox({ x: -500, y: 900 }, { x: 5000, y: -200 }, rect)
    ).toEqual({
      kind: "box",
      xNorm: 0,
      yNorm: 0,
      wNorm: 1,
      hNorm: 1,
    });
  });

  it("collapses zero-drag and micro-drag on both axes into point, while keeping thin wide/tall drags as box", () => {
    const rect = { left: 0, top: 0, width: 1000, height: 1000 };

    // Zero distance click
    expect(dragRectToNormalizedBox({ x: 250, y: 250 }, { x: 250, y: 250 }, rect)).toEqual({
      kind: "point",
      xNorm: 0.25,
      yNorm: 0.25,
    });

    // Both axes < MIN_BOX_NORM_SIZE (0.015)
    expect(dragRectToNormalizedBox({ x: 400, y: 400 }, { x: 410, y: 410 }, rect)).toEqual({
      kind: "point",
      xNorm: 0.4,
      yNorm: 0.4,
    });

    // Wide thin highlight (wNorm = 0.05 >= 0.015, hNorm = 0.002 < 0.015) stays box
    expect(
      dragRectToNormalizedBox({ x: 400, y: 400 }, { x: 450, y: 402 }, rect, MIN_BOX_NORM_SIZE)
    ).toEqual({
      kind: "box",
      xNorm: 0.4,
      yNorm: 0.4,
      wNorm: 0.05,
      hNorm: 0.002,
    });
  });

  it("clamps zoom safely including NaN, Infinity, negatives, and decimals", () => {
    expect(clampZoom(0.1)).toBe(0.5);
    expect(clampZoom(-50)).toBe(0.5);
    expect(clampZoom(0)).toBe(0.5);
    expect(clampZoom(5)).toBe(3);
    expect(clampZoom(1.23456)).toBe(1.23);
    expect(clampZoom(Number.NaN)).toBe(1);
    expect(clampZoom(Number.POSITIVE_INFINITY)).toBe(1);
    expect(clampZoom(Number.NEGATIVE_INFINITY)).toBe(1);
  });

  it("computes concentric non-overlapping offsets when 15 pins pile onto identical coords and tolerates NaN", () => {
    expect(computePinDisplayOffsets([])).toEqual({});

    const piled = Array.from({ length: 15 }, (_, idx) => ({
      id: `p-${idx}`,
      x_norm: 0.5,
      y_norm: 0.5,
    }));
    const offsets = computePinDisplayOffsets(piled);

    expect(offsets["p-0"]).toEqual({ dx: 0, dy: 0 });
    // First ring (1..5) have non-zero offset with radius ~16
    for (let i = 1; i <= 5; i++) {
      expect(Math.hypot(offsets[`p-${i}`].dx, offsets[`p-${i}`].dy)).toBeGreaterThanOrEqual(15);
    }
    // Second/third ring pins expand outwards so they don't hide behind ring 1
    expect(Math.hypot(offsets["p-7"].dx, offsets["p-7"].dy)).toBeGreaterThanOrEqual(27);
    expect(Math.hypot(offsets["p-13"].dx, offsets["p-13"].dy)).toBeGreaterThanOrEqual(39);

    // Malformed NaN coords do not crash
    const nanOffsets = computePinDisplayOffsets([{ id: "bad", x_norm: Number.NaN, y_norm: 0.5 }]);
    expect(nanOffsets.bad).toEqual({ dx: 0, dy: 0 });
  });
});
