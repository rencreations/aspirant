import { describe, expect, it } from "vitest";

import { validatePlays, zoneProgress, zoneValue } from "../../kernel/plays";
import { BEAT_SPAN, STAGE, STANCES, T, beatAt, newBeat } from "./beats";
import { FLIGHT, arriveAt, spiralInAt, wallCount, waveOf } from "./formations";
import { BEND_PLAYS, BEND_SCREENS, REST_BEATS, ZONE_SCREENS, restScreens } from "./plays";

const SIZES = [
  { w: 1440, h: 900 },
  { w: 1706, h: 950 },
  { w: 390, h: 844 },
] as const;

/** The state of the section's clock at a rest (beats). */
const rest = (k: number, vp: { w: number; h: number } = SIZES[0]) =>
  beatAt(REST_BEATS[k]! / BEAT_SPAN, newBeat(), vp);

describe("the bend section's zones", () => {
  it("make a valid table of ten scroll zones", () => {
    expect(() => {
      validatePlays("bend", BEND_PLAYS);
    }).not.toThrow();
    expect(BEND_PLAYS).toHaveLength(10);
    expect(ZONE_SCREENS).toHaveLength(10);
    expect(REST_BEATS).toHaveLength(11);
    for (const p of BEND_PLAYS) expect(p.span).toBeGreaterThan(0);
  });

  it("start at the chase's frame and end at the rest the archive starts from", () => {
    expect(BEND_PLAYS[0]!.from).toBe(0);
    expect(BEND_PLAYS[BEND_PLAYS.length - 1]!.to).toBeCloseTo(1, 12);
    expect(REST_BEATS[0]).toBe(0);
    expect(REST_BEATS[10]).toBe(BEAT_SPAN);
    const end = beatAt(1, newBeat());
    expect(end.spot.tx).toBeCloseTo(STAGE.tx, 6);
    expect(end.spot.ty).toBeCloseTo(STAGE.ty, 6);
    // The last zone ends with the section.
    const last = ZONE_SCREENS[9]!;
    expect(last.at + last.len).toBeCloseTo(BEND_SCREENS, 9);
  });

  it("rest on the beats the table says, in order", () => {
    BEND_PLAYS.forEach((p, i) => {
      expect(p.from * BEAT_SPAN).toBeCloseTo(REST_BEATS[i]!, 9);
      expect(p.to * BEAT_SPAN).toBeCloseTo(REST_BEATS[i + 1]!, 9);
      expect(REST_BEATS[i + 1]!).toBeGreaterThan(REST_BEATS[i]!);
    });
  });

  it("starts with the book and keeps the artwork moving as soon as it appears", () => {
    expect(ZONE_SCREENS[0]!.at).toBe(0);
    const wall = ZONE_SCREENS[5]!;
    expect(restScreens(1)).toBeGreaterThan(wall.at + wall.len);
    expect(restScreens(1)).toBeLessThan(ZONE_SCREENS[6]!.at);
    for (const i of [6, 7, 8]) {
      const zone = ZONE_SCREENS[i]!;
      expect(zone.at + zone.len).toBeCloseTo(ZONE_SCREENS[i + 1]!.at, 8);
    }
    expect(restScreens(2)).toBeCloseTo(ZONE_SCREENS[8]!.at, 8);
    expect(restScreens(3)).toBeLessThan(BEND_SCREENS);
  });

  it("show each stance formed at its rest: the right pose, still blended, and every picture of its wave landed", () => {
    for (const vp of SIZES) {
      STANCES.forEach((stance, w) => {
        const b = rest(w + 2, vp);
        expect(b.pose, `stance ${w}`).toBe("bend");
        expect(b.bend).toBe(stance.kind);
        expect(b.blend).toBeGreaterThan(0);
        const restBeat = REST_BEATS[w + 2]!;
        for (let i = 0; i < wallCount(vp); i += 1) {
          if (waveOf(i, vp) !== w) continue;
          expect(
            arriveAt(i, vp) + FLIGHT,
            `${vp.w}x${vp.h} stance ${w} poster ${i}`,
          ).toBeLessThanOrEqual(restBeat + 1e-9);
        }
      });
    }
  });

  it("show the book shut at the first rest: she stands in the middle", () => {
    const b = rest(1);
    expect(b.pose).toBe("stand");
    expect(b.spot.tx).toBeCloseTo(0, 9);
    expect(b.spot.th).toBeCloseTo(0.46, 3);
  });

  it("show the wall whole at its rest: every poster has landed, the title is on, she stands", () => {
    for (const vp of SIZES) {
      for (let i = 0; i < wallCount(vp); i += 1) {
        expect(arriveAt(i, vp) + FLIGHT, `${vp.w}x${vp.h} poster ${i}`).toBeLessThanOrEqual(
          T.holdTo + 1e-9,
        );
      }
      const b = rest(6, vp);
      expect(b.fanTitle).toBe(1);
      expect(b.pose).toBe("idle");
      expect(b.artTitle).toBe(0);
    }
  });

  it("show the ring turning at its rest, her stance still blended", () => {
    const b = rest(7);
    expect(b.pose).toBe("bend");
    expect(b.blend).toBeGreaterThan(0);
    expect(b.fanTitle).toBe(0);
  });

  it("show the spiral whole at its rest: every card is in, the title is on, she stands", () => {
    // The runtime flies each splash card in over 0.75 beat.
    expect(spiralInAt(10) + 0.75).toBeLessThanOrEqual(T.restArt + 1e-9);
    const b = rest(8);
    expect(b.artTitle).toBe(1);
    expect(b.fanTitle).toBe(0);
    expect(b.pose).toBe("idle");
    expect(b.adv).toBeGreaterThan(0);
  });

  it("bring the drone to the front before the greeting", () => {
    const b = rest(9);
    expect(b.adv).toBe(10);
    expect(b.pose).toBe("idle");
    expect(b.pat).toBe(0);
  });

  it("scrub the clock with the scroll, up and down, to the same value at the same place", () => {
    for (const p of BEND_PLAYS) {
      expect(zoneProgress(p, p.at - 0.001)).toBe(0);
      expect(zoneProgress(p, p.at + p.span! + 0.001)).toBe(1);
      const down = [0.2, 0.5, 0.8].map((k) => zoneValue(p, p.at + p.span! * k));
      const up = [0.8, 0.5, 0.2].map((k) => zoneValue(p, p.at + p.span! * k)).reverse();
      expect(up).toEqual(down);
      expect(down[0]!).toBeGreaterThan(p.from);
      expect(down[2]!).toBeLessThan(p.to);
    }
  });
});
