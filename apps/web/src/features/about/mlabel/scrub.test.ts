import { describe, expect, it } from "vitest";

import {
  drawKeys,
  follow,
  keyframes,
  PASS_MS,
  passOf,
  restOf,
  riseKeys,
  timeAt,
  transformOf,
  travelled,
} from "./scrub";

/** The functions of a transform, by name, in order. */
const functions = (t: string) => t.match(/[a-zA-Z]+(?=\()/g)?.filter((f) => f !== "calc") ?? [];

describe("the pass", () => {
  it("runs from the top at the foot of the screen to the foot at the top", () => {
    expect(travelled(900, 900)).toBe(0);
    expect(travelled(0, 900)).toBe(1);
    expect(travelled(-450, 900)).toBe(1.5);
    expect(passOf(900, 900)).toBe(2);
    expect(passOf(2160, 900)).toBeCloseTo(3.4);
    expect(timeAt(-1, 2)).toBe(0);
    expect(timeAt(1, 2)).toBe(PASS_MS / 2);
    expect(timeAt(9, 2)).toBe(PASS_MS);
  });
});

describe("keyframes", () => {
  it("hold their first and last poses to both ends, in order, inside the pass", () => {
    const frames = keyframes(riseKeys(0.3, 1.6), 2.4);
    expect(frames[0]?.offset).toBe(0);
    expect(frames.at(-1)?.offset).toBe(1);
    const offsets = frames.map((f) => Number(f.offset));
    expect([...offsets].sort((a, b) => a - b)).toEqual(offsets);
    for (const o of offsets) expect(o >= 0 && o <= 1).toBe(true);
    // Before the line rises it is under its mask; after it has left, over it.
    expect(frames[0]?.transform).toBe(frames[1]?.transform);
    expect(frames.at(-1)?.transform).toBe(frames.at(-2)?.transform);
  });

  it("write the same list of functions in every pose, so a pose never jumps", () => {
    const keys = [
      [0.1, { vw: 30, ry: -60, s: 1.3, o: 0 }],
      [0.7, { o: 1 }],
      [1.4, { y: -60, o: 0 }],
    ] as const;
    const frames = keyframes(keys, 2);
    const first = functions(String(frames[0]?.transform));
    expect(first).toContain("perspective");
    expect(first).toContain("rotateY");
    for (const f of frames) expect(functions(String(f.transform))).toEqual(first);
    // Without a turn there is no perspective, so a flat element is not lifted into 3D.
    expect(transformOf({ y: 10 })).not.toContain("perspective");
  });

  it("move only transform and opacity", () => {
    for (const f of keyframes(drawKeys(0.2, 1.2), 2)) {
      expect(Object.keys(f).sort()).toEqual(["easing", "offset", "opacity", "transform"]);
    }
  });
});

describe("the drawn point", () => {
  it("follows the scroll and lands on it", () => {
    let shown = 0;
    for (let i = 0; i < 120; i += 1) shown = follow(shown, 1.5, 3, 1 / 60);
    expect(shown).toBe(1.5);
  });

  it("does not play a far part through: the target is held just outside the pass", () => {
    expect(restOf(-8, 3)).toBeCloseTo(-0.02);
    expect(restOf(40, 3)).toBeCloseTo(3.02);
    // A part far below comes in from its first pose, not from far away.
    expect(follow(-30, 1, 3, 0)).toBeCloseTo(-0.02);
  });

  it("never jumps more than the spring allows in one frame, however far the scroll went", () => {
    const step = follow(0, 3, 3, 1 / 60) - 0;
    expect(step).toBeLessThan(0.6);
    expect(step).toBeGreaterThan(0);
  });
});
