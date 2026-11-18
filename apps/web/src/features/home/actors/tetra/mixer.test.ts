import { describe, expect, it } from "vitest";

import { restChannels } from "./channels";
import { PoseMixer } from "./mixer";

function run(m: PoseMixer, seconds: number, dt = 1 / 60) {
  const out = restChannels();
  for (let t = 0; t < seconds; t += dt) m.step(dt, out);
  return out;
}

describe("the pose mixer", () => {
  it("starts on the plain stand", () => {
    const m = new PoseMixer();
    expect(m.weightOf("idle")).toBe(1);
    expect(m.current).toBe("idle");
  });

  it("changes pose in about a third of a second, never through a pop", () => {
    const m = new PoseMixer();
    run(m, 0.5);
    m.set("sit");
    const out = restChannels();
    let last = out.y;
    let biggest = 0;
    for (let i = 0; i < 90; i += 1) {
      m.step(1 / 60, out);
      biggest = Math.max(biggest, Math.abs(out.y - last));
      last = out.y;
    }
    expect(out.y).toBeLessThan(-0.13);
    expect(biggest).toBeLessThan(0.02);
    expect(m.weightOf("sit")).toBeGreaterThan(0.99);
    expect(m.weightOf("idle")).toBeLessThan(0.01);
  });

  it("wears a pose at a strength: half a blend is half the pose", () => {
    const m = new PoseMixer();
    m.set("sit", 0.5);
    const half = run(m, 2);
    const full = restChannels();
    const f = new PoseMixer();
    f.set("sit", 1);
    f.snap();
    f.compose(full);
    expect(half.y).toBeLessThan(full.y * 0.4);
    expect(half.y).toBeGreaterThan(full.y * 0.6);
  });

  it("snaps to what is asked at once for a jump", () => {
    const m = new PoseMixer();
    m.set("run");
    m.snap();
    expect(m.weightOf("run")).toBe(1);
    expect(m.weightOf("idle")).toBe(0);
  });

  it("is the same at 60 and 144 Hz", () => {
    const a = new PoseMixer();
    const b = new PoseMixer();
    a.set("sit");
    b.set("sit");
    const oa = run(a, 0.4, 1 / 60);
    const ob = run(b, 0.4, 1 / 144);
    expect(oa.y).toBeCloseTo(ob.y, 2);
  });

  it("a blend of two poses is never bigger than either", () => {
    const m = new PoseMixer();
    m.set("sit");
    const out = restChannels();
    for (let i = 0; i < 12; i += 1) m.step(1 / 60, out);
    // Between the stand and the seat: neither lower than the seat nor higher than the stand.
    expect(out.y).toBeLessThanOrEqual(0);
    expect(out.y).toBeGreaterThanOrEqual(-0.145 - 1e-9);
  });
});
