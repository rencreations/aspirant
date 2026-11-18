import { describe, expect, it } from "vitest";

import { FADE_S, FadeMix, MAX_LAYERS, easeFade } from "./mix";

const DT = 1 / 60;
const sum = (m: FadeMix<string>) => m.layers.reduce((s, l) => s + l.w, 0);

function run(m: FadeMix<string>, seconds: number, want: string | null) {
  const steps = Math.round(seconds / DT);
  for (let i = 0; i < steps; i++) m.step(DT, want);
}

describe("easeFade", () => {
  it("runs 0 to 1, smoothly, and clamps", () => {
    expect(easeFade(0)).toBe(0);
    expect(easeFade(1)).toBe(1);
    expect(easeFade(0.5)).toBeCloseTo(0.5);
    expect(easeFade(-3)).toBe(0);
    expect(easeFade(7)).toBe(1);
    expect(easeFade(0.1)).toBeLessThan(0.1);
  });
});

describe("FadeMix: presence", () => {
  it("is hidden to begin with and draws nothing", () => {
    const m = new FadeMix<string>();
    expect(m.active()).toBe(false);
    m.step(DT, null);
    expect(m.active()).toBe(false);
  });

  it("fades in over FADE_S when a kind is wanted, then holds at 1", () => {
    const m = new FadeMix<string>();
    run(m, FADE_S / 2, "aurora");
    expect(m.active()).toBe(true);
    expect(m.master()).toBeGreaterThan(0.3);
    expect(m.master()).toBeLessThan(0.7);
    run(m, FADE_S, "aurora");
    expect(m.master()).toBe(1);
    expect(m.layers).toHaveLength(1);
    expect(m.layers[0]!.w).toBe(1);
  });

  it("fades out when no section wants it, then stops drawing", () => {
    const m = new FadeMix<string>();
    run(m, 1, "aurora");
    run(m, FADE_S / 2, null);
    expect(m.active()).toBe(true);
    expect(m.master()).toBeLessThan(1);
    run(m, FADE_S, null);
    expect(m.active()).toBe(false);
    expect(m.master()).toBe(0);
  });

  it("fades in a new kind fresh after being hidden, with no ghost of the old one", () => {
    const m = new FadeMix<string>();
    run(m, 1, "aurora");
    run(m, 1, null);
    m.step(DT, "beams");
    expect(m.layers).toHaveLength(1);
    expect(m.layers[0]!.kind).toBe("beams");
  });

  it("snaps to the end state at once", () => {
    const m = new FadeMix<string>();
    m.step(DT, "aurora", true);
    expect(m.master()).toBe(1);
    expect(m.layers).toHaveLength(1);
    m.step(DT, null, true);
    expect(m.active()).toBe(false);
  });

  it("does not move when time stands still (dt 0)", () => {
    const m = new FadeMix<string>();
    m.step(0, "aurora");
    m.step(0, "aurora");
    expect(m.presence).toBe(0);
  });
});

describe("FadeMix: cross-fade between kinds", () => {
  it("keeps the weights summing to 1 for the whole fade and the top rises monotonically", () => {
    const m = new FadeMix<string>();
    run(m, 1, "aurora");
    let last = 0;
    for (let i = 0; i < Math.round(FADE_S / DT) + 5; i++) {
      m.step(DT, "beams");
      expect(sum(m)).toBeCloseTo(1, 6);
      const top = m.top()!;
      expect(top.kind).toBe("beams");
      expect(top.w).toBeGreaterThanOrEqual(last - 1e-9);
      last = top.w;
    }
    expect(m.layers).toHaveLength(1);
    expect(m.layers[0]!.kind).toBe("beams");
  });

  it("draws both kinds in the middle of the fade", () => {
    const m = new FadeMix<string>();
    run(m, 1, "aurora");
    run(m, FADE_S / 2, "beams");
    expect(m.layers.map((l) => l.kind)).toEqual(["aurora", "beams"]);
    expect(m.layers[0]!.w).toBeGreaterThan(0.2);
    expect(m.layers[1]!.w).toBeGreaterThan(0.2);
  });

  it("takes the share the others had when a third kind arrives mid-fade", () => {
    const m = new FadeMix<string>();
    run(m, 1, "aurora");
    run(m, FADE_S / 2, "beams");
    const beamsBefore = m.layers[1]!.w;
    m.step(DT, "plasma");
    expect(m.layers.map((l) => l.kind)).toEqual(["aurora", "beams", "plasma"]);
    expect(sum(m)).toBeCloseTo(1, 6);
    // beams keeps (nearly) its weight at the switch: no jump.
    expect(m.layers[1]!.w).toBeCloseTo(beamsBefore, 1);
    run(m, FADE_S + 0.1, "plasma");
    expect(m.layers.map((l) => l.kind)).toEqual(["plasma"]);
  });

  it("never holds more than MAX_LAYERS and still sums to 1 when kinds come fast", () => {
    const m = new FadeMix<string>();
    run(m, 1, "a");
    const names = ["b", "c", "d", "e", "f"];
    for (const name of names) {
      run(m, 0.08, name);
      expect(m.layers.length).toBeLessThanOrEqual(MAX_LAYERS);
      expect(sum(m)).toBeCloseTo(1, 6);
    }
    run(m, 1, "f");
    expect(m.layers.map((l) => l.kind)).toEqual(["f"]);
  });

  it("carries on from its weight when a kind that is fading out is asked for again", () => {
    const m = new FadeMix<string>();
    run(m, 1, "aurora");
    run(m, FADE_S / 2, "beams");
    const aurora = m.layers.find((l) => l.kind === "aurora")!.w;
    m.step(DT, "aurora");
    expect(m.top()!.kind).toBe("aurora");
    expect(m.top()!.w).toBeCloseTo(aurora, 1);
    expect(m.layers).toHaveLength(2);
    expect(sum(m)).toBeCloseTo(1, 6);
    run(m, FADE_S + 0.1, "aurora");
    expect(m.layers).toHaveLength(1);
  });

  it("keeps crossing while hidden, so a fade that was running finishes", () => {
    const m = new FadeMix<string>();
    run(m, 1, "aurora");
    run(m, FADE_S / 2, "beams");
    run(m, FADE_S, null);
    expect(m.active()).toBe(false);
  });
});
