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

  it("blends three poses at once and keeps the shares continuous when the leading pose changes", () => {
    const m = new PoseMixer();
    m.setMix([
      ["dance", 1],
      ["shock", 0],
      ["run", 0],
    ]);
    m.snap();
    const out = restChannels();
    let last = Number.NaN;
    let worst = 0;
    // Dance, through shock, into the run: the shares move 0.01 a frame and the body never steps.
    for (let i = 0; i <= 200; i += 1) {
      const t = i / 200;
      const shock = t < 0.5 ? t * 2 : 2 - t * 2;
      const run = Math.max(0, t * 2 - 1);
      m.setMix([
        ["dance", Math.max(0, 1 - shock - run)],
        ["shock", shock * (1 - run)],
        ["run", run],
      ]);
      m.step(1 / 60, out);
      if (!Number.isNaN(last)) worst = Math.max(worst, Math.abs(out.spine.x - last));
      last = out.spine.x;
    }
    expect(worst).toBeLessThan(0.03);
    expect(m.weightOf("dance") + m.weightOf("shock") + m.weightOf("run")).toBeCloseTo(1, 3);
  });

  it("scales the shares of a mix to one, and names the biggest as the current pose", () => {
    const m = new PoseMixer();
    m.setMix([
      ["dance", 0.2],
      ["shock", 0.6],
    ]);
    m.snap();
    expect(m.current).toBe("shock");
    expect(m.weightOf("shock")).toBeCloseTo(0.75, 6);
    expect(m.weightOf("dance")).toBeCloseTo(0.25, 6);
    m.set("idle");
    m.snap();
    expect(m.weightOf("idle")).toBe(1);
  });
});
