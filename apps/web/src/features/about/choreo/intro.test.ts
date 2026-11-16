import { describe, expect, it } from "vitest";

import { TAU } from "./ease";
import { INTRO, introAt, passSize, type IntroGeo } from "./intro";

/** The first screen as the page lays it out on the four screens (title box, hero place). */
const SCREENS: Array<{ name: string; geo: IntroGeo }> = [
  {
    name: "1366x768",
    geo: {
      vw: 1366,
      vh: 768,
      title: { x: 68, y: 86, w: 1136, h: 318 },
      hero: { x: 191, y: 538, size: 628 },
      restTurn: 0.84,
    },
  },
  {
    name: "1440x900",
    geo: {
      vw: 1440,
      vh: 900,
      title: { x: 70, y: 88, w: 1196, h: 338 },
      hero: { x: 202, y: 598, size: 662 },
      restTurn: 0.84,
    },
  },
  {
    name: "1920x1080",
    geo: {
      vw: 1920,
      vh: 1080,
      title: { x: 82, y: 90, w: 1600, h: 450 },
      hero: { x: 269, y: 749, size: 883 },
      restTurn: 0.84,
    },
  },
  {
    name: "390x844",
    geo: {
      vw: 390,
      vh: 844,
      title: { x: 18, y: 70, w: 352, h: 180 },
      hero: { x: 195, y: 368, size: 242 },
      restTurn: 0.84,
    },
  },
];

const STEP = 1 / 120;
const offTurn = (a: number) => Math.abs(a - Math.round(a / TAU) * TAU);

describe("the opening", () => {
  it("keeps to its times: the title in 1.7 seconds at most, the whole in about four", () => {
    expect(INTRO.pass).toBeLessThanOrEqual(1.7);
    expect(INTRO.done).toBeGreaterThanOrEqual(3.6);
    expect(INTRO.done).toBeLessThanOrEqual(4.2);
    expect(INTRO.pass).toBeLessThan(INTRO.apex);
    expect(INTRO.apex).toBeLessThan(INTRO.out);
    expect(INTRO.out).toBeLessThan(INTRO.touch);
    expect(INTRO.touch).toBeLessThan(INTRO.landed);
    expect(INTRO.landed).toBeLessThan(INTRO.done);
  });

  it("names its phases in order", () => {
    const geo = SCREENS[1]?.geo;
    if (!geo) throw new Error("no screen");
    const order = ["title", "landing", "landed", "done"];
    let at = 0;
    for (let t = 0; t <= INTRO.done + 0.5; t += STEP) {
      const i = order.indexOf(introAt(geo, t).phase);
      expect(i).toBeGreaterThanOrEqual(at);
      at = i;
    }
    expect(at).toBe(3);
    expect(introAt(geo, INTRO.pass - 0.01).phase).toBe("title");
    expect(introAt(geo, INTRO.landed + 0.01).phase).toBe("landed");
  });

  it("crosses the title from off the right of the screen to its left end, never back", () => {
    for (const { name, geo } of SCREENS) {
      const first = introAt(geo, 0);
      expect(first.x - first.size / 2, name).toBeGreaterThan(geo.vw);
      let x = first.x;
      for (let t = STEP; t <= INTRO.pass; t += STEP) {
        const f = introAt(geo, t);
        expect(f.x, `${name} at ${t.toFixed(2)}`).toBeLessThan(x);
        x = f.x;
        // On the height of the title, wherever the wave has taken it.
        expect(f.y).toBeGreaterThan(geo.title.y - 0.1 * geo.title.h);
        expect(f.y).toBeLessThan(geo.title.y + 1.1 * geo.title.h);
      }
      expect(introAt(geo, INTRO.pass).x, name).toBeLessThan(geo.title.x);
    }
  });

  it("opens the title in its trail: the edge only falls, from beyond the right end to the left", () => {
    for (const { name, geo } of SCREENS) {
      let edge = introAt(geo, 0).edge;
      expect(edge, name).toBeGreaterThan(geo.title.x + geo.title.w);
      for (let t = STEP; t <= INTRO.pass; t += STEP) {
        const f = introAt(geo, t);
        expect(f.edge, `${name} at ${t.toFixed(2)}`).toBeLessThanOrEqual(edge + 1e-9);
        // The title never opens in front of the drone, only under it or behind it.
        expect(f.edge).toBeGreaterThanOrEqual(f.x - 1e-9);
        expect(f.edge).toBeLessThanOrEqual(f.x + 0.5 * f.size);
        edge = f.edge;
      }
      expect(edge, name).toBeLessThanOrEqual(geo.title.x);
    }
  });

  it("is one line with no jump in it, from the first frame to the last", () => {
    for (const { name, geo } of SCREENS) {
      let prev = introAt(geo, 0);
      for (let t = STEP; t <= INTRO.done + 0.3; t += STEP) {
        const f = introAt(geo, t);
        const where = `${name} at ${t.toFixed(3)}`;
        // Under 3.2 screens a second anywhere, and no turn faster than four and a half a second.
        expect(Math.hypot(f.x - prev.x, f.y - prev.y), where).toBeLessThan(3.2 * geo.vw * STEP);
        expect(Math.abs(f.size - prev.size), where).toBeLessThan(0.04 * geo.hero.size + 2);
        expect(Math.abs(f.yaw - prev.yaw), where).toBeLessThan(4.5 * TAU * STEP);
        expect(Math.abs(f.pitch - prev.pitch), where).toBeLessThan(4.5 * TAU * STEP);
        expect(Math.abs(f.roll - prev.roll), where).toBeLessThan(4.5 * TAU * STEP);
        prev = f;
      }
    }
  });

  it("is never a straight, even glide: the speed and the height keep changing", () => {
    const geo = SCREENS[1]?.geo;
    if (!geo) throw new Error("no screen");
    const speeds: number[] = [];
    let up = 0;
    let down = 0;
    for (let t = 0.1; t < INTRO.pass - 0.1; t += 0.05) {
      const a = introAt(geo, t);
      const b = introAt(geo, t + STEP);
      speeds.push(Math.hypot(b.x - a.x, b.y - a.y) / STEP);
      if (b.y < a.y) up += 1;
      else down += 1;
    }
    expect(Math.max(...speeds) / Math.min(...speeds)).toBeGreaterThan(1.5);
    expect(up).toBeGreaterThan(3);
    expect(down).toBeGreaterThan(3);
    // It rolls right over on the way, and flips on the way down.
    expect(Math.abs(introAt(geo, 0.84).roll)).toBeGreaterThan(2);
    const flip = introAt(geo, (INTRO.out + INTRO.touch) / 2).pitch;
    expect(flip).toBeGreaterThan(1.5);
  });

  it("turns back at the left edge with part of it still on the screen", () => {
    for (const { name, geo } of SCREENS) {
      let least = 1;
      let leftmost = Infinity;
      for (let t = INTRO.pass; t <= INTRO.out; t += STEP) {
        const f = introAt(geo, t);
        least = Math.min(least, (f.x + f.size / 2) / f.size);
        leftmost = Math.min(leftmost, f.x - f.size / 2);
      }
      // It does leave the screen in part, and at least a third of it is always in view.
      expect(leftmost, name).toBeLessThan(0);
      expect(least, name).toBeGreaterThan(0.33);
      // It comes toward the visitor through the turn.
      expect(introAt(geo, INTRO.out).size, name).toBeGreaterThan(1.2 * passSize(geo));
    }
  });

  it("lands on its place with a real overshoot, then is at rest, upright, at its turn", () => {
    for (const { name, geo } of SCREENS) {
      let lowest = 0;
      for (let t = INTRO.touch; t <= INTRO.done; t += STEP) {
        lowest = Math.max(lowest, introAt(geo, t).y - geo.hero.y);
      }
      expect(lowest, name).toBeGreaterThan(0.01 * geo.vh);
      expect(lowest, name).toBeLessThan(0.08 * geo.vh);
      const end = introAt(geo, INTRO.done);
      expect(Math.abs(end.x - geo.hero.x), name).toBeLessThan(0.01 * geo.vw);
      expect(Math.abs(end.y - geo.hero.y), name).toBeLessThan(0.012 * geo.vh);
      expect(Math.abs(end.size - geo.hero.size), name).toBeLessThan(0.02 * geo.hero.size);
      expect(end.yaw).toBeCloseTo(geo.restTurn, 6);
      expect(offTurn(end.pitch)).toBeLessThan(0.05);
      expect(offTurn(end.roll)).toBeLessThan(0.02);
      expect(end.phase).toBe("done");
      // The wings open to brake as it arrives.
      expect(introAt(geo, INTRO.touch).flare).toBeGreaterThan(0.6);
      expect(end.flare).toBeLessThan(0.05);
    }
  });
});
