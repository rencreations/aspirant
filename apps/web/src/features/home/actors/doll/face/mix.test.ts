import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { FACE_FLOATS, FACE_FRAME, FACE_NAMES, type FaceName } from "./presets";
import {
  FACES,
  FACE_ARRAY_LENGTH,
  SWAP_HALF,
  applyLive,
  applyTalk,
  autoBlink,
  eyeFamily,
  floatIndex,
  isFaceName,
  mixFaces,
  openShare,
  swapBlink,
  swapsEyes,
  talkWobble,
} from "./mix";

const REPO = path.resolve(import.meta.dirname, "../../../../../../../..");

interface PresetsJson {
  names: string[];
  defaults: Record<string, number>;
  ranges: Record<string, [number, number]>;
  presets: Record<string, Record<string, number>>;
  frame: { eyeLeftRed: number[] };
}

const source = JSON.parse(
  readFileSync(path.join(REPO, "scripts/home/models/doll/face/presets.json"), "utf8"),
) as PresetsJson;

const F = (name: FaceName): Float32Array => FACES[name];
const get = (f: Float32Array, name: (typeof FACE_FLOATS)[number]): number =>
  f[floatIndex(name)] ?? 0;

describe("the expressions", () => {
  it("are the 26 of the asset and match its numbers exactly (no drift from the source)", () => {
    expect([...FACE_FLOATS]).toEqual(source.names);
    expect([...FACE_NAMES]).toEqual(Object.keys(source.presets));
    expect(FACE_NAMES.length).toBe(26);
    for (const name of FACE_NAMES) {
      const f = FACES[name];
      expect(f.length).toBe(FACE_ARRAY_LENGTH);
      FACE_FLOATS.forEach((k, i) => {
        expect(f[i], `${name}.${k}`).toBeCloseTo(source.presets[name]?.[k] ?? Number.NaN, 5);
      });
    }
  });

  it("keep every float inside the range the shader was tuned for", () => {
    for (const name of FACE_NAMES) {
      FACE_FLOATS.forEach((k, i) => {
        const r = source.ranges[k];
        if (!r) return;
        const v = FACES[name][i] ?? 0;
        expect(v, `${name}.${k}`).toBeGreaterThanOrEqual(r[0] - 1e-6);
        expect(v, `${name}.${k}`).toBeLessThanOrEqual(r[1] + 1e-6);
      });
    }
  });

  it("the frame is the one of the rig", () => {
    expect(FACE_FRAME[0]).toBeCloseTo(0.01025, 6);
    expect(source.frame.eyeLeftRed.length).toBe(2);
  });

  it("the array has one spare slot, for the shader's 56", () => {
    expect(FACE_ARRAY_LENGTH).toBe(FACE_FLOATS.length + 1);
    expect(FACES.neutral[FACE_ARRAY_LENGTH - 1]).toBe(0);
  });

  it("names and indices", () => {
    expect(isFaceName("angry")).toBe(true);
    expect(isFaceName("hungry")).toBe(false);
    expect(floatIndex("openL")).toBe(0);
    expect(() => floatIndex("nope" as never)).toThrow();
  });
});

describe("eye families", () => {
  it("neutral and angry have open eyes, a glyph face is its glyph", () => {
    expect(eyeFamily(F("neutral"))).toBe(-1);
    expect(eyeFamily(F("angry"))).toBe(-1);
    expect(eyeFamily(F("laughing"))).toBeGreaterThanOrEqual(0);
    expect(eyeFamily(F("dizzy"))).not.toBe(eyeFamily(F("laughing")));
  });

  it("says how much of the eyes is open eyes", () => {
    expect(openShare(F("neutral"))).toBe(1);
    expect(openShare(F("dizzy"))).toBe(0);
  });

  it("a swap is needed between open and glyph, not within a family", () => {
    expect(swapsEyes(F("neutral"), F("dizzy"))).toBe(true);
    expect(swapsEyes(F("neutral"), F("angry"))).toBe(false);
    expect(swapsEyes(F("laughing"), F("laughing"))).toBe(false);
  });
});

describe("mixFaces", () => {
  const out = new Float32Array(FACE_ARRAY_LENGTH);

  it("is exactly a at 0 and exactly b at 1, and clamps", () => {
    mixFaces(out, F("neutral"), F("angry"), 0);
    expect(Array.from(out)).toEqual(Array.from(F("neutral")));
    mixFaces(out, F("neutral"), F("angry"), 1);
    expect(Array.from(out)).toEqual(Array.from(F("angry")));
    mixFaces(out, F("neutral"), F("angry"), 7);
    expect(Array.from(out)).toEqual(Array.from(F("angry")));
    mixFaces(out, F("neutral"), F("angry"), -7);
    expect(Array.from(out)).toEqual(Array.from(F("neutral")));
  });

  it("blends every float of one family linearly", () => {
    mixFaces(out, F("neutral"), F("angry"), 0.25);
    const k = floatIndex("browAngL");
    expect(out[k]).toBeCloseTo((F("neutral")[k] ?? 0) * 0.75 + (F("angry")[k] ?? 0) * 0.25, 6);
  });

  it("two eye families: the glyphs come from a below the middle and from b above, never both", () => {
    const a = F("neutral");
    const b = F("dizzy");
    const spiral = floatIndex("gSpiral");
    for (const w of [0.05, 0.2, 0.4, 0.49]) {
      mixFaces(out, a, b, w);
      expect(out[spiral], `w ${w}`).toBe(0);
    }
    for (const w of [0.51, 0.6, 0.8, 0.95]) {
      mixFaces(out, a, b, w);
      expect(out[spiral], `w ${w}`).toBe(1);
    }
  });

  it("two eye families: the lids are shut at the middle and open at the ends, so the swap is hidden", () => {
    const a = F("neutral");
    const b = F("dizzy");
    mixFaces(out, a, b, 0.5);
    expect(get(out, "blinkL")).toBe(1);
    expect(get(out, "blinkR")).toBe(1);
    mixFaces(out, a, b, 0.5 - SWAP_HALF - 0.01);
    expect(get(out, "blinkL")).toBe(0);
    mixFaces(out, a, b, 0.2);
    expect(get(out, "blinkR")).toBe(0);
    expect(swapBlink(0.5)).toBe(1);
    expect(swapBlink(0.5 + SWAP_HALF)).toBe(0);
    expect(swapBlink(0)).toBe(0);
    expect(swapBlink(0.5 + SWAP_HALF / 2)).toBeCloseTo(0.5, 10);
  });

  it("never shows a ghost: across the whole blend the glyph weights sum to a or b's, not a mix", () => {
    const a = F("neutral");
    const b = F("heartEyes");
    const glyphs = [
      "gArc",
      "gChevron",
      "gSpiral",
      "gHeart",
      "gStar",
      "gCross",
      "gDot",
      "gLine",
    ] as const;
    for (let i = 1; i < 100; i++) {
      mixFaces(out, a, b, i / 100);
      const sum = glyphs.reduce((s, g) => s + get(out, g), 0);
      expect(sum === 0 || sum === 1).toBe(true);
    }
  });

  it("is safe in place", () => {
    const x = Float32Array.from(F("neutral"));
    mixFaces(x, x, F("angry"), 0.5);
    expect(get(x, "browAngL")).toBeCloseTo(
      (get(F("neutral"), "browAngL") + get(F("angry"), "browAngL")) / 2,
      6,
    );
  });
});

describe("autoBlink", () => {
  it("stays in 0 to 1 and is open most of the time", () => {
    let open = 0;
    let total = 0;
    let shut = 0;
    for (let t = 0; t < 300; t += 1 / 60) {
      const v = autoBlink(t);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
      total++;
      if (v === 0) open++;
      if (v > 0.99) shut++;
    }
    expect(open / total).toBeGreaterThan(0.9);
    expect(shut).toBeGreaterThan(20);
  });

  it("blinks about every two to five seconds", () => {
    const starts: number[] = [];
    let was = 0;
    for (let t = 0; t < 120; t += 1 / 120) {
      const v = autoBlink(t);
      if (v > 0 && was === 0) starts.push(t);
      was = v;
    }
    expect(starts.length).toBeGreaterThan(120 / 6);
    expect(starts.length).toBeLessThan(120 / 1.5);
  });

  it("two dolls with different seeds do not blink together", () => {
    let same = 0;
    let both = 0;
    for (let t = 0; t < 200; t += 1 / 60) {
      const a = autoBlink(t, 0) > 0.5;
      const b = autoBlink(t, 9) > 0.5;
      if (a) both++;
      if (a && b) same++;
    }
    expect(same).toBeLessThan(both * 0.5);
  });

  it("is a pure function of time", () => {
    expect(autoBlink(12.34)).toBe(autoBlink(12.34));
  });
});

describe("applyLive", () => {
  const live = { blink: 0, lookX: 0, lookY: 0, talk: 0, t: 1 };

  it("a blink closes open eyes and does not touch a glyph eye", () => {
    const open = Float32Array.from(F("neutral"));
    applyLive(open, { ...live, blink: 1 });
    expect(get(open, "blinkL")).toBe(1);
    const glyph = Float32Array.from(F("laughing"));
    applyLive(glyph, { ...live, blink: 1 });
    expect(get(glyph, "blinkL")).toBe(0);
  });

  it("the look is added to the expression's own and held in -1 to 1", () => {
    const f = Float32Array.from(F("neutral"));
    applyLive(f, { ...live, lookX: 0.5, lookY: -5 });
    expect(get(f, "lookX")).toBeCloseTo(0.5, 6);
    expect(get(f, "lookY")).toBe(-1);
  });

  it("the spirals turn with the time", () => {
    const a = Float32Array.from(F("dizzy"));
    const b = Float32Array.from(F("dizzy"));
    applyLive(a, { ...live, t: 1 });
    applyLive(b, { ...live, t: 1.1 });
    expect(get(a, "time")).not.toBe(get(b, "time"));
    expect(get(a, "time")).toBeLessThan(Math.PI * 2);
  });
});

describe("talking", () => {
  it("the syllables stay in 0 to 1 and really move", () => {
    let lo = 1;
    let hi = 0;
    for (let t = 0; t < 10; t += 0.01) {
      const v = talkWobble(t);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
    }
    expect(lo).toBe(0);
    expect(hi).toBeGreaterThan(0.6);
  });

  it("an open mouth (a scream, a curse) opens and closes between a part of its own and all of it", () => {
    const base = get(F("scream"), "mOpen");
    let lo = Infinity;
    let hi = -Infinity;
    for (let t = 0; t < 5; t += 0.01) {
      const f = Float32Array.from(F("scream"));
      applyTalk(f, 1, t);
      lo = Math.min(lo, get(f, "mOpen"));
      hi = Math.max(hi, get(f, "mOpen"));
    }
    expect(hi).toBeLessThanOrEqual(base + 1e-6);
    expect(lo).toBeLessThan(base * 0.5);
    expect(lo).toBeGreaterThan(0);
  });

  it("a line mouth turns into an open grin that follows the syllables", () => {
    const f = Float32Array.from(F("neutral"));
    let t = 0;
    while (talkWobble(t) < 0.5) t += 0.005;
    applyTalk(f, 1, t);
    expect(get(f, "mD")).toBeGreaterThan(0.4);
    expect(get(f, "mOpen")).toBeGreaterThan(0.4);
  });

  it("an amount of 0 changes nothing", () => {
    const f = Float32Array.from(F("neutral"));
    applyLive(f, { blink: 0, lookX: 0, lookY: 0, talk: 0, t: 3 });
    const g = Float32Array.from(F("neutral"));
    g[floatIndex("time")] = get(f, "time");
    expect(Array.from(f)).toEqual(Array.from(g));
  });
});
