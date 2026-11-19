import { describe, expect, it } from "vitest";

import {
  ORIGIN_SCALE,
  blendFormations,
  buildFormations,
  poseOf,
  rankCards,
  staggered,
} from "./formations";
import { BASE_DISTANCE } from "./project";
import { logoBox } from "./scatter";
import { makePose, type Vp } from "./types";

/** The hero's entrance: the cards expand from a heap behind the logo to the scatter. */
const SIZES: Vp[] = [
  { w: 1440, h: 900 },
  { w: 1706, h: 950 },
  { w: 390, h: 844 },
];
const N = 24;

describe("the origin formation (the heap behind the logo)", () => {
  for (const vp of SIZES) {
    const name = `${vp.w}x${vp.h}`;
    const set = buildFormations(N, vp);

    it(`puts every card inside the logo's box, small and flat (${name})`, () => {
      const box = logoBox(vp);
      const pose = makePose();
      const scatter = makePose();
      for (let i = 0; i < N; i++) {
        poseOf(set, "origin", 0, i, 0, pose);
        poseOf(set, "scatter", 0, i, 0, scatter);
        expect(pose.h).toBeCloseTo(scatter.h * ORIGIN_SCALE, 9);
        expect(pose.x).toBeCloseTo(scatter.x * ORIGIN_SCALE, 9);
        expect(pose.y).toBe(0);
        expect(pose.z).toBe(scatter.z);
        expect(pose.q).toEqual([0, 0, 0, 1]);
        // On the screen: the card's centre and all of its edges are behind the logo.
        const s = BASE_DISTANCE / (BASE_DISTANCE - pose.z);
        const halfH = (pose.h * s) / 2;
        const halfW = halfH * pose.aspect;
        expect(Math.abs(pose.x * s) + halfW, `card ${i}`).toBeLessThan(box.hw);
        expect(Math.abs(pose.y * s) + halfH, `card ${i}`).toBeLessThan(box.hh);
      }
    });

    it(`ends on the scatter, whatever the stagger (${name})`, () => {
      const rank = new Float64Array(set.total);
      rankCards(set, { name: "origin" }, "centre", 0, rank);
      const out = makePose();
      const scatter = makePose();
      for (let i = 0; i < N; i++) {
        blendFormations(set, { name: "origin" }, { name: "scatter" }, 1, 0.3, rank[i]!, i, 0, out);
        poseOf(set, "scatter", 0, i, 0, scatter);
        expect(out.x).toBeCloseTo(scatter.x, 9);
        expect(out.y).toBeCloseTo(scatter.y, 9);
        expect(out.h).toBeCloseTo(scatter.h, 9);
      }
    });

    it(`sends the cards nearest the middle first (${name})`, () => {
      const rank = new Float64Array(set.total);
      rankCards(set, { name: "origin" }, "centre", 0, rank);
      const dist = (i: number): number => {
        const p = makePose();
        poseOf(set, "scatter", 0, i, 0, p);
        const s = BASE_DISTANCE / (BASE_DISTANCE - p.z);
        return Math.hypot(p.x, p.y) * s;
      };
      for (let i = 0; i < N; i++) {
        for (let j = 0; j < N; j++) {
          if (dist(i) < dist(j) - 1e-6) expect(rank[i]!).toBeLessThan(rank[j]!);
        }
      }
      expect(Math.min(...rank.slice(0, N))).toBe(0);
    });
  }

  it("starts every card at once: the last card starts after at most a third of the entrance", () => {
    const spread = 0.3;
    expect(staggered(0, 0, spread)).toBe(0);
    // The farthest card (rank 1) has begun by a third of the way.
    expect(staggered(0.34, 1, spread)).toBeGreaterThan(0);
    // The nearest card is at its place before the entrance has ended, and every card is at its place at the end.
    expect(staggered(1, 0, spread)).toBe(1);
    expect(staggered(1, 1, spread)).toBe(1);
  });
});
