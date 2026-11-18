import { describe, expect, it } from "vitest";

import { clientToStage, perspectiveScale, placeToCanvas, stageToClient } from "./place";

describe("placing her on the canvas", () => {
  it("puts the feet at the middle of the screen at the origin, and y up becomes y down", () => {
    const out = { markX: 0, groundY: 0, tall: 0 };
    placeToCanvas({ x: 0, y: 0, height: 300 }, 1440, 900, out);
    expect(out).toEqual({ markX: 720, groundY: 450, tall: 300 });
    placeToCanvas({ x: 100, y: -250, height: 300 }, 1440, 900, out);
    expect(out.markX).toBe(820);
    expect(out.groundY).toBe(700);
  });

  it("places by the middle of her height when asked", () => {
    const out = { markX: 0, groundY: 0, tall: 0 };
    placeToCanvas({ x: 0, y: 0, height: 400, origin: "middle" }, 1440, 900, out);
    // Her feet are half her height below her middle.
    expect(out.groundY).toBe(450 + 200);
  });

  it("draws a thing nearer the camera larger about the middle, as a perspective camera would", () => {
    expect(perspectiveScale(0)).toBe(1);
    expect(perspectiveScale(500)).toBeCloseTo(2, 9);
    expect(perspectiveScale(-1000)).toBeCloseTo(0.5, 9);
    const out = { markX: 0, groundY: 0, tall: 0 };
    placeToCanvas({ x: 100, y: 0, z: 500, height: 100 }, 1000, 800, out);
    expect(out.tall).toBeCloseTo(200, 9);
    expect(out.markX).toBeCloseTo(500 + 200, 9);
  });

  it("never divides by nothing for a z at the camera", () => {
    const out = { markX: 0, groundY: 0, tall: 0 };
    placeToCanvas({ x: 10, y: 10, z: 1000, height: 100 }, 1000, 800, out);
    expect(Number.isFinite(out.tall + out.markX + out.groundY)).toBe(true);
  });

  it("converts between the stage frame and client pixels both ways", () => {
    const a = { x: 0, y: 0 };
    stageToClient(-200, 100, 1440, 900, a);
    expect(a).toEqual({ x: 520, y: 350 });
    const b = { x: 0, y: 0 };
    clientToStage(a.x, a.y, 1440, 900, b);
    expect(b).toEqual({ x: -200, y: 100 });
  });
});
