import { describe, expect, it } from "vitest";

import { distToSegment, handHit, makeShape, onHand } from "./hit";

describe("distToSegment", () => {
  it("is the distance to the nearest point of the segment", () => {
    expect(distToSegment(0, 5, -10, 0, 10, 0)).toBe(5);
    // Past an end, the end is the nearest point.
    expect(distToSegment(13, 4, -10, 0, 10, 0)).toBe(5);
    // A segment with no length is a point.
    expect(distToSegment(3, 4, 0, 0, 0, 0)).toBe(5);
  });
});

describe("the hand's shape", () => {
  function shape() {
    const s = makeShape();
    s.palmX = 0;
    s.palmY = -200;
    s.palmR = 60;
    s.depth = 900;
    // The index finger: from the knuckle (-40, -140) to the tip (-40, 60), 20 px wide each side.
    s.fingers[1] = { ax: -40, ay: -140, bx: -40, by: 60, r: 20 };
    return s;
  }

  it("holds a palm and five fingers", () => {
    expect(makeShape().fingers).toHaveLength(5);
  });

  it("is on the palm, on a finger, and nowhere else", () => {
    const s = shape();
    expect(onHand(s, 10, -180)).toBe(true);
    expect(onHand(s, -45, 0)).toBe(true);
    expect(onHand(s, 100, 100)).toBe(false);
    // Between two fingers, beyond the radius of the index.
    expect(onHand(s, -10, 0)).toBe(false);
  });

  it("answers with the depth plus a bias that lets a thing standing in the palm win", () => {
    const s = shape();
    expect(handHit(s, 0, -200, 25)).toBe(925);
    expect(handHit(s, 500, 500, 25)).toBeNull();
  });
});
