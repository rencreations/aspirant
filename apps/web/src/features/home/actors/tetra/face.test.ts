import { describe, expect, it } from "vitest";

import { FACE_NAMES, FACES, FaceState, createFaceOut, readingGaze } from "./face";

function run(face: FaceState, seconds: number, dt = 1 / 60) {
  const out = createFaceOut();
  for (let t = 0; t < seconds; t += dt) face.step(dt, { x: 0, y: 0 }, out);
  return out;
}

describe("faces", () => {
  it("has a drawing for every name, with every number in range and a real mouth", () => {
    const mouths = new Set([
      "mouth_a",
      "mouth_i",
      "mouth_u",
      "mouth_e",
      "mouth_o",
      "smile_mouth",
      "grin",
      "frown_mouth",
    ]);
    for (const name of FACE_NAMES) {
      const f = FACES[name];
      for (const v of [f.lid, f.squeeze, f.wide, f.size]) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
      expect(mouths.has(f.mouth)).toBe(true);
    }
  });

  it("eases into an expression and settles on it, never overshooting", () => {
    const face = new FaceState();
    face.set("surprised");
    const out = createFaceOut();
    let last = 0;
    for (let i = 0; i < 90; i += 1) {
      face.step(1 / 60, { x: 0, y: 0 }, out);
      expect(out.wide).toBeGreaterThanOrEqual(last - 1e-9);
      expect(out.wide).toBeLessThanOrEqual(1);
      last = out.wide;
    }
    expect(out.wide).toBeGreaterThan(0.99);
    expect(out.mouth).toBe("mouth_o");
    expect(out.mouthSize).toBeCloseTo(0.9, 1);
  });

  it("is the same at 60 and 144 Hz", () => {
    const a = new FaceState(3);
    const b = new FaceState(3);
    a.set("angry");
    b.set("angry");
    const oa = run(a, 1.2, 1 / 60);
    const ob = run(b, 1.2, 1 / 144);
    expect(oa.squeeze).toBeCloseTo(ob.squeeze, 2);
    expect(oa.mouth).toBe(ob.mouth);
  });

  it("changes the mouth's drawing through nothing, not by a pop", () => {
    const face = new FaceState();
    face.set("neutral");
    run(face, 1);
    face.set("angry");
    const out = createFaceOut();
    let smallest = 1;
    let swapped = false;
    for (let i = 0; i < 60; i += 1) {
      face.step(1 / 60, { x: 0, y: 0 }, out);
      if (out.mouth === "frown_mouth") swapped = true;
      if (!swapped) expect(out.mouth).toBe("smile_mouth");
      smallest = Math.min(smallest, out.mouthSize);
    }
    expect(swapped).toBe(true);
    expect(smallest).toBeLessThan(0.05);
  });

  it("blinks now and then, and not while the lids are shut for a smile", () => {
    const face = new FaceState(5);
    const out = createFaceOut();
    let peak = 0;
    for (let i = 0; i < 60 * 8; i += 1) {
      face.step(1 / 60, { x: 0, y: 0 }, out);
      peak = Math.max(peak, out.blinkL);
    }
    expect(peak).toBeGreaterThan(0.8);

    const smiling = new FaceState(5);
    smiling.set("happy");
    run(smiling, 1);
    let low = 1;
    for (let i = 0; i < 60 * 8; i += 1) {
      smiling.step(1 / 60, { x: 0, y: 0 }, out);
      low = Math.min(low, out.blinkL);
    }
    expect(low).toBeGreaterThan(0.7);
  });

  it("pants: a tired mouth swells and falls", () => {
    const face = new FaceState();
    face.set("tired");
    run(face, 1);
    const out = createFaceOut();
    let lo = 1;
    let hi = 0;
    for (let i = 0; i < 60 * 2; i += 1) {
      face.step(1 / 60, { x: 0, y: 0 }, out);
      lo = Math.min(lo, out.mouthSize);
      hi = Math.max(hi, out.mouthSize);
    }
    expect(hi - lo).toBeGreaterThan(0.25);
  });

  it("reads along a line, sweeps back and goes down a line", () => {
    const p = { x: 0, y: 0 };
    readingGaze(0, 1.7, p);
    const start = { ...p };
    readingGaze(1.2, 1.7, p);
    expect(p.x).toBeGreaterThan(start.x + 0.8);
    readingGaze(1.7 * 0.99, 1.7, p);
    expect(p.x).toBeLessThan(0);
    readingGaze(1.7 + 0.1, 1.7, p);
    expect(p.y).toBeLessThan(start.y);
    for (let t = 0; t < 20; t += 0.1) {
      readingGaze(t, 1.7, p);
      expect(Math.abs(p.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(p.y)).toBeLessThanOrEqual(1);
    }
  });

  it("never draws the squeezed eyes part way: they switch on behind a blink, at any blend", () => {
    for (const name of ["angry", "laugh"] as const) {
      const face = new FaceState(9);
      const out = createFaceOut();
      let last = 0;
      for (const blend of [0.3, 0.49, 0.5, 0.8, 1, 0.6, 0.2, 0]) {
        face.set(name, blend);
        for (let i = 0; i < 40; i += 1) {
          face.step(1 / 60, { x: 0, y: 0 }, out);
          // A part way squeeze draws no eyes: it is on, or off, or too small to matter.
          expect(out.squeeze === 1 || out.squeeze <= 0.15).toBe(true);
          if (out.squeeze !== last) {
            // At the step the eyes change the lids are shut.
            expect(out.blinkL).toBeGreaterThan(0.3);
            last = out.squeeze;
          }
        }
      }
    }
  });

  it("snaps to a face at once for a jump", () => {
    const face = new FaceState();
    face.set("surprised");
    face.snap();
    const out = createFaceOut();
    face.step(0, { x: 0, y: 0 }, out);
    expect(out.wide).toBe(1);
    expect(out.mouth).toBe("mouth_o");
  });
});
