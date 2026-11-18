import { describe, expect, it } from "vitest";

import { homeLayout } from "../../kernel/where";
import { STORY } from "../story";

import { letterIn, letterMoment, makeBeats, STRIP_BEATS, stripBeats, stripS } from "./journey";

const stripPlaced = () => homeLayout().placed.find((p) => p.id === "strip")!;
// The strip's story is `STORY.strip` (`../story.ts`) and its tail is the fly-off's: the beats must fit.
const STRIP_SCREENS = STORY.strip.length;
const STORY_TAIL = 0.6;

describe("the strip's place on the scroll", () => {
  it("follows the rows, in step with their play, and keeps a tail for the fly-off", () => {
    const placed = stripPlaced();
    expect(placed.def.tail).toBeGreaterThanOrEqual(0.15);
    expect(placed.def.lead).toBeGreaterThanOrEqual(0.25);
    const rows = homeLayout().placed.find((p) => p.id === "rows")!;
    expect(rows.end).toBeCloseTo(placed.start, 6);
  });

  it("has four plays: the words in step with the rows, the window, the orbit, the fly-off", () => {
    const plays = stripPlaced().def.plays!;
    expect(plays).toHaveLength(4);
    expect(plays[0]!.at).toBe(0);
    expect(plays[3]!.at).toBe(1);
    for (const p of plays) expect(p.seconds).toBeLessThanOrEqual(3);
  });

  it("has its beats in order, the fly-off ending inside the tail", () => {
    const B = STRIP_BEATS;
    expect(B.enter[1]).toBeLessThanOrEqual(B.expand[0]);
    expect(B.window[0]).toBeGreaterThan(B.expand[0]);
    expect(B.window[0]).toBeLessThan(B.expand[1]);
    expect(B.pull[0]).toBeGreaterThanOrEqual(B.expand[1]);
    expect(B.hold[0]).toBe(B.pull[1]);
    expect(B.fly[0]).toBe(B.hold[1]);
    expect(B.fly[1]).toBeLessThanOrEqual(STRIP_SCREENS + STORY_TAIL);
  });
});

describe("stripS: the story position of a station", () => {
  it("runs the four plays through the strip's beats and rests outside them", () => {
    const B = STRIP_BEATS;
    expect(stripS(-3)).toBe(B.enter[0]);
    expect(stripS(0)).toBe(B.enter[0]);
    expect(stripS(1)).toBeCloseTo(B.enter[1], 9);
    expect(stripS(2)).toBeCloseTo(B.pull[0], 9);
    expect(stripS(3)).toBeCloseTo(B.fly[0], 9);
    expect(stripS(4)).toBeCloseTo(B.fly[1], 9);
    expect(stripS(9)).toBe(B.fly[1]);
  });

  it("never goes back as v grows", () => {
    let last = -Infinity;
    for (let v = -0.5; v <= 4.5; v += 0.01) {
      const s = stripS(v);
      expect(s).toBeGreaterThanOrEqual(last);
      last = s;
    }
  });

  it("rests the small state, the window, the orbit and the end in frames the beats hold still", () => {
    const a = makeBeats();
    const b = makeBeats();
    // The small state: from the end of the words to the start of the expand nothing changes.
    stripBeats(STRIP_BEATS.enter[1], a);
    stripBeats(STRIP_BEATS.expand[0], b);
    // The orbit's turn is not seen yet (no film has been pulled), so it is left out.
    a.travel = 0;
    b.travel = 0;
    expect(b).toEqual(a);
    // The window: the expand is done, the pull has not begun.
    stripBeats(stripS(2), a);
    expect(a.expand).toBe(1);
    expect(a.windowIn).toBe(1);
    expect(a.pull).toBe(0);
    // The orbit with its words fully in.
    stripBeats(stripS(3), a);
    expect(a.pull).toBe(1);
    expect(a.hold).toBe(1);
    expect(a.textIn).toBeCloseTo(1, 9);
    expect(a.fly).toBe(0);
    // The end: everything has flown and the words are gone.
    stripBeats(stripS(4), a);
    expect(a.fly).toBe(1);
    expect(a.textIn).toBe(0);
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
