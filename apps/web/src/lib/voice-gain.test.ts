import { describe, expect, it } from "vitest";

import { VOICE_BUS_GAIN, dbToLinear, voiceLevel } from "./voice-gain";

describe("dbToLinear", () => {
  it("turns decibels into a linear gain", () => {
    expect(dbToLinear(0)).toBe(1);
    expect(dbToLinear(20)).toBeCloseTo(10, 10);
    expect(dbToLinear(-20)).toBeCloseTo(0.1, 10);
    expect(dbToLinear(6.0206)).toBeCloseTo(2, 3);
    expect(dbToLinear(-6.0206)).toBeCloseTo(0.5, 3);
  });

  it("is no change for a missing or non finite value", () => {
    expect(dbToLinear(undefined)).toBe(1);
    expect(dbToLinear(Number.NaN)).toBe(1);
    expect(dbToLinear(Number.POSITIVE_INFINITY)).toBe(1);
  });

  it("holds a corrupt value inside the range of the measured ones", () => {
    expect(dbToLinear(200)).toBeCloseTo(10 ** (30 / 20), 10);
    expect(dbToLinear(-200)).toBeCloseTo(10 ** (-24 / 20), 10);
    // The measured range of the room (-9.5 to +23.9 dB) is untouched.
    expect(dbToLinear(23.9)).toBeCloseTo(10 ** (23.9 / 20), 10);
    expect(dbToLinear(-9.5)).toBeCloseTo(10 ** (-9.5 / 20), 10);
  });
});

describe("voiceLevel", () => {
  it("is the factor times the baked gain, and 1 with neither", () => {
    expect(voiceLevel(undefined, undefined)).toBe(1);
    expect(voiceLevel(0.5, undefined)).toBe(0.5);
    expect(voiceLevel(undefined, 20)).toBeCloseTo(10, 10);
    expect(voiceLevel(0.5, 20)).toBeCloseTo(5, 10);
  });
});

describe("the bus", () => {
  it("lifts the voice by the number the pipeline assumes (loudness.py: 20 log10 1.9 = 5.575 dB)", () => {
    expect(20 * Math.log10(VOICE_BUS_GAIN)).toBeCloseTo(5.575, 3);
  });
});
