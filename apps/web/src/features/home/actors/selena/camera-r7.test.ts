import { describe, expect, it } from "vitest";

import {
  R7_STRIDE,
  frameHeight,
  lensFor,
  lensFromPixels,
  mixLens,
  mixR7,
  orbitAbout,
  sampleR7,
  type R7Data,
} from "./camera-r7";

const ASPECT = 3840 / 1728;

function data(): R7Data {
  const still = [0, 1, 2, 0, 0, 0, 1, 50, 0.1];
  const move = [0, 1, 2, 0, 0, 0, 1, 50, 0, 2, 1, 2, 0, 0, Math.sin(0.1), Math.cos(0.1), 60, 0.2];
  return {
    fps: 30,
    aspect: ASPECT,
    clips: {
      still: { frames: 50, duration: 1.6, static: true, keys: still },
      move: { frames: 2, duration: 1 / 30, static: false, keys: move },
    },
    sky: { fromFilm: [1, 0, 0, 0, 1, 0, 0, 0, 1] },
  };
}

describe("sampleR7", () => {
  it("gives the one key of a static clip at any time", () => {
    const out = new Float32Array(R7_STRIDE);
    sampleR7(data(), "still", 0.7, out);
    expect(Array.from(out)).toEqual([0, 1, 2, 0, 0, 0, 1, 50, 0.10000000149011612]);
  });

  it("mixes position, lens and rotation between two keys", () => {
    const out = new Float32Array(R7_STRIDE);
    sampleR7(data(), "move", 1 / 60, out);
    expect(out[0]).toBeCloseTo(1, 5);
    expect(out[7]).toBeCloseTo(55, 4);
    expect(out[8]).toBeCloseTo(0.1, 5);
    expect(Math.hypot(out[3]!, out[4]!, out[5]!, out[6]!)).toBeCloseTo(1, 5);
    expect(out[5]).toBeGreaterThan(0);
  });

  it("throws for a clip that is not there", () => {
    expect(() => sampleR7(data(), "nope", 0, new Float32Array(R7_STRIDE))).toThrow();
  });
});

describe("mixR7", () => {
  it("is the first key at 0 and the second at 1", () => {
    const a = Float32Array.from([0, 0, 0, 0, 0, 0, 1, 40, 0]);
    const b = Float32Array.from([1, 2, 3, 0, 0, 1, 0, 80, 0.2]);
    const out = new Float32Array(R7_STRIDE);
    mixR7(a, b, 0, out);
    a.forEach((v, i) => expect(out[i]).toBeCloseTo(v, 5));
    mixR7(a, b, 1, out);
    b.forEach((v, i) => expect(out[i]).toBeCloseTo(v, 5));
  });
});

describe("lensFor", () => {
  const canvas = { w: 1440, h: 900 };

  it("makes the frame's height the focal length asks for", () => {
    const rect = { x: 0, y: 0, w: 1440, h: 900 };
    const fh = frameHeight(rect, ASPECT, 0);
    expect(fh).toBeCloseTo(1440 / ASPECT, 6);
    const lens = lensFor(rect, canvas, 50, 0, ASPECT, 0);
    expect(lens.focal).toBeCloseTo(fh / (2 * Math.tan((25 * Math.PI) / 180)), 6);
    expect(lens.cx).toBeCloseTo(720, 6);
    expect(lens.cy).toBeCloseTo(450, 6);
  });

  it("covers a window with the frame's height", () => {
    const rect = { x: 500, y: 100, w: 400, h: 500 };
    expect(frameHeight(rect, ASPECT, 1)).toBe(500);
    const lens = lensFor(rect, canvas, 50, 0, ASPECT, 1);
    expect(lens.cx).toBe(700);
    expect(lens.cy).toBe(350);
  });

  it("moves the optical axis down by the shift", () => {
    const rect = { x: 0, y: 0, w: 1440, h: 900 };
    const lens = lensFor(rect, canvas, 50, 0.1, ASPECT, 0);
    expect(lens.cy).toBeCloseTo(450 + 0.1 * (1440 / ASPECT), 6);
  });

  it("agrees with a three.js window: the optical axis lands on (cx, cy)", () => {
    const lens = lensFromPixels(canvas, 900, 700, 300);
    // The full frame is centred on the axis; the window is the canvas inside it.
    expect(lens.x + lens.fullWidth / 2 - lens.x).toBeCloseTo(lens.fullWidth / 2, 6);
    expect(lens.fullWidth / 2 - lens.x).toBeCloseTo(700, 6);
    expect(lens.fullHeight / 2 - lens.y).toBeCloseTo(300, 6);
    const half = lens.fullHeight / 2 / lens.focal;
    expect(Math.atan(half) * 2 * (180 / Math.PI)).toBeCloseTo(lens.fov, 6);
  });

  it("mixes two lenses in pixels", () => {
    const a = lensFromPixels(canvas, 1000, 720, 450);
    const b = lensFromPixels(canvas, 2000, 500, 300);
    const half = mixLens(canvas, a, b, 0.5);
    expect(half.focal).toBe(1500);
    expect(half.cx).toBe(610);
    expect(half.cy).toBe(375);
    expect(mixLens(canvas, a, b, 0).focal).toBe(1000);
  });
});

describe("orbitAbout", () => {
  const pivot = [0, 1, 0];
  const start = () => ({ pos: [0.3, 1.2, 2.5], quat: [0, 0, 0, 1] });

  it("does nothing at zero", () => {
    const s = start();
    orbitAbout(pivot, 0, 0, s.pos, s.quat);
    expect(s.pos[0]).toBeCloseTo(0.3, 9);
    expect(s.pos[1]).toBeCloseTo(1.2, 9);
    expect(s.pos[2]).toBeCloseTo(2.5, 9);
    expect(s.quat).toEqual([0, 0, 0, 1]);
  });

  it("keeps the distance to the pivot and a unit rotation", () => {
    const s = start();
    const d0 = Math.hypot(s.pos[0]! - pivot[0]!, s.pos[1]! - pivot[1]!, s.pos[2]! - pivot[2]!);
    orbitAbout(pivot, 0.07, -0.035, s.pos, s.quat);
    const d1 = Math.hypot(s.pos[0]! - pivot[0]!, s.pos[1]! - pivot[1]!, s.pos[2]! - pivot[2]!);
    expect(d1).toBeCloseTo(d0, 6);
    expect(Math.hypot(...(s.quat as [number, number, number, number]))).toBeCloseTo(1, 9);
  });

  it("a positive yaw moves a camera on +z toward +x and turns its look toward -x", () => {
    const s = { pos: [0, 1, 3], quat: [0, 0, 0, 1] };
    orbitAbout(pivot, 0.1, 0, s.pos, s.quat);
    expect(s.pos[0]).toBeCloseTo(3 * Math.sin(0.1), 6);
    expect(s.pos[2]).toBeCloseTo(3 * Math.cos(0.1), 6);
    // The camera turned about +Y by the same angle: its look direction (-z) swings toward -x.
    expect(s.quat[1]).toBeCloseTo(Math.sin(0.05), 6);
  });
});
