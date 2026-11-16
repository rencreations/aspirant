import { describe, expect, it } from "vitest";

import {
  approach,
  fillRing,
  MAX_TILT,
  rimWords,
  tiltToward,
  titleLines,
  titleSize,
} from "./disc-math";
import type { PhaseTrack } from "./types";

const track = {
  id: "music-we-believe",
  ep: "EP 01",
  title: "We Believe!",
  credits: [
    { role: "Music", name: "Yasuharu Takanashi" },
    { role: "Vocals", name: "Yoshino Nanjo" },
  ],
  released: "01/2022",
} as unknown as PhaseTrack;

describe("the lean of a disc", () => {
  it("is nothing with the pointer on its centre", () => {
    expect(tiltToward(0, 0, 400)).toEqual({ x: 0, y: 0 });
  });

  it("turns the face to the side the pointer is on", () => {
    expect(tiltToward(200, 0, 400).y).toBeGreaterThan(0);
    expect(tiltToward(-200, 0, 400).y).toBeLessThan(0);
    // The pointer above the disc: the face turns up the screen.
    expect(tiltToward(0, -200, 400).x).toBeGreaterThan(0);
    expect(tiltToward(0, 200, 400).x).toBeLessThan(0);
  });

  it("grows with the distance and stops at the most", () => {
    expect(tiltToward(200, 0, 400).y).toBeCloseTo(MAX_TILT / 2);
    expect(tiltToward(400, 0, 400).y).toBeCloseTo(MAX_TILT);
    expect(tiltToward(4000, 0, 400).y).toBeCloseTo(MAX_TILT);
  });

  it("never passes the most in any direction", () => {
    for (const [dx, dy] of [
      [900, 900],
      [-700, 300],
      [20, -5000],
    ] as const) {
      const lean = tiltToward(dx, dy, 400);
      expect(Math.hypot(lean.x, lean.y)).toBeLessThanOrEqual(MAX_TILT + 1e-9);
    }
  });

  it("is nothing without a reach", () => {
    expect(tiltToward(100, 100, 0)).toEqual({ x: 0, y: 0 });
  });
});

describe("the ease", () => {
  it("does half of the way in one half life", () => {
    expect(approach(0, 10, 100, 100)).toBeCloseTo(5);
    expect(approach(0, 10, 200, 100)).toBeCloseTo(7.5);
  });

  it("does not depend on how the time is cut into frames", () => {
    const once = approach(0, 10, 32, 110);
    const twice = approach(approach(0, 10, 16, 110), 10, 16, 110);
    expect(twice).toBeCloseTo(once);
  });

  it("stays where it is with no time, and arrives with no half life", () => {
    expect(approach(3, 10, 0, 100)).toBe(3);
    expect(approach(3, 10, 16, 0)).toBe(10);
  });
});

describe("the print of a disc", () => {
  it("runs the series, the EP, the title, the credits and the release round the rim", () => {
    const words = rimWords(track);
    expect(words).toContain("THE ASPIRANTS");
    expect(words).toContain("EP 01");
    expect(words).toContain("WE BELIEVE!");
    expect(words).toContain("VOCALS YOSHINO NANJO");
    expect(words).toContain("01/2022");
    expect(words.endsWith("  ")).toBe(true);
  });

  it("fills the ring with whole repeats, at least one", () => {
    expect(fillRing("abc ", 12)).toBe("abc abc abc ");
    expect(fillRing("abc ", 13)).toBe("abc abc abc ");
    expect(fillRing("a long line of words ", 4)).toBe("a long line of words ");
    expect(fillRing("", 40)).toBe("");
  });

  it("sets a short title on one line and a long one on two of near equal length", () => {
    expect(titleLines("We Believe!")).toEqual(["WE BELIEVE!"]);
    expect(titleLines("Gray New World")).toEqual(["GRAY NEW WORLD"]);
    expect(titleLines("Angela & Ruby Music")).toEqual(["ANGELA &", "RUBY MUSIC"]);
    expect(titleLines("Cross x Credo: Guinevere version")).toEqual([
      "CROSS X CREDO:",
      "GUINEVERE VERSION",
    ]);
  });

  it("sizes the title to its longest line, between its smallest and its largest", () => {
    expect(titleSize(["WE BELIEVE!"], 568)).toBe(96);
    expect(titleSize(["CROSS X CREDO:", "GUINEVERE VERSION"], 568)).toBe(71);
    expect(titleSize(["A LINE THAT IS FAR TOO LONG FOR ANY DISC AT ALL"], 568)).toBe(44);
  });
});
