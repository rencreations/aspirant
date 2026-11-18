import { describe, expect, it } from "vitest";

import {
  FACES,
  Blinker,
  JAW_REST_OPEN,
  blendFace,
  blinkAt,
  neutralFace,
  type FaceState,
} from "./face";

function expectFace(got: FaceState, want: FaceState): void {
  for (const key of Object.keys(want) as Array<keyof FaceState>) {
    expect(got[key]).toBeCloseTo(want[key], 9);
  }
}

describe("blendFace", () => {
  it("is the first face at 0, the second at 1 and a mix between", () => {
    const out = neutralFace();
    blendFace(out, FACES.neutral, FACES.annoyed, 0);
    expectFace(out, FACES.neutral);
    blendFace(out, FACES.neutral, FACES.annoyed, 1);
    expectFace(out, FACES.annoyed);
    blendFace(out, FACES.neutral, FACES.annoyed, 0.5);
    expect(out.lid).toBeCloseTo((FACES.neutral.lid + FACES.annoyed.lid) / 2);
  });

  it("clamps the weight and can blend a face into itself", () => {
    const out = neutralFace();
    blendFace(out, FACES.neutral, FACES.smile, 5);
    expectFace(out, FACES.smile);
    const a = neutralFace();
    blendFace(a, FACES.annoyed, FACES.annoyed, 0.3);
    expectFace(a, FACES.annoyed);
  });
});

describe("the presets", () => {
  it("keep every number in range", () => {
    for (const face of Object.values(FACES)) {
      expect(face.lid).toBeGreaterThanOrEqual(0);
      expect(face.lid).toBeLessThanOrEqual(1.4);
      expect(face.jaw).toBeGreaterThanOrEqual(0);
      expect(face.jaw).toBeLessThanOrEqual(1);
      expect(face.anger).toBeGreaterThanOrEqual(0);
      expect(face.anger).toBeLessThanOrEqual(1);
      expect(face.flare).toBeGreaterThanOrEqual(0);
      expect(face.flare).toBeLessThanOrEqual(1);
    }
  });

  it("the neutral face is the model's own mouth", () => {
    expect(FACES.neutral.jaw).toBeCloseTo(JAW_REST_OPEN);
    expect(FACES.neutral.lid).toBe(1);
  });

  it("the angry faces slant the eyes down at the inner ends, narrow them and flare the cheeks", () => {
    for (const name of ["annoyed", "growl"] as const) {
      expect(FACES[name].slant).toBeGreaterThan(0.3);
      expect(FACES[name].lid).toBeLessThan(0.6);
      expect(FACES[name].flare).toBeGreaterThan(0.6);
      expect(FACES[name].anger).toBe(1);
    }
    expect(FACES.smile.slant).toBeLessThan(0);
    expect(FACES.surprised.lid).toBeGreaterThan(1);
  });
});

describe("blinkAt", () => {
  it("closes fast, holds, opens and ends", () => {
    expect(blinkAt(-0.1)).toBe(0);
    expect(blinkAt(0)).toBe(0);
    expect(blinkAt(0.025)).toBeCloseTo(0.5);
    expect(blinkAt(0.06)).toBe(1);
    expect(blinkAt(0.125)).toBeCloseTo(0.5, 1);
    expect(blinkAt(0.17)).toBe(0);
    expect(blinkAt(3)).toBe(0);
  });
});

describe("Blinker", () => {
  it("blinks every few seconds and not in between", () => {
    const b = new Blinker(() => 0.9);
    let first = -1;
    let t = 0;
    let peak = 0;
    for (let i = 0; i < 60 * 8; i++) {
      t += 1 / 60;
      const closed = b.step(1 / 60);
      peak = Math.max(peak, closed);
      if (closed > 0.9 && first < 0) first = t;
    }
    expect(first).toBeGreaterThan(2.5);
    expect(first).toBeLessThan(3.2);
    expect(peak).toBe(1);
    expect(new Blinker(() => 0.9).step(0.5)).toBe(0);
  });

  it("an annoyed dragon (rate 2.5) blinks sooner, and now() blinks at once", () => {
    const calm = new Blinker(() => 0.9);
    const cross = new Blinker(() => 0.9);
    let calmAt = -1;
    let crossAt = -1;
    for (let i = 1; i < 60 * 6; i++) {
      if (calm.step(1 / 60, 1) > 0.9 && calmAt < 0) calmAt = i;
      if (cross.step(1 / 60, 2.5) > 0.9 && crossAt < 0) crossAt = i;
    }
    expect(crossAt).toBeLessThan(calmAt);
    const b = new Blinker(() => 0.9);
    b.now();
    expect(b.step(0.06)).toBe(1);
  });

  it("sometimes blinks twice, quickly", () => {
    const seq = [0.1, 0.1, 0.5, 0.9, 0.9];
    let i = 0;
    const b = new Blinker(() => seq[Math.min(i++, seq.length - 1)]!);
    const peaks: number[] = [];
    let prev = 0;
    for (let k = 0; k < 60 * 6; k++) {
      const c = b.step(1 / 60);
      if (prev <= 0.9 && c > 0.9) peaks.push(k / 60);
      prev = c;
    }
    expect(peaks.length).toBeGreaterThanOrEqual(2);
    expect(peaks[1]! - peaks[0]!).toBeLessThan(0.5);
  });
});
