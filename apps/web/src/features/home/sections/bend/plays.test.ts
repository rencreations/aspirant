import { describe, expect, it } from "vitest";

import { PlayMachine, hystOf, validatePlays } from "../../kernel/plays";
import { BEAT_SPAN, REST, T, beatAt, newBeat } from "./beats";
import { FLIGHT, arriveAt, spiralInAt, wallCount } from "./formations";
import { BEND_PLAYS, BEND_SCREENS, FIRE_AT, REST_BEATS, restScreens } from "./plays";

const SIZES = [
  { w: 1440, h: 900 },
  { w: 1706, h: 950 },
  { w: 390, h: 844 },
] as const;

describe("the bend section's plays", () => {
  it("make a valid table", () => {
    expect(() => {
      validatePlays("bend", BEND_PLAYS);
    }).not.toThrow();
  });

  it("start at the chase's frame and end at the rest the archive starts from", () => {
    expect(BEND_PLAYS[0]!.from).toBe(0);
    expect(BEND_PLAYS[BEND_PLAYS.length - 1]!.to).toBeCloseTo(1, 12);
    expect(REST_BEATS[0]).toBe(0);
    expect(REST_BEATS[3]).toBe(BEAT_SPAN);
    const end = beatAt(1, newBeat());
    expect(end.spot.tx).toBeCloseTo(REST.tx, 6);
    expect(end.spot.ty).toBeCloseTo(REST.ty, 6);
  });

  it("rest on the beats the table says", () => {
    BEND_PLAYS.forEach((p, i) => {
      expect(p.to * BEAT_SPAN).toBeCloseTo(REST_BEATS[i + 1]!, 9);
      expect(p.from * BEAT_SPAN).toBeCloseTo(REST_BEATS[i]!, 9);
    });
  });

  it("keep every scene short: 3 s at most, 8 s for all three", () => {
    for (const p of BEND_PLAYS) {
      expect(p.seconds).toBeLessThanOrEqual(3);
      expect(p.seconds * (p.back ?? 0.7)).toBeLessThanOrEqual(2);
    }
    expect(BEND_PLAYS.reduce((a, p) => a + p.seconds, 0)).toBeLessThanOrEqual(8);
  });

  it("run at about a beat a second, not faster than 1.3", () => {
    for (const p of BEND_PLAYS) {
      expect(((p.to - p.from) * BEAT_SPAN) / p.seconds).toBeLessThanOrEqual(1.3);
    }
  });

  it("fire a little after the section starts and leave a dwell of 0.4 to 1 screen between scenes", () => {
    expect(FIRE_AT[0]).toBeGreaterThanOrEqual(0.2);
    expect(FIRE_AT[0]).toBeLessThanOrEqual(0.5);
    for (let i = 1; i < FIRE_AT.length; i += 1) {
      const dwell = FIRE_AT[i]! - FIRE_AT[i - 1]!;
      expect(dwell).toBeGreaterThanOrEqual(0.4);
      expect(dwell).toBeLessThanOrEqual(1);
    }
    // No dead scroll at the end: the last scene fires within a screen of the end.
    expect(BEND_SCREENS - FIRE_AT[2]).toBeLessThanOrEqual(0.6);
    BEND_PLAYS.forEach((p, i) => {
      expect(p.at * BEND_SCREENS).toBeCloseTo(FIRE_AT[i]!, 9);
    });
  });

  it("stand the page in the middle of each dwell, clear of the hysteresis", () => {
    const hyst = hystOf(BEND_SCREENS) * BEND_SCREENS;
    for (const k of [1, 2, 3] as const) {
      const at = restScreens(k);
      expect(at).toBeGreaterThan(FIRE_AT[k - 1]! + hyst);
      if (k !== 3) expect(at).toBeLessThan(FIRE_AT[k]);
      else expect(at).toBeLessThan(BEND_SCREENS);
    }
  });

  it("show the wall whole at the first rest: every poster has landed, the title is on, she stands", () => {
    for (const vp of SIZES) {
      for (let i = 0; i < wallCount(vp); i += 1) {
        expect(arriveAt(i, vp) + FLIGHT, `${vp.w}x${vp.h} poster ${i}`).toBeLessThanOrEqual(
          T.holdTo + 1e-9,
        );
      }
      const b = beatAt(BEND_PLAYS[0]!.to, newBeat(), vp);
      expect(b.fanTitle).toBe(1);
      expect(b.pose).toBe("idle");
      expect(b.artTitle).toBe(0);
    }
  });

  it("show the spiral whole at the second rest: every card is in, the title is on, she stands", () => {
    // The runtime flies each splash card in over 0.75 beat.
    expect(spiralInAt(10) + 0.75).toBeLessThanOrEqual(T.restArt + 1e-9);
    const b = beatAt(BEND_PLAYS[1]!.to, newBeat());
    expect(b.artTitle).toBe(1);
    expect(b.fanTitle).toBe(0);
    expect(b.pose).toBe("idle");
    expect(b.adv).toBe(0);
  });

  it("plays out on the clock: the scroll crosses a threshold, the value runs to the rest and holds", () => {
    const m = new PlayMachine("bend", BEND_PLAYS, { screens: BEND_SCREENS });
    m.enter(-0.1);
    let now = 0;
    const s = BEND_PLAYS[0]!.at + 0.01;
    let held = 0;
    for (let f = 0; f < 60 * 5; f += 1) {
      now += 1000 / 60;
      m.step(s, s, 1 / 60, now);
      if (m.active) held += 1 / 60;
    }
    expect(m.active).toBe(false);
    expect(m.value).toBeCloseTo(BEND_PLAYS[0]!.to, 9);
    expect(held).toBeCloseTo(BEND_PLAYS[0]!.seconds, 1);
  });

  it("a hard flick through the whole section chains the three scenes, each on its clock", () => {
    const m = new PlayMachine("bend", BEND_PLAYS, { screens: BEND_SCREENS });
    m.enter(-0.1);
    let now = 0;
    let held = 0;
    let last = -1;
    for (let f = 0; f < 60 * 12; f += 1) {
      now += 1000 / 60;
      m.step(0.9, 0.9, 1 / 60, now);
      if (m.active) held += 1 / 60;
      expect(m.value).toBeGreaterThanOrEqual(last - 1e-9);
      last = m.value;
    }
    expect(m.value).toBeCloseTo(1, 9);
    expect(held).toBeCloseTo(
      BEND_PLAYS.reduce((a, p) => a + p.seconds, 0),
      0,
    );
  });

  it("runs back when the scroll goes up across a threshold, shorter", () => {
    const m = new PlayMachine("bend", BEND_PLAYS, { screens: BEND_SCREENS });
    m.jump(BEND_PLAYS[0]!.at + 0.05);
    expect(m.value).toBeCloseTo(BEND_PLAYS[0]!.to, 9);
    let now = 0;
    let held = 0;
    const s = BEND_PLAYS[0]!.at - 0.1;
    for (let f = 0; f < 60 * 4; f += 1) {
      now += 1000 / 60;
      m.step(s, s, 1 / 60, now);
      if (m.active) held += 1 / 60;
    }
    expect(m.value).toBeCloseTo(0, 9);
    expect(held).toBeLessThan(BEND_PLAYS[0]!.seconds);
  });
});
