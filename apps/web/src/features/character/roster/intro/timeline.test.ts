import { describe, expect, it } from "vitest";

import { resolve } from "./script";
import { createScene, DURATION, PANEL_SLUGS, sceneAt, T_BLACK, T_BOOM, T_FLASH } from "./timeline";

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

  it("draws the red wedge until the charge ends in the dark", () => {
    expect(at(2.2).wedge.on).toBe(false);
    expect(at(2.5).wedge.on).toBe(true);
    expect(at(2.6).wedge.edge).toBeGreaterThan(at(2.45).wedge.edge);
    expect(at(2.95).wedge.on).toBe(false);
  });

  it("charges: lines are drawn in toward a point, then a seed of light grows in the dark", () => {
    expect(at(2.7).speed.on).toBe(false);
    expect(at(2.82).speed.on).toBe(true);
    // Each picture of the lines is smaller than the one before.
    expect(at(2.86).speed.size).toBeLessThan(at(2.82).speed.size);
    expect(at(2.95).ground).toBe(2);
    expect(at(2.95).lineup).toBeLessThan(0.2);
    expect(at(2.82).seed).toBe(0);
    expect(at(2.99).seed).toBeGreaterThan(at(2.9).seed);
    expect(at(2.99).charge.glow).toBeGreaterThan(0);
  });

  it("stamps Obsidia in as an impact frame: five pictures, black then white, shaking", () => {
    expect(at(2.99).hit.on).toBe(false);
    expect(at(3.01).hit.on).toBe(true);
    expect(at(3.15).hit.on).toBe(true);
    expect(at(3.01).hit.inv).toBe(0);
    expect(at(3.04).hit.inv).toBe(1);
    expect(at(3.07).hit.inv).toBe(0);
    // Each is bigger than the first, and the position changes from step to step.
    expect(at(3.14).hit.zoom).toBeGreaterThan(at(3.01).hit.zoom);
    expect(at(3.04).hit.shx).not.toBe(at(3.07).hit.shx);
    // The last pictures come back in crimson.
    expect(at(3.01).hit.tint).toBe(0);
    expect(at(3.12).hit.tint).toBe(1);
    // The lineup is gone: the impact frame stands alone.
    expect(at(3.01).lineup).toBe(0);
  });

  it("flashes white with the glass whole, then the glass breaks from the impact point", () => {
    expect(at(T_FLASH - 0.01).flash).toBe(0);
    expect(at(T_FLASH + 0.02).flash).toBe(1);
    expect(at(T_FLASH + 0.02).shatter.u).toBe(0);
    expect(at(T_FLASH + 0.02).shatter.on).toBe(true);
    expect(at(T_BOOM + 0.001).flash).toBe(0);
    expect(at(T_FLASH - 0.01).clear).toBe(0);
    expect(at(T_FLASH + 0.01).clear).toBe(1);
    let last = -1;
    for (let t = T_BOOM; t < 3.9; t += 0.02) {
      const u = at(t).shatter.u;
      expect(u).toBeGreaterThanOrEqual(last);
      last = u;
    }
    expect(at(3.9).shatter.on).toBe(false);
  });

  it("booms: core, rings, fire and embers from the impact point, and the page recoils", () => {
    expect(at(3.1).boom.on).toBe(false);
    const b = at(T_BOOM + 0.05);
    expect(b.boom.on).toBe(true);
    expect(b.boom.core).toBeGreaterThan(0.9);
    expect(at(T_BOOM + 0.4).boom.ring).toBeGreaterThan(b.boom.ring);
    expect(at(T_BOOM + 0.05).fire.on).toBe(true);
    // The fire opens fast.
    expect(at(T_BOOM + 0.3).fire.scale).toBeGreaterThan(at(T_BOOM + 0.02).fire.scale);
    // The recoil is thrown at the start and has settled by 0.6 s.
    const hit = at(T_BOOM + 0.05).shake;
    expect(Math.abs(hit.x) + Math.abs(hit.y)).toBeGreaterThan(1);
    for (const t of [T_BOOM + 0.65, 3.1]) {
      const rest = at(t).shake;
      expect(Math.abs(rest.x) + Math.abs(rest.y)).toBe(0);
      expect(rest.scale).toBe(1);
    }
  });

  it("reveals Obsidia on the real page, then hands the page over at 4.2", () => {
    const o = (t: number) => panel(t, "obsidia");
    expect(o(T_BOOM - 0.01).on).toBe(false);
    expect(o(T_BOOM + 0.01).on).toBe(true);
    // She is drawn in the box of the page's own panel, white-hot at first, then her clip plays.
    expect(o(T_BOOM + 0.01).page).toBe(1);
    expect(o(T_BOOM + 0.01).white).toBeGreaterThan(0.9);
    expect(o(3.5).white).toBe(0);
    expect(o(3.5).mix).toBe(0);
    expect(o(3.7).clipT).toBeGreaterThan(o(3.5).clipT);
    // The splash comes in and the canvas panel is let go so the page's frame and name show.
    expect(o(4.05).mix).toBe(1);
    expect(o(4.19).alpha).toBeLessThan(0.2);
    expect(at(4.1).page).toBe("play");
    expect(at(4.25).page).toBe("done");
    expect(at(4.25).fire.on).toBe(false);
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

  it("has every panel once, Obsidia last (she is the reveal at the end)", () => {
    expect(new Set(PANEL_SLUGS).size).toBe(PANEL_SLUGS.length);
    expect(PANEL_SLUGS[0]).toBe("fanny");
    expect(PANEL_SLUGS[PANEL_SLUGS.length - 1]).toBe("obsidia");
  });

  it("keeps a clip running across beats that give no clip time", () => {
    const beats = resolve([{ t: 1, clip: 0, rate: 1, step: 10 }, { t: 1.5 }, { t: 2, rate: 0 }]);
    expect(beats[1]?.clip).toBeCloseTo(0.5, 5);
    expect(beats[2]?.clip).toBeCloseTo(1.0, 5);
  });
});
