import { describe, expect, it } from "vitest";

import { heroFace, heroView } from "./hero-view";

describe("heroFace", () => {
  it("keeps her face where the recording puts it on a 16:9 screen", () => {
    const f = heroFace(1600, 900);
    expect(f.x).toBeCloseTo(0.61, 5);
    expect(f.y).toBeCloseTo(0.38, 5);
  });

  it("follows the cut on a tall screen: her face stays on screen", () => {
    const f = heroFace(390, 844);
    expect(f.y).toBeCloseTo(0.38, 5);
    expect(f.x).toBeGreaterThan(0.3);
    expect(f.x).toBeLessThan(0.7);
  });

  it("follows the cut on a very wide screen (the top and bottom are cut)", () => {
    const f = heroFace(2400, 800);
    expect(f.x).toBeCloseTo(0.61, 5);
    expect(f.y).toBeGreaterThan(0.2);
    expect(f.y).toBeLessThan(0.5);
  });
});

describe("heroView", () => {
  it("zooms in and starts with the first scroll", () => {
    const v = heroView(1440, 810);
    expect(v.zoom).toBeGreaterThan(1);
    expect(v.from).toBeLessThan(0.1);
  });
});
