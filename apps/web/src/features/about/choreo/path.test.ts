import { describe, expect, it } from "vitest";

import { holdEnd, morphEnd, uncovered } from "../film-geometry";

import { MEASURED } from "./measured.fixture";
import {
  buildPath,
  CLEAR_REACH,
  completeLayout,
  defaultAnchors,
  EDGE,
  SEEN_MIN,
  type AnchorBox,
  type Path,
} from "./path";

/** The four screens the page is judged on, with the bar and the gutter the site gives them. */
const SCREENS = [
  { name: "1366x768", vw: 1366, vh: 768 },
  { name: "1440x900", vw: 1440, vh: 900 },
  { name: "1920x1080", vw: 1920, vh: 1080 },
  { name: "390x844", vw: 390, vh: 844 },
].map((s) => {
  const wide = s.vw >= 901;
  const rem = 16;
  const gutter = wide
    ? Math.min(7 * rem, Math.max(3.5 * rem, 2.2 * rem + 0.025641 * s.vw))
    : Math.min(6 * rem, Math.max(rem, 0.4872 * rem + 0.025641 * s.vw));
  return { ...s, navH: wide ? 80 : 64, gutter };
});

const pathFor = (s: (typeof SCREENS)[number], measured: AnchorBox[] = []) =>
  buildPath(completeLayout(s.vw, s.vh, s.navH, s.gutter, measured));

/**
 * Every layout the rules must hold on: the four screens with nothing placed (the defaults), and
 * the same four as the page really lays them out.
 */
const CASES: Array<{ name: string; vw: number; vh: number; navH: number; path: Path }> = [
  ...SCREENS.map((s) => ({ ...s, name: `${s.name} default`, path: pathFor(s) })),
  ...MEASURED.map((m) => ({
    name: `${m.name} measured`,
    vw: m.layout.vw,
    vh: m.layout.vh,
    navH: m.layout.navH,
    path: buildPath(
      completeLayout(
        m.layout.vw,
        m.layout.vh,
        m.layout.navH,
        m.layout.gutter,
        m.layout.anchors,
        m.layout.slot,
      ),
    ),
  })),
];

describe("the drone's path", () => {
  it("starts at the hero anchor and names the four stations in order", () => {
    for (const s of SCREENS) {
      const path = pathFor(s);
      const hero = defaultAnchors(s.vw, s.vh, s.navH, s.gutter)[0];
      const t = path.at(0);
      expect(t.station).toBe("hero");
      expect(t.x).toBeCloseTo(hero?.x ?? 0, 5);
      expect(t.y).toBeCloseTo(hero?.y ?? 0, 5);
      expect(t.size).toBeCloseTo(hero?.w ?? 0, 5);
      expect(path.stations.map((x) => x.id)).toEqual(["hero", "perch", "center", "dock"]);
    }
    for (const c of CASES) {
      expect(c.path.stations.slice(0, 4).map((x) => x.id)).toEqual([
        "hero",
        "perch",
        "center",
        "dock",
      ]);
      for (let i = 1; i < c.path.stations.length; i += 1) {
        const a = c.path.stations[i - 1];
        const b = c.path.stations[i];
        expect(b?.arrive ?? 0, `${c.name} station ${i}`).toBeGreaterThan(a?.leave ?? 0);
        expect(a?.leave ?? 0, `${c.name} station ${i - 1}`).toBeGreaterThanOrEqual(a?.arrive ?? 0);
      }
    }
  });

  it("sits on the perch from the end of the morph until shortly before the stage lets go", () => {
    for (const c of CASES) {
      const perch = c.path.layout.anchors[1];
      for (const y of [morphEnd(c.vh), morphEnd(c.vh) + 0.3 * c.vh, holdEnd(c.vh) - 0.25 * c.vh]) {
        const t = c.path.at(y);
        expect(t.station, c.name).toBe("perch");
        expect(t.travelling).toBe(0);
        expect(t.x).toBeCloseTo(perch?.x ?? 0, 5);
        // At the anchor, or raised from it so that its face is over the window's edge.
        expect(t.y).toBeLessThanOrEqual((perch?.y ?? 0) + 1e-6);
        expect(t.y - t.size / 2, c.name).toBeGreaterThanOrEqual(c.navH + EDGE - 0.01);
        expect(uncovered(t.x, t.y, t.size / 2, c.path.film(y)), c.name).toBeGreaterThan(0.75);
        expect(uncovered(t.x, t.y, t.size / 2, c.path.film(y)), c.name).toBeLessThan(1);
      }
      expect(c.path.at(holdEnd(c.vh) - 0.05 * c.vh).travelling).toBeGreaterThan(0);
    }
  });

  it("never jumps: a small step of the scroll is a small step of the drone", () => {
    for (const c of CASES) {
      const lastArrive = c.path.stations[c.path.stations.length - 1]?.arrive ?? 0;
      const end = lastArrive + 2 * c.vh;
      let prev = c.path.at(0);
      for (let y = 2; y <= end; y += 2) {
        const t = c.path.at(y);
        const step = Math.hypot(t.x - prev.x, t.y - prev.y);
        expect(step, `${c.name} at ${y}`).toBeLessThan(14);
        expect(Math.abs(t.size - prev.size), `${c.name} size at ${y}`).toBeLessThan(12);
        prev = t;
      }
    }
  });

  it("stays mostly in view: clear of the film, or in front of it", () => {
    for (const c of CASES) {
      let worst = 1;
      let where = 0;
      for (let y = 0; y <= (c.path.stations[2]?.arrive ?? 0); y += 6) {
        const t = c.path.at(y);
        const seen =
          c.path.side(y) === "front" ? 1 : uncovered(t.x, t.y, t.size / 2, c.path.film(y));
        if (seen < worst) {
          worst = seen;
          where = y;
        }
      }
      expect(worst, `${c.name} at ${where}`).toBeGreaterThanOrEqual(SEEN_MIN);
    }
  });

  it("changes sides of the film only where nothing of it is behind the film", () => {
    for (const c of CASES) {
      const end = c.path.stations[2]?.arrive ?? 0;
      let flips = 0;
      for (let y = 1; y <= end; y += 1) {
        if (c.path.side(y) === c.path.side(y - 1)) continue;
        flips += 1;
        const t = c.path.at(y);
        const where = `${c.name} at ${y}`;
        expect(uncovered(t.x, t.y, t.size * CLEAR_REACH, c.path.film(y)), where).toBe(1);
      }
      // Off the perch on every screen. Where the film is as wide as the screen, twice more.
      expect(flips, c.name).toBe(c.path.crossing ? 3 : 1);
      expect(c.path.side(0)).toBe("behind");
      expect(c.path.side((c.path.stations[1]?.arrive ?? 0) + 5)).toBe("behind");
      expect(c.path.side(end)).toBe("front");
    }
    const crossing = (name: string) => CASES.find((c) => c.name === name)?.path.crossing;
    expect(crossing("390x844 default")).toBe(true);
    expect(crossing("1440x900 default")).toBe(false);
    expect(crossing("1440x900 measured")).toBe(false);
  });

  it("is whole on the screen and clear of the bar, except where the hero cuts it on purpose", () => {
    for (const c of CASES) {
      const from = 0.4 * morphEnd(c.vh);
      // Up to the last station but one: the last anchor leaves with the page.
      const end = c.path.stations[c.path.stations.length - 1]?.arrive ?? 0;
      for (let y = from; y <= end; y += 6) {
        const t = c.path.at(y);
        const r = t.size / 2;
        const where = `${c.name} at ${Math.round(y)}`;
        expect(t.x - r, where).toBeGreaterThanOrEqual(EDGE - 0.01);
        expect(t.x + r, where).toBeLessThanOrEqual(c.vw - EDGE + 0.01);
        expect(t.y - r, where).toBeGreaterThanOrEqual(c.navH + EDGE - 0.01);
        expect(t.y + r, where).toBeLessThanOrEqual(c.vh - EDGE + 0.01);
      }
    }
  });

  it("is in the middle of the screen, big, for the statement, then rides the dock away", () => {
    for (const s of SCREENS) {
      const path = pathFor(s);
      const center = path.stations[2];
      const dock = path.stations[3];
      const mid = path.at(((center?.arrive ?? 0) + (center?.leave ?? 0)) / 2);
      expect(mid.station).toBe("center");
      expect(mid.x).toBeCloseTo(s.vw / 2, 3);
      expect(mid.y).toBeCloseTo(s.vh / 2, 3);
      expect(mid.size).toBeGreaterThan(path.at(morphEnd(s.vh)).size * 2);
      const a = path.at((dock?.arrive ?? 0) + 10);
      const b = path.at((dock?.arrive ?? 0) + 110);
      expect(a.station).toBe("dock");
      expect(a.y - b.y).toBeCloseTo(100, 3);
    }
    // As the page places it: the statement holds the drone for a real stretch of the scroll.
    for (const c of CASES) {
      const center = c.path.stations[2];
      const held = (center?.leave ?? 0) - (center?.arrive ?? 0);
      expect(held, c.name).toBeGreaterThan(0.2 * c.vh);
      const mid = c.path.at(((center?.arrive ?? 0) + (center?.leave ?? 0)) / 2);
      expect(mid.x, c.name).toBeCloseTo(c.vw / 2, 0);
      expect(Math.abs(mid.y - c.vh / 2), c.name).toBeLessThan(0.12 * c.vh);
    }
  });

  it("follows the anchors the page gives it, and the plain rule after the dock", () => {
    const s = SCREENS[1];
    if (!s) throw new Error("no screen");
    const base = defaultAnchors(s.vw, s.vh, s.navH, s.gutter);
    const dockY = base[3]?.y ?? 0;
    const extra: AnchorBox[] = [
      { id: "phase-2", x: 1200, y: dockY + 2400, w: 120, face: "happy" },
      { id: "phase-1", x: 240, y: dockY + 1300, w: 140, turn: 0.4 },
      { id: "above", x: 10, y: 100, w: 50 },
    ];
    const path = pathFor(s, extra);
    expect(path.stations.map((x) => x.id)).toEqual([
      "hero",
      "perch",
      "center",
      "dock",
      "phase-1",
      "phase-2",
    ]);
    // In the middle band of the screen the drone is at the anchor and rides with it.
    const at1 = path.at(dockY + 1300 - 0.5 * s.vh);
    expect(at1.station).toBe("phase-1");
    expect(at1.x).toBeCloseTo(240, 3);
    expect(at1.y).toBeCloseTo(0.5 * s.vh, 3);
    expect(at1.restTurn).toBeCloseTo(0.4, 5);
    // Between two anchors it waits on the screen, under the bar, and then flies.
    const waiting = path.at(dockY + 1300 + 0.2 * s.vh);
    expect(waiting.y - waiting.size / 2).toBeGreaterThanOrEqual(s.navH + EDGE - 0.01);
    const at2 = path.at(dockY + 2400 - 0.5 * s.vh);
    expect(at2.station).toBe("phase-2");
    expect(at2.face).toBe("happy");
    // The last anchor leaves with the page.
    expect(path.at(dockY + 2400 + s.vh).y).toBeLessThan(0);
  });

  it("takes a measured sticky anchor as it stands on the screen", () => {
    const s = SCREENS[1];
    if (!s) throw new Error("no screen");
    const from = 2.3 * s.vh;
    const path = pathFor(s, [
      { id: "center", x: 700, y: from + 430, w: 400, stick: { from, to: from + 900 } },
      { id: "dock", x: 720, y: from + 900 + 1000, w: 110 },
    ]);
    const center = path.stations[2];
    const t = path.at((center?.arrive ?? 0) + 5);
    expect(t.station).toBe("center");
    expect(t.x).toBeCloseTo(700, 3);
    expect(t.y).toBeCloseTo(430, 3);
    expect(t.size).toBeCloseTo(400, 3);
  });
});
