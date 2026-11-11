import { describe, expect, it } from "vitest";

import { parseVtt } from "./captions";
import {
  KIND_LABEL,
  WHEEL,
  WORDS,
  addressFor,
  bufferGoal,
  bufferedAhead,
  bufferedSpan,
  clock,
  coverScale,
  defaultFill,
  filmAt,
  fullscreenWay,
  jumpPlan,
  mod,
  pairNames,
  percent,
  placeFilms,
  readDeepLink,
  rebase,
  scrubFraction,
  releaseSlot,
  settleSlot,
  spokenTime,
  stepFree,
  stepSnap,
  tipCentre,
  visibleSlots,
  wheelImpulse,
  wordsAt,
  wordsTravel,
} from "./film-math";

const ranges = (...r: Array<[number, number]>) => ({
  length: r.length,
  start: (i: number) => r[i]![0],
  end: (i: number) => r[i]![1],
});

describe("the endless strip", () => {
  it("wraps both ways", () => {
    expect(mod(-1, 10)).toBe(9);
    expect(mod(10, 10)).toBe(0);
    expect(filmAt(-1, 10)).toBe(9);
    expect(filmAt(23, 10)).toBe(3);
  });

  it("shows one slide at rest and two while moving", () => {
    expect(visibleSlots(4)).toEqual([4]);
    expect(visibleSlots(4.3)).toEqual([4, 5]);
    expect(visibleSlots(-0.5)).toEqual([-1, 0]);
  });

  it("places the last film above the first, and the first below the last", () => {
    const back = placeFilms(-0.25, 10);
    expect(back[9]).toBeCloseTo(-0.75);
    expect(back[0]).toBeCloseTo(0.25);
    expect(back.filter((p) => p !== null)).toHaveLength(2);
    const on = placeFilms(9.5, 10);
    expect(on[9]).toBeCloseTo(-0.5);
    expect(on[0]).toBeCloseTo(0.5);
  });

  it("puts a jump's film in the slot it arrives at", () => {
    const places = placeFilms(0.4, 10, { slot: 1, film: 7 });
    expect(places[0]).toBeCloseTo(-0.4);
    expect(places[7]).toBeCloseTo(0.6);
    expect(places[1]).toBeNull();
  });
});

describe("where a scroll comes to rest", () => {
  it("goes back under the threshold and on past it", () => {
    expect(settleSlot(0.05, 0)).toBe(0);
    expect(settleSlot(0.2, 0)).toBe(1);
    expect(settleSlot(-0.2, 0)).toBe(-1);
    expect(settleSlot(1.05, 0)).toBe(1);
    expect(settleSlot(2.4, 0)).toBe(3);
  });

  it("one notch of a mouse wheel is one film", () => {
    let m = { pos: 0, target: 0, vel: wheelImpulse(100, 0, 900) };
    for (let i = 0; i < 40; i += 1) m = stepFree(m, 1);
    expect(settleSlot(m.target, 0)).toBe(1);
  });

  it("a long turn of the wheel goes further", () => {
    let m = { pos: 0, target: 0, vel: 0 };
    for (let i = 0; i < 8; i += 1) {
      m.vel += wheelImpulse(100, 0, 900);
      m = stepFree(m, 2);
    }
    for (let i = 0; i < 60; i += 1) m = stepFree(m, 1);
    expect(settleSlot(m.target, 0)).toBeGreaterThanOrEqual(2);
  });

  it("damps the tiny steps of a trackpad and caps the huge ones", () => {
    expect(Math.abs(wheelImpulse(2, 0, 900))).toBeLessThan(wheelImpulse(10, 0, 900) / 4);
    expect(wheelImpulse(5000, 0, 900)).toBeCloseTo(wheelImpulse(240, 0, 900));
    expect(wheelImpulse(3, 1, 900)).toBeCloseTo(wheelImpulse(48, 0, 900));
  });

  it("slows down and the snap arrives", () => {
    let m = { pos: 0, target: 0, vel: 0.05 };
    for (let i = 0; i < 200; i += 1) m = stepFree(m, 1);
    expect(m.vel).toBe(0);
    expect(m.target).toBeCloseTo(0.05 / (1 - WHEEL.friction), 1);
    let p = 0.6;
    for (let i = 0; i < 120; i += 1) p = stepSnap(p, 1, 1);
    expect(p).toBeCloseTo(1, 3);
  });

  it("a flick of a finger moves one film, a slow drag decides by distance", () => {
    expect(releaseSlot(0.1, 0, 1.2)).toBe(1);
    expect(releaseSlot(-0.1, 0, -1.2)).toBe(-1);
    expect(releaseSlot(0.2, 0, 0)).toBe(0);
    expect(releaseSlot(0.45, 0, 0)).toBe(1);
    expect(releaseSlot(1.8, 0, 5)).toBe(1);
  });
});

describe("a jump from the contents", () => {
  it("goes the shorter way and arrives in one slide", () => {
    expect(jumpPlan(0, 8, 10)).toEqual({ slot: -1, dir: -1, override: { slot: -1, film: 8 } });
    expect(jumpPlan(0, 3, 10)).toEqual({ slot: 1, dir: 1, override: { slot: 1, film: 3 } });
    expect(jumpPlan(20, 1, 10)).toEqual({ slot: 21, dir: 1, override: null });
    expect(jumpPlan(4, 4, 10)).toBeNull();
  });

  it("lands on the same place of the ring with the film in place", () => {
    const at = rebase(-1, 8, 10);
    expect(mod(at, 10)).toBe(8);
    expect(at).toBe(-2);
    expect(mod(rebase(21, 5, 10), 10)).toBe(5);
  });
});

describe("the picture", () => {
  it("covers the screen from the film's own shape", () => {
    expect(coverScale(2560 / 1080, 1440 / 900)).toBeCloseTo(1.4815, 3);
    expect(coverScale(16 / 9, 16 / 9)).toBe(1);
    expect(coverScale(16 / 9, 390 / 844)).toBeCloseTo(3.847, 2);
    expect(coverScale(0, 1)).toBe(1);
  });

  it("fills a wide screen and fits a tall one", () => {
    expect(defaultFill(1440, 900)).toBe(true);
    expect(defaultFill(390, 844)).toBe(false);
  });
});

describe("the buffer", () => {
  it("counts the seconds in hand from the play head, without gaps", () => {
    expect(bufferedAhead(ranges([0, 12]), 3)).toBe(9);
    expect(bufferedAhead(ranges([0, 4], [20, 30]), 22)).toBe(8);
    expect(bufferedAhead(ranges([0, 4], [20, 30]), 10)).toBe(0);
    expect(bufferedAhead(ranges(), 0)).toBe(0);
  });

  it("wants the target, or what is left of a film", () => {
    expect(bufferGoal(6, 0, 180)).toBe(6);
    expect(bufferGoal(6, 178, 180)).toBeCloseTo(1.75);
    expect(bufferGoal(6, 0, Number.NaN)).toBe(6);
  });
});

describe("the words", () => {
  it("writes times and percentages like the reference", () => {
    expect(clock(0)).toBe("00:00");
    expect(clock(180.8)).toBe("03:00");
    expect(clock(Number.NaN)).toBe("00:00");
    expect(spokenTime(65)).toBe("1 minute 5 seconds");
    expect(spokenTime(0)).toBe("0 seconds");
    expect(percent(0.283)).toBe("028%");
    expect(percent(1)).toBe("100%");
  });

  it("names the pair in its order, and every kind", () => {
    expect(pairNames({ pair: "fanny-layla", chars: ["layla", "fanny"] })).toEqual([
      "Layla",
      "Fanny",
    ]);
    expect(pairNames({ pair: "lesley-change", chars: [] })).toEqual(["Lesley", "Chang'e"]);
    expect(pairNames({ pair: null, chars: ["ruby"] })).toEqual(["Ruby"]);
    const dashes = [String.fromCharCode(0x2013), String.fromCharCode(0x2014)];
    for (const label of Object.values(KIND_LABEL)) {
      for (const dash of dashes) expect(label.includes(dash)).toBe(false);
    }
  });
});

describe("the address", () => {
  const ids = ["a", "b", "c"];

  it("reads a film and a second", () => {
    expect(readDeepLink("?i=b&t=42.5", ids)).toEqual({ index: 1, t: 42.5, asked: true });
    expect(readDeepLink("?i=zz&t=5", ids)).toEqual({ index: 0, t: 0, asked: false });
    expect(readDeepLink("", ids)).toEqual({ index: 0, t: 0, asked: false });
    expect(readDeepLink("?i=c&t=-3", ids)).toEqual({ index: 2, t: 0, asked: true });
  });

  it("writes the film on screen and drops the second", () => {
    expect(addressFor("http://x/collection/video/films/?i=a&t=9&q=1", "c")).toBe(
      "/collection/video/films/?i=c&q=1",
    );
  });
});

describe("captions", () => {
  it("reads WebVTT cues and drops tags", () => {
    const cues = parseVtt(
      "WEBVTT\n\n1\n00:00:00.450 --> 00:00:04.280\nI am the <i>heir</i>.\n\n2\n00:01:04.280 --> 00:01:09.540 align:start\nTwo\nlines\n\nbroken --> nothing\n",
    );
    expect(cues).toEqual([
      { start: 0.45, end: 4.28, text: "I am the heir." },
      { start: 64.28, end: 69.54, text: "Two\nlines" },
    ]);
  });
});

describe("the words while the strip moves", () => {
  it("are in place at rest", () => {
    for (const line of [0, 1, 2]) expect(wordsAt(0, line)).toEqual({ shown: 1, shift: 0 });
  });

  it("are gone halfway, so two films never overlap", () => {
    for (const off of [-0.5, -WORDS.gone, 0.5, WORDS.gone]) {
      for (const line of [0, 1, 2]) expect(wordsAt(off, line).shown).toBe(0);
    }
  });

  it("lift as they leave upward and rise as they come up from below", () => {
    const out = wordsAt(-0.25, 1);
    expect(out.shown).toBeGreaterThan(0);
    expect(out.shown).toBeLessThan(1);
    expect(out.shift).toBeLessThan(0);
    const into = wordsAt(0.25, 1);
    expect(into.shift).toBeGreaterThan(0);
    // The same move both ways: a slide at -x and +x shows a line in mirror.
    expect(wordsAt(0.25, 0).shown).toBeCloseTo(wordsAt(-0.25, 2).shown, 10);
  });

  it("ripple the way the edge sweeps", () => {
    // Coming up from below, the bottom line is ahead of the top one.
    expect(wordsAt(0.3, 2).shown).toBeGreaterThan(wordsAt(0.3, 0).shown);
    // Leaving upward, the bottom line goes first.
    expect(wordsAt(-0.2, 2).shown).toBeLessThan(wordsAt(-0.2, 0).shown);
  });

  it("move steadily with the strip", () => {
    let last = 1;
    for (let off = 0; off <= 0.5; off += 0.01) {
      const { shown } = wordsAt(-off, 1);
      expect(shown).toBeLessThanOrEqual(last + 1e-9);
      last = shown;
    }
  });

  it("travel a share of the screen, within bounds", () => {
    expect(wordsTravel(844)).toBeCloseTo(59.08, 2);
    expect(wordsTravel(200)).toBe(28);
    expect(wordsTravel(2000)).toBe(64);
  });
});

describe("the time line", () => {
  it("turns a press into a share of the film", () => {
    expect(scrubFraction(150, 100, 200)).toBe(0.25);
    expect(scrubFraction(50, 100, 200)).toBe(0);
    expect(scrubFraction(900, 100, 200)).toBe(1);
    expect(scrubFraction(120, 100, 0)).toBe(0);
  });

  it("shows the buffered stretch around the time", () => {
    expect(bufferedSpan(ranges([0, 30]), 10, 100)).toEqual([0, 0.3]);
    expect(bufferedSpan(ranges([0, 10], [50, 80]), 60, 100)).toEqual([0.5, 0.8]);
    // After a jump into a gap the next stretch shows.
    expect(bufferedSpan(ranges([0, 10], [50, 80]), 30, 100)).toEqual([0.5, 0.8]);
    expect(bufferedSpan(ranges(), 30, 100)).toEqual([0, 0]);
    expect(bufferedSpan(ranges([0, 120]), 30, 100)).toEqual([0, 1]);
    expect(bufferedSpan(ranges([0, 10]), 5, Number.NaN)).toEqual([0, 0]);
  });

  it("keeps the time bubble inside the line", () => {
    expect(tipCentre(5, 300, 50)).toBe(25);
    expect(tipCentre(150, 300, 50)).toBe(150);
    expect(tipCentre(299, 300, 50)).toBe(275);
    expect(tipCentre(10, 40, 50)).toBe(20);
  });
});

describe("full screen", () => {
  it("uses the room, else the film's own player, else nothing", () => {
    expect(fullscreenWay({ enabled: true, element: true, video: true })).toBe("element");
    // An iPhone: no element full screen, the video's own player only.
    expect(fullscreenWay({ enabled: false, element: false, video: true })).toBe("video");
    expect(fullscreenWay({ enabled: false, element: true, video: true })).toBe("video");
    expect(fullscreenWay({ enabled: false, element: false, video: false })).toBe("none");
  });
});
