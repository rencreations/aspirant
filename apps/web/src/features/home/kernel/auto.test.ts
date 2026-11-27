import { describe, expect, it } from "vitest";

import { layoutSections } from "./layout";
import { validatePlays } from "./plays";
import { SECTIONS } from "./sections";
import { THRESHOLD_MARGIN, autoTarget, autoThresholds } from "./snap";

describe("a clock play that fires by itself", () => {
  const AUTO_REACH = 0.46;
  const autos = [{ at: 31.3, reach: AUTO_REACH }];

  it("carries the page on past its threshold when the visitor lets go short of it, going down", () => {
    expect(autoTarget(autos, 31.1, true)).toBeCloseTo(31.3 + THRESHOLD_MARGIN, 9);
    expect(autoTarget(autos, 31.299, true)).toBeCloseTo(31.3 + THRESHOLD_MARGIN, 9);
  });

  it("does nothing going up, past the threshold, or too far short of it", () => {
    expect(autoTarget(autos, 31.1, false)).toBeNaN();
    expect(autoTarget(autos, 31.4, true)).toBeNaN();
    expect(autoTarget(autos, 31.3 - AUTO_REACH - 0.01, true)).toBeNaN();
    expect(autoTarget([], 31.1, true)).toBeNaN();
  });

  it("is a clock play only: a zone is played by the scroll", () => {
    expect(() => {
      validatePlays("x", [{ at: 0.1, span: 0.2, from: 0, to: 1, seconds: 1, auto: 0.4 }]);
    }).toThrow(/auto is for a clock play/);
    expect(() => {
      validatePlays("x", [{ at: 0.1, from: 0, to: 1, seconds: 1, auto: 0 }]);
    }).toThrow(/not a reach/);
  });

  it("is set on the voices' way in, and only on a threshold the page can reach", () => {
    const layout = layoutSections(SECTIONS);
    const found = autoThresholds(layout);
    const voices = layout.placed.find((p) => p.id === "voices")!;
    expect(found.length).toBeGreaterThan(0);
    const at = voices.start + voices.def.plays![0]!.at * voices.def.screens;
    expect(found.map((a) => a.at)).toContain(at);
    for (const a of found) expect(a.at).toBeLessThan(layout.placed[layout.placed.length - 1]!.end);
    // The way in fires where Selena's white is whole (95.2 percent of her film), and the carry reaches back
    // only over the last sliver of it, never into the part of her film that still shows her.
    const selena = layout.placed.find((p) => p.id === "selena")!;
    const film = selena.def.plays![1]!;
    const filmStart = selena.start + film.at * selena.def.screens;
    const wiped = filmStart + 0.952 * film.span! * selena.def.screens;
    const voicesAuto = found.find((a) => a.at === at)!;
    expect(at).toBeGreaterThanOrEqual(wiped - 1e-3);
    expect(at - wiped).toBeLessThan(0.06);
    expect(at - voicesAuto.reach).toBeGreaterThanOrEqual(wiped - 0.04);
  });
});
