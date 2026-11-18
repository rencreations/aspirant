import { describe, expect, it } from "vitest";

import { HitField, segmentDistance } from "./hit";

describe("segmentDistance", () => {
  it("is 0 on the segment, the distance to an end beyond it", () => {
    expect(segmentDistance(5, 0, 0, 0, 10, 0).d).toBe(0);
    expect(segmentDistance(5, 3, 0, 0, 10, 0).d).toBe(3);
    const past = segmentDistance(14, 3, 0, 0, 10, 0);
    expect(past.d).toBe(5);
    expect(past.t).toBe(1);
    expect(segmentDistance(-3, 4, 0, 0, 10, 0).t).toBe(0);
  });

  it("copes with a segment that is a point", () => {
    expect(segmentDistance(3, 4, 0, 0, 0, 0).d).toBe(5);
  });
});

describe("HitField", () => {
  it("hits inside a capsule and misses outside it", () => {
    const f = new HitField(8);
    const start = f.mark();
    f.add(0, 0, 0, 100, 0, 0, 10, 1000);
    const n = f.count(start);
    expect(f.test(start, n, 50, 5, 0)).toBe(1000);
    expect(f.test(start, n, 50, 12, 0)).toBeNull();
    expect(f.test(start, n, 112, 0, 0)).toBeNull();
  });

  it("projects: a capsule nearer the camera is larger on the screen and nearer in depth", () => {
    const f = new HitField(8);
    f.add(0, 0, 500, 100, 0, 500, 10, 1000);
    // Factor 2: the capsule spans 0..200 on the screen and is 20 px thick.
    expect(f.test(0, 1, 150, 15, 0)).toBe(500);
    expect(f.test(0, 1, 150, 25, 0)).toBeNull();
  });

  it("the part with the smaller bias wins an overlap", () => {
    const f = new HitField(8);
    const a = f.mark();
    f.add(0, 0, 0, 100, 0, 0, 20, 1000);
    const na = f.count(a);
    const b = f.mark();
    f.add(0, 0, 0, 100, 0, 0, 20, 1000);
    const nb = f.count(b);
    expect(f.test(a, na, 50, 0, -6)).toBeLessThan(f.test(b, nb, 50, 0, 2)!);
  });

  it("the depth follows the nearest point along the capsule", () => {
    const f = new HitField(8);
    f.add(0, 0, 0, 100, 0, 400, 30, 1000);
    const near = f.test(0, 1, 99, 0, 0)!;
    const far = f.test(0, 1, 1, 0, 0)!;
    expect(near).toBeLessThan(far);
  });

  it("clear forgets and a full pool ignores more", () => {
    const f = new HitField(2);
    f.add(0, 0, 0, 10, 0, 0, 5, 1000);
    f.add(0, 0, 0, 10, 0, 0, 5, 1000);
    f.add(50, 50, 0, 60, 50, 0, 5, 1000);
    expect(f.count(0)).toBe(2);
    expect(f.test(0, f.count(0), 55, 50, 0)).toBeNull();
    f.clear();
    expect(f.mark()).toBe(0);
    expect(f.count(0)).toBe(0);
  });
});
