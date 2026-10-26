import { describe, expect, it } from "vitest";

import { DOOR_LOCK_MS, DOOR_TIMES, sideOf, speedFor } from "./door-math";

describe("sideOf", () => {
  it("is before everything above the section and after it from its first screen on", () => {
    expect(sideOf(0, 5000)).toBe("before");
    expect(sideOf(4997, 5000)).toBe("before");
    expect(sideOf(4998, 5000)).toBe("after");
    expect(sideOf(5000, 5000)).toBe("after");
    expect(sideOf(9000, 5000)).toBe("after");
  });

  it("is before while the boundary is not measured yet", () => {
    expect(sideOf(9000, null)).toBe("before");
  });
});

describe("door times", () => {
  it("keeps the lock longer than the whole scene, so the net never opens a scene early", () => {
    const longest =
      DOOR_TIMES.leaveMax + DOOR_TIMES.close + DOOR_TIMES.readyMax + DOOR_TIMES.arrivalMax;
    expect(DOOR_LOCK_MS / 1000).toBeGreaterThan(longest - DOOR_TIMES.leaveMax);
  });

  it("plays shorter on a weak device and the same otherwise", () => {
    expect(speedFor("full")).toBe(1);
    expect(speedFor("balanced")).toBe(1);
    expect(speedFor("lite")).toBeLessThan(1);
  });
});
