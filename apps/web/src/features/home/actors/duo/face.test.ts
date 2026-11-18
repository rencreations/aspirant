import { describe, expect, it } from "vitest";

import {
  blendFace,
  copyFace,
  eyesAreSymbols,
  faceDistance,
  FACE_NAMES,
  FACES,
  makeFaceUniforms,
  packFace,
  type FaceLive,
  type FaceUniforms,
  type FaceShape,
} from "./face";

/** Every uniform's own array, so a test can see that packing writes into them and makes none. */
const uniformArrays = (u: FaceUniforms): number[][] =>
  (Object.values(u) as Array<{ value: number[] }>).map((v) => v.value);

const live: FaceLive = { blinkL: 0, blinkR: 0, lookX: 0, lookY: 0, on: 1, spin: 0 };

describe("the faces", () => {
  it("there are the twelve of /about and the ten for the performance", () => {
    expect(FACE_NAMES).toHaveLength(22);
    for (const name of [
      "bold",
      "soft",
      "bars",
      "happy",
      "glad",
      "angry",
      "wide",
      "dizzy",
      "love",
      "squeeze",
      "flat",
      "shy",
      "confused",
      "befuddled",
      "effort",
      "strain",
      "surprise",
      "smug",
      "annoyed",
      "joy",
      "thanks",
      "worry",
    ]) {
      expect(FACE_NAMES).toContain(name);
    }
  });

  it("every face has every number, finite", () => {
    const keys = Object.keys(FACES.bold).sort();
    for (const name of FACE_NAMES) {
      expect(Object.keys(FACES[name]).sort()).toEqual(keys);
      for (const v of Object.values(FACES[name])) expect(Number.isFinite(v)).toBe(true);
    }
  });

  it("no two faces are the same drawing", () => {
    const seen = new Set<string>();
    for (const name of FACE_NAMES) seen.add(JSON.stringify(FACES[name]));
    expect(seen.size).toBe(FACE_NAMES.length);
  });

  it("the confusion is lopsided: the eyes and the brows differ by side", () => {
    const f = FACES.confused;
    expect(f.scaleL).not.toBeCloseTo(f.scaleR, 2);
    expect(f.browYL).not.toBeCloseTo(f.browYR, 2);
    expect(f.browTiltL).not.toBeCloseTo(f.browTiltR, 2);
  });

  it("effort and strain have teeth and brows, the strain is flushed", () => {
    expect(FACES.effort.grit).toBe(1);
    expect(FACES.effort.browOnL).toBe(1);
    expect(FACES.effort.browOnR).toBe(1);
    expect(FACES.strain.tone).toBeGreaterThan(FACES.effort.tone);
  });

  it("the drawings share the eye: no face asks for more than all of it", () => {
    for (const name of FACE_NAMES) {
      const f = FACES[name];
      expect(f.arc + f.heart + f.spiral + f.chevron + f.ring + f.star).toBeLessThanOrEqual(1.0001);
    }
  });
});

describe("blending", () => {
  it("the ends are the two faces and the middle is between", () => {
    const out: FaceShape = { ...FACES.soft };
    blendFace(out, FACES.soft, FACES.confused, 0);
    expect(out).toEqual(FACES.soft);
    blendFace(out, FACES.soft, FACES.confused, 1);
    expect(out).toEqual(FACES.confused);
    blendFace(out, FACES.soft, FACES.confused, 0.5);
    expect(out.scaleL).toBeCloseTo((FACES.soft.scaleL + FACES.confused.scaleL) / 2, 9);
  });

  it("blending a face into itself in place leaves it", () => {
    const out: FaceShape = { ...FACES.joy };
    blendFace(out, out, FACES.joy, 0.4);
    expect(out).toEqual(FACES.joy);
  });

  it("copyFace copies every number", () => {
    const out: FaceShape = { ...FACES.soft };
    copyFace(out, FACES.worry);
    expect(out).toEqual(FACES.worry);
  });
});

describe("the distance between faces", () => {
  it("is 0 for a face and itself and symmetric", () => {
    expect(faceDistance(FACES.soft, FACES.soft)).toBe(0);
    expect(faceDistance(FACES.soft, FACES.happy)).toBe(faceDistance(FACES.happy, FACES.soft));
  });

  it("two sizes of one drawing are near and two drawings are far", () => {
    expect(faceDistance(FACES.bold, FACES.angry)).toBeLessThan(0.5);
    expect(faceDistance(FACES.soft, FACES.happy)).toBeGreaterThan(0.5);
    expect(faceDistance(FACES.surprise, FACES.joy)).toBeGreaterThan(0.5);
  });

  it("symbol eyes do not blink, open eyes do", () => {
    expect(eyesAreSymbols(FACES.happy)).toBe(true);
    expect(eyesAreSymbols(FACES.joy)).toBe(true);
    expect(eyesAreSymbols(FACES.dizzy)).toBe(true);
    expect(eyesAreSymbols(FACES.soft)).toBe(false);
    expect(eyesAreSymbols(FACES.surprise)).toBe(false);
  });
});

describe("packFace", () => {
  it("writes the numbers into the uniforms without making new arrays", () => {
    const u = makeFaceUniforms();
    const arrays = uniformArrays(u);
    packFace(u, FACES.confused, { ...live, blinkL: 0.5, lookX: 0.1 });
    expect(uniformArrays(u)).toEqual(arrays);
    expect(uniformArrays(u).every((v, i) => v === arrays[i])).toBe(true);
    expect(u.uLive.value[0]).toBe(0.5);
    expect(u.uLive.value[2]).toBe(0.1);
    expect(u.uLay.value[2]).toBe(FACES.confused.scaleL);
    expect(u.uLay.value[3]).toBe(FACES.confused.scaleR);
    expect(u.uBrowL.value[3]).toBe(1);
    for (const v of uniformArrays(u)) {
      for (const n of v) expect(Number.isFinite(n)).toBe(true);
    }
  });

  it("the glyph weights of any blend add up to at most 1", () => {
    const u = makeFaceUniforms();
    const mid: FaceShape = { ...FACES.soft };
    for (const a of FACE_NAMES) {
      for (const b of FACE_NAMES) {
        blendFace(mid, FACES[a], FACES[b], 0.5);
        packFace(u, mid, live);
        const sum =
          u.uGlyph.value.reduce((x, y) => x + y, 0) + u.uGlyph2.value.reduce((x, y) => x + y, 0);
        expect(sum).toBeLessThanOrEqual(1.0001);
      }
    }
  });
});
