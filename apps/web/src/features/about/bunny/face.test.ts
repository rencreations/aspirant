import { describe, expect, it } from "vitest";

import {
  FACE_BLUE,
  FACE_CYAN,
  FACE_FRAGMENT_HEAD,
  FACE_FRAGMENT_MAP,
  FACE_PINK,
  FACE_RED,
  FACE_VERTEX_BODY,
  FACE_VERTEX_HEAD,
  FACES,
  LIVE_REST,
  blendFace,
  copyFace,
  makeFaceUniforms,
  packFace,
  setScreen,
  type BunnyFace,
  type BunnyFaceName,
  type BunnyLive,
  type BunnyScreen,
} from "./face";

const NAMES = Object.keys(FACES) as BunnyFaceName[];
const KEYS = Object.keys(FACES.neutral) as Array<keyof BunnyFace>;
const EYES = ["arc", "heart", "spiral", "cross", "chevron", "ring"] as const;
const MOUTHS = ["cat", "dash", "smile", "frown", "open", "oh", "wave"] as const;
const MARKS = ["blush", "tear", "sweat", "anger", "note", "zzz"] as const;
/** Half the glass, in its pixels (the model's extras say 26.1 by 19.2). */
const GLASS = { x: 26, y: 19 };

describe("the bunny's faces", () => {
  it("has every face the page asks for", () => {
    for (const name of [
      "neutral",
      "happy",
      "laugh",
      "surprised",
      "scared",
      "angry",
      "sleepy",
      "love",
      "wink",
      "dizzy",
      "smug",
      "sad",
      "singing",
      "ko",
    ]) {
      expect(NAMES).toContain(name);
    }
  });

  it("starts from the source's own face: notched tall eyes and the cat's mouth", () => {
    const n = FACES.neutral;
    expect([n.eyeW, n.eyeH, n.cut, n.round, n.gap, n.eyeY]).toEqual([3.5, 7, 2, 0, 13, 4.5]);
    expect(MOUTHS.map((m) => n[m])).toEqual([1, 0, 0, 0, 0, 0, 0]);
    expect(EYES.every((g) => n[g] === 0)).toBe(true);
    expect(MARKS.every((m) => n[m] === 0)).toBe(true);
  });

  it("gives every face all the numbers, each in its range", () => {
    for (const name of NAMES) {
      const f = FACES[name];
      expect(Object.keys(f).sort(), name).toEqual([...KEYS].sort());
      for (const key of KEYS) expect(Number.isFinite(f[key]), `${name}.${key}`).toBe(true);
      for (const key of [
        ...EYES,
        ...MOUTHS,
        ...MARKS,
        "lidL",
        "lidR",
        "low",
        "winkL",
        "winkR",
        "tone",
      ] as const) {
        expect(f[key], `${name}.${key}`).toBeGreaterThanOrEqual(0);
        expect(f[key], `${name}.${key}`).toBeLessThanOrEqual(1);
      }
      expect(f.eyeW, name).toBeGreaterThan(0);
      expect(f.eyeH, name).toBeGreaterThan(0);
    }
  });

  it("keeps the eyes and the mouth on the glass", () => {
    for (const name of NAMES) {
      const f = FACES[name];
      expect(f.gap + f.eyeW, name).toBeLessThan(GLASS.x - 4);
      expect(f.eyeY + f.eyeH, name).toBeLessThan(GLASS.y - 4);
      expect(f.eyeY - f.eyeH, name).toBeGreaterThan(-GLASS.y + 4);
      expect(f.gap - f.eyeW, name).toBeGreaterThan(1);
      expect(Math.abs(f.mouthX) + 8 * f.mouthW, name).toBeLessThan(GLASS.x - 4);
      expect(f.mouthY, name).toBeGreaterThan(-GLASS.y + 6);
    }
  });

  it("gives every face one whole mouth", () => {
    for (const name of NAMES) {
      const sum = MOUTHS.reduce((s, m) => s + FACES[name][m], 0);
      expect(sum, name).toBeCloseTo(1, 6);
    }
  });

  it("makes every face a different face", () => {
    const all = Object.entries(FACES);
    all.forEach(([nameA, a], i) => {
      for (const [nameB, b] of all.slice(i + 1)) {
        const apart = KEYS.reduce((s, k) => s + Math.abs(a[k] - b[k]), 0);
        expect(apart, `${nameA} and ${nameB}`).toBeGreaterThan(0.5);
      }
    });
  });

  it("winks with one eye only, and smug lids differ", () => {
    expect([FACES.wink.winkL, FACES.wink.winkR]).toEqual([1, 0]);
    expect(FACES.smug.lidL).not.toBe(FACES.smug.lidR);
  });
});

describe("blending faces", () => {
  it("lands on each end and halfway between", () => {
    const out = { ...FACES.neutral };
    expect(blendFace(out, FACES.happy, FACES.sad, 0)).toEqual(FACES.happy);
    expect(blendFace(out, FACES.happy, FACES.sad, 1)).toEqual(FACES.sad);
    blendFace(out, FACES.happy, FACES.sad, 0.5);
    for (const key of KEYS) {
      expect(out[key], key).toBeCloseTo((FACES.happy[key] + FACES.sad[key]) / 2, 9);
    }
  });

  it("can blend into one of its own inputs, and moves every number without a step", () => {
    const a = copyFace({ ...FACES.neutral }, FACES.love);
    blendFace(a, a, FACES.angry, 0.25);
    for (const key of KEYS) {
      expect(a[key], key).toBeCloseTo(
        FACES.love[key] + (FACES.angry[key] - FACES.love[key]) * 0.25,
        9,
      );
    }
    const prev = { ...FACES.neutral };
    const next = { ...FACES.neutral };
    for (let i = 1; i <= 100; i++) {
      blendFace(next, FACES.neutral, FACES.dizzy, i / 100);
      for (const key of KEYS) {
        const range = Math.abs(FACES.dizzy[key] - FACES.neutral[key]);
        expect(Math.abs(next[key] - prev[key])).toBeLessThanOrEqual(range / 100 + 1e-9);
      }
      copyFace(prev, next);
    }
  });

  it("copies a face whole", () => {
    expect(copyFace({ ...FACES.neutral }, FACES.ko)).toEqual(FACES.ko);
  });
});

describe("the screen's uniforms", () => {
  const live = (over: Partial<BunnyLive> = {}): BunnyLive => ({ ...LIVE_REST, ...over });

  it("rests open, lit, still and on the screen's pixels", () => {
    expect(LIVE_REST).toEqual({
      blinkL: 0,
      blinkR: 0,
      lookX: 0,
      lookY: 0,
      talk: 0,
      on: 1,
      spin: 0,
      glow: 0,
      pixel: 1,
    });
  });

  it("writes a face and its live numbers where the shader reads them", () => {
    const u = makeFaceUniforms();
    packFace(u, FACES.sad, live({ blinkL: 0.3, blinkR: 0.6, lookX: 2, lookY: -1, spin: 1.5 }));
    const s = FACES.sad;
    expect(u.uEye.value).toEqual([s.eyeW, s.eyeH, s.cut, s.round]);
    expect(u.uEyeAt.value).toEqual([s.gap, s.eyeY, s.low, 0]);
    expect(u.uLidL.value).toEqual([s.lidL, s.slantL, s.winkL, 0.3]);
    expect(u.uLidR.value).toEqual([s.lidR, s.slantR, s.winkR, 0.6]);
    expect(u.uMouthA.value).toEqual([s.cat, s.dash, s.smile, s.frown]);
    expect(u.uMouthP.value).toEqual([s.mouthW, s.mouthTilt, s.mouthX, s.mouthY]);
    expect(u.uMarkA.value).toEqual([s.blush, s.tear, s.sweat, s.anger]);
    expect(u.uMarkB.value).toEqual([s.note, s.zzz, s.tone, 0]);
    expect(u.uLive.value).toEqual([2, -1, 1, 1]);
    expect(u.uGlyph2.value[2]).toBe(1.5);
  });

  it("never lets the eye's drawings add up to more than one eye", () => {
    const u = makeFaceUniforms();
    const busy: BunnyFace = {
      ...FACES.neutral,
      arc: 1,
      heart: 1,
      spiral: 1,
      cross: 0.5,
      chevron: 0,
      ring: 0.5,
    };
    packFace(u, busy, live());
    const [chevron = 0, ring = 0] = u.uGlyph2.value;
    const sum = u.uGlyph.value.reduce((a, b) => a + b, 0) + chevron + ring;
    expect(sum).toBeCloseTo(1, 9);
    packFace(u, FACES.happy, live());
    expect(u.uGlyph.value[0]).toBe(1);
  });

  it("opens the mouth for a word on top of the face's own mouth", () => {
    const u = makeFaceUniforms();
    packFace(u, FACES.neutral, live({ talk: 0 }));
    const [open = 0, , , tall = 0] = u.uMouthB.value;
    packFace(u, FACES.neutral, live({ talk: 1 }));
    expect(u.uMouthB.value[0]).toBe(open + 1);
    expect(u.uMouthB.value[3]).toBeGreaterThan(tall);
    expect(u.uLive2.value[0]).toBe(1);
  });

  it("takes the screen's place from the model's extras", () => {
    const u = makeFaceUniforms();
    const screen: BunnyScreen = {
      centre: [0, -0.043, 0.197],
      right: [1, 0, 0],
      up: [0, 0.98, 0.2],
      pixel: 0.005,
    };
    setScreen(u, screen);
    expect(u.uScreen.value).toEqual([0, -0.043, 0.197, 200]);
    expect(u.uScreenRight.value).toEqual([1, 0, 0]);
    expect(u.uScreenUp.value).toEqual([0, 0.98, 0.2]);
  });

  it("declares in the shader every uniform it makes, and no other", () => {
    const declared = [
      ...`${FACE_VERTEX_HEAD}${FACE_FRAGMENT_HEAD}`.matchAll(/uniform \w+ (\w+);/g),
    ].map((m) => m[1]);
    expect(new Set(declared)).toEqual(new Set(Object.keys(makeFaceUniforms())));
  });

  it("gives the shader its pieces", () => {
    expect(FACE_VERTEX_BODY).toContain("vFace");
    expect(FACE_FRAGMENT_HEAD).toContain("vec3 bFace(");
    expect(FACE_FRAGMENT_MAP).toContain("bFace(");
  });

  it("names its colours, the cyan being the source's", () => {
    expect(FACE_CYAN).toBe(0x16fdf5);
    for (const c of [FACE_PINK, FACE_RED, FACE_BLUE]) {
      expect(c).toBeGreaterThan(0);
      expect(c).toBeLessThanOrEqual(0xffffff);
    }
  });
});
