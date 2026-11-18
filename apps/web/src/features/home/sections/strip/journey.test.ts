import { describe, expect, it } from "vitest";

import { layoutSections } from "../../kernel/layout";
import { SECTIONS } from "../../kernel/sections";
import { ROWS_START } from "../rows/journey";

import {
  letterIn,
  letterMoment,
  makeBeats,
  STRIP_BEATS,
  STRIP_SCREENS,
  STRIP_START,
  stripBeats,
} from "./journey";

describe("the strip's place on the scroll", () => {
  it("matches the registry and follows the rows", () => {
    const placed = layoutSections(SECTIONS).placed.find((p) => p.id === "strip")!;
    expect(placed.start).toBeCloseTo(STRIP_START, 6);
    expect(placed.def.screens).toBe(STRIP_SCREENS);
    expect(placed.def.tail).toBeGreaterThanOrEqual(1);
    const rows = layoutSections(SECTIONS).placed.find((p) => p.id === "rows")!;
    expect(rows.end).toBeCloseTo(STRIP_START, 6);
    expect(rows.start).toBeCloseTo(ROWS_START, 6);
  });

  it("has its beats in order, the fly-off ending inside the tail", () => {
    const B = STRIP_BEATS;
    expect(B.enter[1]).toBeLessThanOrEqual(B.expand[0]);
    expect(B.window[0]).toBeGreaterThan(B.expand[0]);
    expect(B.window[0]).toBeLessThan(B.expand[1]);
    expect(B.pull[0]).toBeGreaterThanOrEqual(B.expand[1]);
    expect(B.hold[0]).toBe(B.pull[1]);
    expect(B.fly[0]).toBe(B.hold[1]);
    const placed = layoutSections(SECTIONS).placed.find((p) => p.id === "strip")!;
    expect(B.fly[1]).toBeLessThanOrEqual(STRIP_SCREENS + placed.def.tail);
  });
});

describe("stripBeats", () => {
  const b = makeBeats();

  it("is the small frame at joint J3: the words coming in, nothing grown", () => {
    stripBeats(0, b);
    expect(b.expand).toBe(0);
    expect(b.pull).toBe(0);
    expect(b.fly).toBe(0);
    expect(b.leave).toBe(0);
    expect(b.enter).toBeGreaterThan(0.5);
    expect(b.play).toBe(1);
  });

  it("finishes the small words' entrance in the lead and holds the strip until the expand", () => {
    stripBeats(STRIP_BEATS.enter[1], b);
    expect(b.enter).toBe(1);
    stripBeats(STRIP_BEATS.expand[0], b);
    expect(b.expand).toBe(0);
    expect(b.clean).toBe(0);
  });

  it("opens the window, takes the overlay off and lowers the play button as the pull starts", () => {
    stripBeats(STRIP_BEATS.expand[1], b);
    expect(b.expand).toBe(1);
    expect(b.leave).toBe(1);
    expect(b.clean).toBe(1);
    stripBeats(STRIP_BEATS.pull[0], b);
    expect(b.play).toBe(1);
    stripBeats(STRIP_BEATS.pull[0] + 0.2 * (STRIP_BEATS.pull[1] - STRIP_BEATS.pull[0]), b);
    expect(b.play).toBeCloseTo(0, 6);
  });

  it("has the orbit at rest (travel 0) where the pull ends, and the words fully in near the end of the hold", () => {
    stripBeats(STRIP_BEATS.pull[1], b);
    expect(b.pull).toBe(1);
    expect(b.travel).toBeCloseTo(0, 9);
    expect(b.textIn).toBeCloseTo(0.4, 6);
    stripBeats(STRIP_BEATS.hold[0] + 0.6 * (STRIP_BEATS.hold[1] - STRIP_BEATS.hold[0]), b);
    expect(b.textIn).toBeCloseTo(1, 6);
  });

  it("takes the words out in the first third of the fly-off and has flown everything off by its end", () => {
    stripBeats(STRIP_BEATS.fly[0] + 0.3 * (STRIP_BEATS.fly[1] - STRIP_BEATS.fly[0]), b);
    expect(b.textIn).toBeCloseTo(0, 9);
    stripBeats(STRIP_BEATS.fly[1], b);
    expect(b.fly).toBe(1);
  });

  it("is monotone in the expand and the fly-off", () => {
    let lastE = 0;
    let lastF = 0;
    for (let s = -0.5; s < 4.3; s += 0.01) {
      stripBeats(s, b);
      expect(b.expand).toBeGreaterThanOrEqual(lastE);
      expect(b.fly).toBeGreaterThanOrEqual(lastF);
      lastE = b.expand;
      lastF = b.fly;
    }
  });
});

describe("letterIn", () => {
  it("shows no letter at 0 and every letter at 1", () => {
    for (let i = 0; i < 80; i++) {
      expect(letterIn(i, 0)).toBe(false);
      expect(letterIn(i, 1)).toBe(true);
    }
  });

  it("brings letters in at their own moments, the same ones every time, and in no order", () => {
    const moments = Array.from({ length: 40 }, (_, i) => letterMoment(i));
    expect(moments).toEqual(Array.from({ length: 40 }, (_, i) => letterMoment(i)));
    expect(new Set(moments).size).toBeGreaterThan(30);
    expect(moments.every((m, i) => i === 0 || m >= moments[i - 1]!)).toBe(false);
    // More progress never takes a letter away.
    for (let i = 0; i < 40; i++) {
      let seen = false;
      for (let p = 0; p <= 1; p += 0.05) {
        const on = letterIn(i, p);
        if (seen) expect(on).toBe(true);
        seen = on;
      }
    }
  });
});
