import { describe, expect, it } from "vitest";

import { approachParams, copyParams, makeParams, writeNumbers } from "./params";

const DEFAULTS = { speed: 1, scale: 1, angle: 0 };

describe("the extra numbers of a kind (uX)", () => {
  it("are four zeros until a section says otherwise", () => {
    const p = makeParams();
    writeNumbers(p, DEFAULTS, 1, {});
    expect(Array.from(p.extras)).toEqual([0, 0, 0, 0]);
  });

  it("are written from the options, up to four, and the rest are zero", () => {
    const p = makeParams();
    writeNumbers(p, DEFAULTS, 1, { extras: [0.5, 0.78, 0.34] });
    expect(p.extras[0]).toBeCloseTo(0.5, 6);
    expect(p.extras[1]).toBeCloseTo(0.78, 6);
    expect(p.extras[2]).toBeCloseTo(0.34, 6);
    expect(p.extras[3]).toBe(0);
    writeNumbers(p, DEFAULTS, 1, {});
    expect(Array.from(p.extras)).toEqual([0, 0, 0, 0]);
  });

  it("follow the target smoothly and arrive", () => {
    const cur = makeParams();
    const tgt = makeParams();
    writeNumbers(tgt, DEFAULTS, 1, { extras: [1, 0.6, 0.3, 0] });
    approachParams(cur, tgt, 0.25);
    expect(cur.extras[0]).toBeCloseTo(0.25, 6);
    expect(cur.extras[1]).toBeCloseTo(0.15, 6);
    for (let i = 0; i < 80; i++) approachParams(cur, tgt, 0.25);
    expect(cur.extras[0]).toBeCloseTo(1, 4);
    expect(cur.extras[2]).toBeCloseTo(0.3, 4);
  });

  it("are copied with the rest of the numbers", () => {
    const a = makeParams();
    const b = makeParams();
    writeNumbers(a, DEFAULTS, 1, { extras: [0.2, 0.4, 0.6, 0.8] });
    copyParams(b, a);
    expect(Array.from(b.extras)).toEqual(Array.from(a.extras));
  });
});
