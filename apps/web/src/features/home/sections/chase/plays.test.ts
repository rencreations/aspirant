import { describe, expect, it } from "vitest";

import { validatePlays, zoneProgress, zoneValue } from "../../kernel/plays";
import { SECTIONS } from "../../kernel/sections";
import { CHASE_ZONES } from "./index";
import { T, beatAt, dollPlace, geometry, tetraStand, wordsAmount } from "./timeline";

const chase = SECTIONS.find((s) => s.id === "chase")!;
const plays = chase.plays!;
const screens = chase.screens;

/** The value of the section's clock at a scroll position, in screens from the section's start. */
function at(screensFromStart: number): number {
  const s = screensFromStart / screens;
  let v = plays[0]!.from;
  for (const p of plays) if (s >= p.at) v = zoneValue(p, s);
  return v;
}

describe("the chase's zones", () => {
  it("make a valid table of two scroll zones", () => {
    expect(() => {
      validatePlays("chase", plays);
    }).not.toThrow();
    expect(plays).toHaveLength(2);
    for (const p of plays) expect(p.span).toBeGreaterThan(0);
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

  it("gives the point, sit and book sequence more scroll time than the run", () => {
    expect(plays[1]!.span!).toBeGreaterThan(plays[0]!.span!);
    expect(chase.manualScroll).toBe(true);
  });

  it("start a little after the section does, and leave a short rest and a longer one", () => {
    const first = plays[0]!.at * screens;
    expect(first).toBeGreaterThanOrEqual(0.15);
    expect(first).toBeLessThanOrEqual(1.1);
    // Tetra panting: a short rest.
    const rest = (plays[1]!.at - plays[0]!.at - plays[0]!.span!) * screens;
    expect(rest).toBeGreaterThanOrEqual(0.1);
    expect(rest).toBeLessThanOrEqual(0.4);
    // The comic and its buttons: the page stays a while.
    const dwell = (1 - plays[1]!.at - plays[1]!.span!) * screens;
    expect(dwell).toBeCloseTo(0.44, 6);
    expect(dwell).toBeLessThanOrEqual(1.2);
    expect(chase.focus!).toBeGreaterThan(plays[1]!.at + plays[1]!.span!);
  });

  it("start after the funny section's tail has ended, so its words are gone before the doll runs", () => {
    const funny = SECTIONS.find((x) => x.id === "funny")!;
    expect(plays[0]!.at * screens).toBeGreaterThanOrEqual(funny.tail + 0.05 - 1e-9);
    expect(CHASE_ZONES.run.at).toBeCloseTo(plays[0]!.at * screens, 9);
  });

  it("scrub the story with the scroll, both ways, and give the same frame at the same place", () => {
    const run = CHASE_ZONES.run;
    expect(at(run.at - 0.2)).toBe(0);
    expect(at(run.at + run.len / 2)).toBeCloseTo(T.tetraTo / 2, 9);
    expect(at(run.at + run.len)).toBeCloseTo(T.tetraTo, 9);
    // Down and up over the same places read the same.
    const down = [0.1, 0.4, 0.7, 1.0].map((k) => at(run.at + run.len * k));
    const up = [1.0, 0.7, 0.4, 0.1].map((k) => at(run.at + run.len * k)).reverse();
    expect(up).toEqual(down);
    for (let i = 1; i < down.length; i += 1) expect(down[i]!).toBeGreaterThan(down[i - 1]!);
    const comic = CHASE_ZONES.comic;
    expect(at(comic.at + comic.len / 2)).toBeCloseTo((T.tetraTo + T.comic) / 2, 9);
    expect(at(screens)).toBeCloseTo(T.comic, 9);
  });

  it("hold no clock: a zone has progress, not a hold", () => {
    expect(zoneProgress(plays[0]!, plays[0]!.at - 0.01)).toBe(0);
    expect(zoneProgress(plays[0]!, plays[0]!.at + plays[0]!.span!)).toBeCloseTo(1, 12);
  });
});
