import { describe, expect, it } from "vitest";

import { resolve } from "./script";
import {
  BEAM,
  createScene,
  DURATION,
  PANEL_SLUGS,
  sceneAt,
  T_BLACK,
  T_FLASH,
  T_PAGE,
} from "./timeline";

const at = (t: number) => sceneAt(t, createScene());
const panel = (t: number, slug: string) => {
  const p = at(t).panels.find((x) => x.slug === slug);
  if (!p) throw new Error(`no panel ${slug}`);
  return p;
};

describe("roster intro timeline", () => {
  it("is black until the page appears, then grey", () => {
    expect(at(0.3).ground).toBe(0);
    expect(at(T_BLACK - 0.01).ground).toBe(0);
    expect(at(0.75).ground).toBe(1);
    // Only the first panel is there, and no other.
    expect(
      at(0.75)
        .panels.filter((p) => p.on)
        .map((p) => p.slug),
    ).toEqual(["fanny"]);
  });

  it("brings the first panel in on a blue plate, then shows the clip", () => {
    const early = panel(0.75, "fanny");
    expect(early.on).toBe(true);
    expect(early.bevel).toBeGreaterThan(0.5);
    expect(early.grow).toBeLessThan(1);
    const later = panel(1.0, "fanny");
    expect(later.grow).toBe(1);
    expect(later.bevel).toBe(0);
    expect(later.mix).toBe(0);
  });

  it("goes white (the impact frame) at 1.5 and settles on the splash art", () => {
    // The white is the clip's own flash: the panel shows the clip, with its glow at full.
    expect(panel(1.56, "fanny").glow).toBe(1);
    expect(panel(1.6, "fanny").clipT).toBeGreaterThan(0.65);
    expect(panel(2.2, "fanny").mix).toBe(1);
    expect(panel(2.2, "fanny").white).toBe(0);
  });

  it("opens the panels one after another, in two rows", () => {
    const order = [
      "ruby",
      "layla",
      "change",
      "angela",
      "lesley",
      "guinevere",
      "vexana",
      "selena",
    ] as const;
    const firstOn = order.map((slug) => {
      for (let t = 1.4; t < 3; t += 0.01) if (panel(t, slug).on) return t;
      return Infinity;
    });
    for (let i = 1; i < firstOn.length; i++) {
      expect(firstOn[i] ?? 0).toBeGreaterThan(firstOn[i - 1] ?? 0);
    }
    // the first of the burst opens at the bottom, the second grows from the top
    expect(panel(1.6, "ruby").top).toBe(0);
    expect(panel(1.8, "layla").top).toBe(1);
  });

  it("has an impact frame for the second panel at 1.70", () => {
    const p = panel(1.7, "ruby");
    expect(p.black).toBe(1);
    expect(p.glow).toBe(1);
    expect(panel(1.77, "ruby").thr).toBeGreaterThan(0);
  });

  it("draws the red wedge from 2.4 to the held beam", () => {
    expect(at(2.2).wedge.on).toBe(false);
    expect(at(2.5).wedge.on).toBe(true);
    expect(at(2.6).wedge.edge).toBeGreaterThan(at(2.45).wedge.edge);
    expect(at(2.95).wedge.on).toBe(false);
  });

  it("shows the pink spear with speed lines, then the held leaf, then blue, then thin", () => {
    expect(at(2.82).beam.kind).toBe(BEAM.pink);
    expect(at(2.82).speed.on).toBe(true);
    expect(at(2.7).beam.kind).toBe(BEAM.none);
    expect(at(2.95).beam.kind).toBe(BEAM.hold);
    expect(at(2.95).ground).toBe(2);
    expect(at(2.95).lineup).toBeLessThan(0.2);
    expect(at(3.2).beam.kind).toBe(BEAM.blue);
    expect(at(3.5).beam.kind).toBe(BEAM.none);
    expect(at(3.5).thin.on).toBe(true);
    expect(at(4.3).thin.on).toBe(false);
    expect(at(4.5).beam.kind).toBe(BEAM.none);
  });

  it("flashes white for six frames and then shows the page under the picture", () => {
    expect(at(T_FLASH - 0.01).flash).toBe(0);
    expect(at(T_FLASH + 0.04).flash).toBe(1);
    expect(at(T_FLASH + 0.04).ground).toBe(3);
    expect(at(T_PAGE - 0.01).clear).toBe(0);
    expect(at(T_PAGE + 0.01).clear).toBe(1);
    expect(at(T_PAGE + 0.01).flash).toBe(0);
  });

  it("runs the fire and the arcs over the page, and hands the page over at 4.2", () => {
    expect(at(3.0).fire.on).toBe(false);
    expect(at(3.7).fire.on).toBe(true);
    expect(at(3.7).arcs).toBeGreaterThan(0);
    expect(at(3.7).veil).toBeGreaterThan(0);
    expect(at(4.1).veil).toBe(0);
    expect(at(4.1).page).toBe("play");
    expect(at(4.25).page).toBe("done");
    expect(at(4.5).fire.on).toBe(false);
    expect(DURATION).toBeGreaterThan(4.2);
  });

  it("pans the board toward the start without going back", () => {
    let last = -Infinity;
    for (let t = 0.7; t < 3.4; t += 0.02) {
      const s = at(t).shift;
      expect(s).toBeGreaterThanOrEqual(last - 1e-9);
      last = s;
    }
  });

  it("is a pure function of time: the order of the calls does not matter", () => {
    const scene = createScene();
    sceneAt(4.0, scene);
    sceneAt(1.74, scene);
    const fresh = at(1.74);
    expect(JSON.stringify(scene)).toBe(JSON.stringify(fresh));
  });

  it("holds the clip picture between steps (the recording is cut on twos and threes)", () => {
    const a = panel(1.0, "fanny");
    const b = panel(1.0 + 0.01, "fanny");
    const c = panel(1.0 + 0.2, "fanny");
    expect(b.clipT).toBe(a.clipT);
    expect(c.clipT).toBeGreaterThan(a.clipT);
    expect(a.frame).toBe(b.frame);
  });

  it("covers every panel of the roster that is not on the page when it opens", () => {
    expect(new Set(PANEL_SLUGS).size).toBe(PANEL_SLUGS.length);
    // Obsidia is revealed by the fire, over the page: she is not one of the arriving panels.
    expect(PANEL_SLUGS).not.toContain("obsidia");
  });

  it("keeps a clip running across beats that give no clip time", () => {
    const beats = resolve([{ t: 1, clip: 0, rate: 1, step: 10 }, { t: 1.5 }, { t: 2, rate: 0 }]);
    expect(beats[1]?.clip).toBeCloseTo(0.5, 5);
    expect(beats[2]?.clip).toBeCloseTo(1.0, 5);
  });
});
