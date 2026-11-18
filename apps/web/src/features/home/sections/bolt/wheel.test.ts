import { describe, expect, it } from "vitest";

import { BEAT, WHEEL_FROM, WHEEL_ITEMS, WHEEL_STEP } from "./stations";
import { wheelEnvelope, wheelItem, wheelPlace, wheelTransform, type WheelItem } from "./wheel";

const item = (): WheelItem => ({ y: 0, z: 0, scale: 1, rotX: 0, opacity: 0 });

describe("the text wheel", () => {
  it("shows the item in focus whole and upright", () => {
    const it = wheelItem(0, item());
    expect(it.opacity).toBe(1);
    expect(it.scale).toBe(1);
    expect(it.y).toBeCloseTo(0, 6);
    expect(it.z).toBeCloseTo(0, 6);
    expect(it.rotX).toBeCloseTo(0, 6);
  });

  it("dims, shrinks and tilts the neighbours, and hides what is past one and a half", () => {
    const next = wheelItem(1, item());
    expect(next.opacity).toBeCloseTo(0.4, 6);
    expect(next.scale).toBeCloseTo(0.85, 6);
    expect(next.rotX).toBeCloseTo(-25, 6);
    expect(next.z).toBeCloseTo(-100, 6);
    expect(wheelItem(1.6, item()).opacity).toBe(0);
    expect(wheelItem(-1.6, item()).opacity).toBe(0);
  });

  it("is mirrored above and below the focus", () => {
    const up = wheelItem(-1, item());
    const down = wheelItem(1, item());
    expect(up.y).toBeCloseTo(-down.y, 6);
    expect(up.opacity).toBeCloseTo(down.opacity, 6);
    expect(up.rotX).toBeCloseTo(-down.rotX, 6);
  });

  it("writes the same string for the same place", () => {
    expect(wheelTransform(wheelItem(0.5, item()))).toBe(wheelTransform(wheelItem(0.5, item())));
    expect(wheelTransform(wheelItem(0, item()))).toContain("translate3d(0, 0.000em");
  });

  it("has the first pair in focus at the start of the wheel and the last one five steps later", () => {
    expect(wheelPlace(WHEEL_FROM)).toBeCloseTo(0, 6);
    expect(wheelPlace(WHEEL_FROM + (WHEEL_ITEMS - 1) * WHEEL_STEP)).toBeCloseTo(WHEEL_ITEMS - 1, 6);
  });

  it("stays inside the section: every pair gets its turn while the dragon is at the middle or leaving", () => {
    const last = WHEEL_FROM + (WHEEL_ITEMS - 1) * WHEEL_STEP;
    expect(WHEEL_FROM).toBeGreaterThan(BEAT.enter);
    expect(last).toBeLessThanOrEqual(BEAT.launch);
  });

  it("hides the whole wheel before the dragon arrives and after it has left", () => {
    expect(wheelEnvelope(0.2)).toBe(0);
    expect(wheelEnvelope(WHEEL_FROM)).toBe(1);
    expect(wheelEnvelope(BEAT.leave)).toBe(1);
    expect(wheelEnvelope(BEAT.launch)).toBe(0);
  });
});
