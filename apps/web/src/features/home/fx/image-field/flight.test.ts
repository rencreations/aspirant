import { describe, expect, it } from "vitest";

import { buildFormations, poseOf, rankCards } from "./formations";
import {
  FLIGHT,
  backEase,
  flightOf,
  flightPose,
  flyFormation,
  hash01,
  landsAt,
  makeFlight,
} from "./flight";
import { makePose, type Vp } from "./types";

const N = 18;
const SIZES: Vp[] = [
  { w: 1440, h: 900 },
  { w: 1706, h: 950 },
  { w: 390, h: 844 },
];

function flights(rankOf: (i: number) => number) {
  return Array.from({ length: N }, (_, i) => flightOf(i, rankOf(i), makeFlight()));
}

describe("the paper entrance", () => {
  it("is deterministic: the same card and rank give the same flight", () => {
    for (let i = 0; i < N; i++) {
      const a = flightOf(i, i / (N - 1), makeFlight());
      const b = flightOf(i, i / (N - 1), makeFlight());
      expect(a).toEqual(b);
    }
    expect(hash01(3, 4)).toBe(hash01(3, 4));
    expect(hash01(3, 4)).not.toBe(hash01(4, 3));
  });

  it("gives the cards different durations, inside 1.4 to 2.6 s, all down by the total", () => {
    const fs = flights((i) => i / (N - 1));
    const durations = fs.map((f) => f.duration);
    expect(Math.min(...durations)).toBeGreaterThanOrEqual(FLIGHT.minDuration - 1e-9);
    expect(Math.max(...durations)).toBeLessThanOrEqual(FLIGHT.maxDuration + 1e-9);
    expect(new Set(durations.map((d) => d.toFixed(3))).size).toBeGreaterThanOrEqual(N - 2);
    expect(Math.max(...durations) - Math.min(...durations)).toBeGreaterThan(0.4);
    for (const f of fs) expect(landsAt(f)).toBeLessThanOrEqual(FLIGHT.total + 1e-9);
  });

  it("starts the cards nearest the middle first, over a stagger of about 0.9 s", () => {
    const fs = flights((i) => i / (N - 1));
    // The jitter is small: the trend is the rank.
    expect(fs[0]!.delay).toBeLessThan(0.1);
    expect(fs[N - 1]!.delay).toBeGreaterThan(FLIGHT.stagger - 0.1);
    expect(fs[N - 1]!.delay).toBeLessThan(FLIGHT.stagger + 0.1);
    for (let i = 1; i < N; i++) expect(fs[i]!.delay).toBeGreaterThan(fs[i - 1]!.delay - 0.1);
  });

  it("the back ease launches fast, passes the mark, overshoots a little and lands with no speed", () => {
    for (const c of [0.9, 1.2, 1.5]) {
      expect(backEase(0, c)).toBeCloseTo(0, 12);
      expect(backEase(1, c)).toBe(1);
      let peak = 0;
      for (let s = 0; s <= 1; s += 0.001) peak = Math.max(peak, backEase(s, c));
      expect(peak).toBeGreaterThan(1.02);
      expect(peak).toBeLessThan(1.09);
      // The first tenth covers well over a tenth of the way (a fast launch).
      expect(backEase(0.1, c)).toBeGreaterThan(0.25);
      // The last thousandth is nearly still.
      expect((backEase(1, c) - backEase(0.999, c)) / 0.001).toBeLessThan(0.01 * (c + 1) * 3);
    }
  });

  for (const vp of SIZES) {
    const name = `${vp.w}x${vp.h}`;
    const set = buildFormations(N, vp);
    const rank = new Float64Array(set.total);
    rankCards(set, { name: "origin" }, "centre", 0, rank);
    const origin = makePose();
    const target = makePose();
    const out = makePose();
    const prev = makePose();

    it(`starts at the logo's heap and ends exactly on the scatter, at rest (${name})`, () => {
      for (let i = 0; i < N; i++) {
        poseOf(set, "origin", 0, i, 0, origin);
        poseOf(set, "scatter", 0, i, 0, target);
        const f = flightOf(i, rank[i]!, makeFlight());
        // Before its start: the heap, every field.
        flyFormation(set, { name: "scatter" }, 0, rank[i]!, i, 0, out);
        expect(out).toEqual(origin);
        // After the landing: the scatter, every field.
        flyFormation(set, { name: "scatter" }, landsAt(f), rank[i]!, i, 0, out);
        expect(out).toEqual(target);
        flyFormation(set, { name: "scatter" }, FLIGHT.total, rank[i]!, i, 0, out);
        expect(out).toEqual(target);
        // No speed at the end: the last 10 ms move the card by under 0.2 px and the tilt by next to nothing.
        flightPose(origin, target, f, landsAt(f) - 0.01, prev);
        const gap = Math.hypot(prev.x - target.x, prev.y - target.y);
        const average = Math.hypot(target.x - origin.x, target.y - origin.y) / f.duration;
        expect(gap / 0.01, `card ${i} speed at the end`).toBeLessThan(0.1 * average);
        expect(gap).toBeLessThan(0.5);
        expect(Math.abs(prev.z - target.z)).toBeLessThan(0.5);
      }
    });

    it(`curves: no card goes in a straight line, and the paths differ (${name})`, () => {
      const bows: number[] = [];
      for (let i = 0; i < N; i++) {
        poseOf(set, "origin", 0, i, 0, origin);
        poseOf(set, "scatter", 0, i, 0, target);
        const f = flightOf(i, rank[i]!, makeFlight());
        const dx = target.x - origin.x;
        const dy = target.y - origin.y;
        const len = Math.hypot(dx, dy);
        let widest = 0;
        for (let k = 1; k < 200; k++) {
          flightPose(origin, target, f, f.delay + (f.duration * k) / 200, out);
          // The distance of the card from the chord.
          widest = Math.max(
            widest,
            Math.abs((out.x - origin.x) * dy - (out.y - origin.y) * dx) / len,
          );
        }
        expect(widest, `card ${i}`).toBeGreaterThan(0.03 * len);
        bows.push(widest / len);
      }
      expect(Math.max(...bows) - Math.min(...bows)).toBeGreaterThan(0.05);
    });

    it(`sways and tumbles, then settles, and grows out of the heap (${name})`, () => {
      for (let i = 0; i < N; i++) {
        poseOf(set, "origin", 0, i, 0, origin);
        poseOf(set, "scatter", 0, i, 0, target);
        const f = flightOf(i, rank[i]!, makeFlight());
        let moved = 0;
        let lastH = origin.h - 1;
        let lift = 0;
        for (let k = 1; k < 100; k++) {
          flightPose(origin, target, f, f.delay + (f.duration * k) / 100, out);
          // The tumble: the card is not flat in the middle of the flight.
          if (k === 40) moved = Math.abs(out.q[0]) + Math.abs(out.q[1]) + Math.abs(out.q[2]);
          // It only grows (no shrinking on the way).
          expect(out.h).toBeGreaterThanOrEqual(lastH - 1e-9);
          lastH = out.h;
          lift = Math.max(lift, out.z - target.z);
          expect(out.opacity).toBeLessThanOrEqual(target.opacity + 1e-9);
          expect(out.live).toBeLessThanOrEqual(target.live + 1e-9);
        }
        expect(moved, `card ${i} tumble`).toBeGreaterThan(0.1);
        expect(lift, `card ${i} lift`).toBeGreaterThan(10);
        // Near the end the tumble has died away: the tilt is the card's own.
        flightPose(origin, target, f, f.delay + f.duration * 0.98, out);
        for (let a = 0; a < 3; a++) expect(Math.abs(out.q[a]! - target.q[a]!)).toBeLessThan(0.05);
      }
    });

    it(`gives each card its own tumble: the roll differs from card to card (${name})`, () => {
      const rolls = new Set<string>();
      for (let i = 0; i < N; i++) {
        const f = flightOf(i, rank[i]!, makeFlight());
        rolls.add(`${f.roll.cycles.toFixed(3)}:${f.roll.phase.toFixed(3)}`);
      }
      expect(rolls.size).toBe(N);
    });

    it(`leaves the wall only cells where they are (${name})`, () => {
      for (let i = set.n; i < set.total; i++) {
        poseOf(set, "scatter", 0, i, 0, target);
        flyFormation(set, { name: "scatter" }, 0.4, 1, i, 0, out);
        expect(out).toEqual(target);
      }
    });
  }
});
