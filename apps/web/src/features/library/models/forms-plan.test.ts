import { describe, expect, it } from "vitest";

import {
  changeTimes,
  FADE_TO_IDLE,
  FADE_TO_REST,
  HOLD_IDLE,
  legOf,
  otherForm,
  readForms,
} from "./forms-plan";

const leg = {
  first: "normal/to-abyssal",
  hideAt: 1.2,
  second: "abyssal/from-normal",
  secondFrom: 0.1,
};

describe("the change between Selena's forms", () => {
  it("blends into the idle first, then plays the first clip, swaps at the hide, then rests", () => {
    const t = changeTimes(leg, false, 0.7);
    expect(t.idleAt).toBeCloseTo(FADE_TO_IDLE, 9);
    expect(t.firstAt).toBeCloseTo(FADE_TO_IDLE + HOLD_IDLE, 9);
    expect(t.swapAt).toBeCloseTo(t.firstAt + 1.2, 9);
    expect(t.settleAt).toBeCloseTo(t.swapAt + 0.6 - FADE_TO_REST, 9);
    expect(t.doneAt).toBeCloseTo(t.settleAt + FADE_TO_REST, 9);
  });

  it("skips the first blend when the form already rests in its idle", () => {
    expect(changeTimes(leg, true, 0.7).idleAt).toBe(0);
  });

  it("never settles before the swap, even with a very short second clip", () => {
    const t = changeTimes(leg, true, 0.05);
    expect(t.settleAt).toBeGreaterThanOrEqual(t.swapAt);
  });

  it("picks the leg by the form that leaves", () => {
    const data = readForms({ toAbyssal: leg, toNormal: { ...leg, first: "abyssal/to-normal" } });
    expect(data).not.toBeNull();
    if (!data) return;
    expect(legOf(data, "normal").first).toBe("normal/to-abyssal");
    expect(legOf(data, "abyssal").first).toBe("abyssal/to-normal");
    expect(otherForm("normal")).toBe("abyssal");
    expect(otherForm("abyssal")).toBe("normal");
  });

  it("refuses a record that lacks a leg", () => {
    expect(readForms({ toAbyssal: leg })).toBeNull();
    expect(readForms(null)).toBeNull();
  });
});
