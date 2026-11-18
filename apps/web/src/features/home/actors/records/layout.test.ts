import { MAX_SLEEVES, SLEEVE } from "./facts";
import {
  BOX_HEIGHT,
  FLOOR_Y,
  GAP,
  REST_YAW,
  STEP,
  crateDims,
  mixPose,
  sleeveShow,
  sleeveSlot,
  type SleevePose,
} from "./layout";

const blank = (): SleevePose => ({ x: 0, y: 0, z: 0, yaw: 0, lean: 0 });

describe("crateDims", () => {
  it("grows with the number of sleeves and never below the smallest crate", () => {
    expect(crateDims(1).width).toBeGreaterThanOrEqual(0.5);
    expect(crateDims(10).width).toBeGreaterThan(crateDims(4).width);
  });

  it("clamps the count", () => {
    expect(crateDims(500).width).toBe(crateDims(MAX_SLEEVES).width);
    expect(crateDims(0).width).toBe(crateDims(1).width);
  });

  it("is deep enough for a sleeve turned across it", () => {
    const d = crateDims(10);
    expect(d.depth).toBeGreaterThan(SLEEVE.size * Math.sin(REST_YAW) * 0.9);
  });

  it("keeps the whole row inside the boards", () => {
    for (const n of [3, 7, 10, MAX_SLEEVES]) {
      const d = crateDims(n);
      const half = ((n - 1) / 2) * STEP + GAP + (SLEEVE.size / 2) * Math.cos(REST_YAW);
      expect(half).toBeLessThan(d.width / 2 - d.wall);
    }
  });

  it("is lower at the front so the covers show over it", () => {
    const d = crateDims(10);
    expect(d.frontHeight).toBeLessThan(d.backHeight);
    expect(BOX_HEIGHT).toBeGreaterThan(FLOOR_Y + SLEEVE.size);
  });
});

describe("sleeveSlot", () => {
  const out = blank();

  it("is a plain row at rest, centred, all turned the same way", () => {
    const xs: number[] = [];
    for (let i = 0; i < 5; i++) {
      sleeveSlot(out, i, 5, 2, 0);
      xs.push(out.x);
      expect(out.yaw).toBeCloseTo(REST_YAW, 9);
      expect(out.y).toBeCloseTo(FLOOR_Y, 9);
      expect(out.z).toBe(0);
    }
    expect(xs[2]).toBeCloseTo(0, 9);
    expect(xs[1]! - xs[0]!).toBeCloseTo(STEP, 9);
    expect(xs[0]! + xs[4]!).toBeCloseTo(0, 9);
  });

  it("brings the focused sleeve up, round and forward when revealed", () => {
    sleeveSlot(out, 3, 7, 3, 1);
    expect(out.yaw).toBeLessThan(REST_YAW * 0.5);
    expect(out.y).toBeGreaterThan(FLOOR_Y);
    expect(out.z).toBeGreaterThan(0);
    expect(out.lean).toBeCloseTo(0, 9);
  });

  it("parts the neighbours to both sides and leaves the far ones at rest turn", () => {
    const rest = blank();
    sleeveSlot(rest, 1, 7, 3, 0);
    sleeveSlot(out, 1, 7, 3, 1);
    expect(out.x).toBeLessThan(rest.x);
    sleeveSlot(rest, 5, 7, 3, 0);
    sleeveSlot(out, 5, 7, 3, 1);
    expect(out.x).toBeGreaterThan(rest.x);
    expect(out.yaw).toBeCloseTo(REST_YAW, 9);
  });

  it("moves continuously as the focus slides from one sleeve to the next", () => {
    let prev: SleevePose | null = null;
    for (let f = 2; f <= 3; f += 0.01) {
      const here = sleeveSlot(blank(), 2, 7, f, 1);
      if (prev) {
        expect(Math.abs(here.x - prev.x)).toBeLessThan(0.01);
        expect(Math.abs(here.yaw - prev.yaw)).toBeLessThan(0.05);
      }
      prev = here;
    }
  });

  it("is the rest row at reveal 0 whatever the focus", () => {
    const a = sleeveSlot(blank(), 4, 9, 1, 0);
    const b = sleeveSlot(blank(), 4, 9, 7, 0);
    expect(a).toEqual(b);
  });
});

describe("show pose and mixing", () => {
  it("pulls the sleeve out above the crate, toward the viewer, nearly upright", () => {
    const show = sleeveShow(blank(), 0.2);
    expect(show.y).toBeGreaterThan(FLOOR_Y + SLEEVE.size * 0.8);
    expect(show.z).toBeGreaterThan(0.1);
    expect(Math.abs(show.yaw)).toBeLessThan(0.3);
    expect(show.x).toBeCloseTo(0.07, 9);
  });

  it("mixes two poses", () => {
    const a: SleevePose = { x: 0, y: 0, z: 0, yaw: 0, lean: 0 };
    const b: SleevePose = { x: 2, y: 4, z: 6, yaw: 1, lean: -1 };
    expect(mixPose(blank(), a, b, 0.5)).toEqual({ x: 1, y: 2, z: 3, yaw: 0.5, lean: -0.5 });
    expect(mixPose(blank(), a, b, 0)).toEqual(a);
    expect(mixPose(blank(), a, b, 1)).toEqual(b);
  });
});
