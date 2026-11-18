import { describe, expect, it } from "vitest";

import { PlayMachine, validatePlays } from "../../kernel/plays";
import { SECTIONS } from "../../kernel/sections";
import { T, beatAt, dollPlace, geometry, tetraStand, wordsAmount } from "./timeline";

const chase = SECTIONS.find((s) => s.id === "chase")!;
const plays = chase.plays!;

describe("the chase's plays", () => {
  it("make a valid table with two scenes", () => {
    expect(() => {
      validatePlays("chase", plays);
    }).not.toThrow();
    expect(plays).toHaveLength(2);
  });

  it("start from the empty page and rest on the panting Tetra and then on the comic", () => {
    expect(plays[0]!.from).toBe(0);
    expect(plays[0]!.to).toBe(T.tetraTo);
    expect(plays[1]!.from).toBe(T.tetraTo);
    expect(plays[1]!.to).toBe(T.comic);
    const o = { x: 0, y: 0, dist: 0, on: false };
    expect(dollPlace(plays[0]!.from, geometry(1440, 900), o).on).toBe(false);
    expect(beatAt(plays[0]!.to)).toBe("pant");
    expect(beatAt(plays[1]!.to)).toBe("read");
    expect(wordsAmount(plays[1]!.to)).toBe(1);
  });

  it("rest the camera where the bend section starts", () => {
    const g = geometry(1440, 900);
    const s = { x: 0, y: 0, height: 0 };
    tetraStand(plays[1]!.to, g, s);
    expect(s.height).toBeCloseTo(g.zoomH, 9);
    expect(s.y).toBeCloseTo(g.zoomFeet, 9);
  });

  it("are short: 3 s at most for one scene, 4.5 s for both", () => {
    for (const p of plays) expect(p.seconds).toBeLessThanOrEqual(3);
    expect(plays.reduce((a, p) => a + p.seconds, 0)).toBeLessThanOrEqual(4.5);
  });

  it("fire a little after the start and leave a dwell of 0.4 to 1 screen", () => {
    const length = chase.screens;
    const first = plays[0]!.at * length;
    expect(first).toBeGreaterThanOrEqual(0.15);
    expect(first).toBeLessThanOrEqual(1.1);
    const dwell = (plays[1]!.at - plays[0]!.at) * length;
    expect(dwell).toBeGreaterThanOrEqual(0.4);
    expect(dwell).toBeLessThanOrEqual(1);
    // The comic's own dwell, to the end of the section.
    expect((1 - plays[1]!.at) * length).toBeLessThanOrEqual(1);
    expect(chase.focus!).toBeGreaterThan(plays[1]!.at);
  });

  it("fire after the funny section's tail has ended, so the scroll is never held while its words are half way up", () => {
    const funny = SECTIONS.find((x) => x.id === "funny")!;
    expect(plays[0]!.at * chase.screens).toBeGreaterThanOrEqual(funny.tail + 0.05);
  });

  it("run the chase and the comic on the clock when the scroll crosses the thresholds", () => {
    const m = new PlayMachine("chase", plays, { screens: chase.screens });
    m.enter(-0.1);
    let now = 0;
    let held = 0;
    for (let f = 0; f < 60 * 8; f += 1) {
      now += 1000 / 60;
      m.step(0.8, 0.8, 1 / 60, now);
      if (m.active) held += 1 / 60;
    }
    expect(m.value).toBeCloseTo(T.comic, 9);
    expect(held).toBeCloseTo(
      plays.reduce((a, p) => a + p.seconds, 0),
      0,
    );
  });
});
