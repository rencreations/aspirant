import { describe, expect, it } from "vitest";

import { Clock, DT_MAX, ORDER, clampDt } from "./clock";

describe("clampDt", () => {
  it("turns milliseconds into seconds", () => {
    expect(clampDt(16)).toBeCloseTo(0.016);
  });

  it("never lets a frame take more than DT_MAX (a tab that comes back does not leap)", () => {
    expect(clampDt(5000)).toBe(DT_MAX);
  });

  it("is zero for a clock that did not move or went backwards", () => {
    expect(clampDt(0)).toBe(0);
    expect(clampDt(-30)).toBe(0);
    expect(clampDt(Number.NaN)).toBe(0);
  });
});

describe("Clock", () => {
  it("runs the callbacks in their order, ties in the order they were added", () => {
    const clock = new Clock();
    const seen: string[] = [];
    clock.add(() => seen.push("draw"), ORDER.draw);
    clock.add(() => seen.push("scroll"), ORDER.scroll);
    clock.add(() => seen.push("sections-1"), ORDER.sections);
    clock.add(() => seen.push("sections-2"), ORDER.sections);
    clock.tick(0);
    expect(seen).toEqual(["scroll", "sections-1", "sections-2", "draw"]);
  });

  it("gives the first frame a dt of 0, then the elapsed time", () => {
    const clock = new Clock();
    const dts: number[] = [];
    clock.add((f) => dts.push(f.dt));
    clock.tick(1000);
    clock.tick(1016);
    clock.tick(1032);
    expect(dts[0]).toBe(0);
    expect(dts[1]).toBeCloseTo(0.016);
    expect(dts[2]).toBeCloseTo(0.016);
  });

  it("counts frames and adds up time with the clamp", () => {
    const clock = new Clock();
    const seen: Array<{ time: number; frame: number }> = [];
    clock.add((f) => seen.push({ time: f.time, frame: f.frame }));
    clock.tick(0);
    clock.tick(20);
    clock.tick(10_000);
    expect(seen.map((s) => s.frame)).toEqual([0, 1, 2]);
    expect(seen[2]?.time).toBeCloseTo(0.02 + DT_MAX);
  });

  it("takes a callback out when asked, also from inside a frame", () => {
    const clock = new Clock();
    let calls = 0;
    const remove = clock.add(() => {
      calls++;
      remove();
    });
    clock.tick(0);
    clock.tick(16);
    expect(calls).toBe(1);
  });
});
