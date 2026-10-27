// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import { coveredBySection, focusVisible, samplePoints } from "./occlusion";

function page() {
  document.body.innerHTML = `
    <section id="a"><div id="frame"><video id="v"></video></div><span id="shade"></span></section>
    <section id="b"><p id="text">over</p></section>
    <header id="bar"></header>`;
  const q = (id: string) => document.getElementById(id)!;
  return { v: q("v"), frame: q("frame"), shade: q("shade"), text: q("text"), bar: q("bar") };
}

describe("coveredBySection", () => {
  it("is covered when every point has another section on top", () => {
    const { v, text } = page();
    expect(coveredBySection(v, [text, text, text])).toBe(true);
  });
  it("is not covered when its own section is on top, or the video itself", () => {
    const { v, shade, frame } = page();
    expect(coveredBySection(v, [shade, shade])).toBe(false);
    expect(coveredBySection(v, [v, frame])).toBe(false);
  });
  it("is not covered by something outside every section (the bar, a scene)", () => {
    const { v, bar } = page();
    expect(coveredBySection(v, [bar, bar, bar])).toBe(false);
  });
  it("is not covered when only some points are", () => {
    const { v, text, shade } = page();
    expect(coveredBySection(v, [text, shade, text])).toBe(false);
  });
  it("is not covered when nothing was hit or there is nothing to look at", () => {
    const { v, text } = page();
    expect(coveredBySection(v, [text, null])).toBe(false);
    expect(coveredBySection(v, [])).toBe(false);
  });
});

describe("samplePoints", () => {
  it("looks inside the visible part only", () => {
    const pts = samplePoints({ left: -500, top: -200, right: 900, bottom: 300 }, 800, 600);
    expect(pts).toHaveLength(5);
    for (const [x, y] of pts) {
      expect(x).toBeGreaterThan(0);
      expect(x).toBeLessThan(800);
      expect(y).toBeGreaterThan(0);
      expect(y).toBeLessThan(300);
    }
  });
  it("gives nothing for a rectangle that is not on the screen", () => {
    expect(samplePoints({ left: 0, top: 700, right: 100, bottom: 900 }, 800, 600)).toEqual([]);
  });
});

describe("focusVisible", () => {
  it("is ok inside the screen and below the bar", () => {
    expect(focusVisible({ left: 100, top: 300, right: 200, bottom: 340 }, 1600, 900)).toBe("ok");
  });
  it("is off below the screen, above it, or under the bar", () => {
    expect(focusVisible({ left: 100, top: 1068, right: 200, bottom: 1164 }, 1600, 900)).toBe("off");
    expect(focusVisible({ left: 100, top: -200, right: 200, bottom: -100 }, 1600, 900)).toBe("off");
    expect(focusVisible({ left: 100, top: 10, right: 200, bottom: 50 }, 1600, 900)).toBe("off");
  });
  it("is undrawn for a control with no size", () => {
    expect(focusVisible({ left: 0, top: 0, right: 0, bottom: 0 }, 1600, 900)).toBe("undrawn");
  });
});
