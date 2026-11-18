import { describe, expect, it } from "vitest";

import { SECTIONS } from "./sections";
import {
  documentScreens,
  flowScreens,
  isPassed,
  isRunning,
  layoutSections,
  localOf,
  sectionAt,
  trackScreens,
  wantsMount,
} from "./layout";
import { SECTION_IDS, type HomeSection } from "./types";

function fake(id: string, screens: number, lead = 0, tail = 0, dom: "fixed" | "flow" = "fixed") {
  return {
    id,
    screens,
    lead,
    tail,
    bg: "daybreak",
    nav: { theme: "daybreak" },
    dom,
    preload: () => [],
    mount: () => ({ update: () => undefined, dispose: () => undefined }),
  } as unknown as HomeSection;
}

describe("the registry", () => {
  it("lists the sixteen sections of the design in scroll order", () => {
    expect(SECTIONS.map((s) => s.id)).toEqual([...SECTION_IDS]);
  });

  it("starts each section where the design table says (screens)", () => {
    const layout = layoutSections(SECTIONS);
    const starts = Object.fromEntries(layout.placed.map((p) => [p.id, p.start]));
    const expected = {
      hero: 0,
      aspirants: 4.2,
      rows: 5.8,
      strip: 8.2,
      bolt: 11.3,
      fall: 15.3,
      hand: 17.9,
      list: 21.3,
      selena: 29.9,
      voices: 33.7,
      music: 36.1,
      funny: 38.9,
      chase: 43.1,
      bend: 47.1,
      archive: 56.1,
      footer: 59.1,
    };
    for (const [id, start] of Object.entries(expected)) {
      expect(starts[id], id).toBeCloseTo(start, 6);
    }
    expect(layout.total).toBeCloseTo(60.3, 6);
  });

  it("keeps the footer's text in the page's flow and every other section's in the stage", () => {
    expect(SECTIONS.filter((s) => s.dom === "flow").map((s) => s.id)).toEqual(["footer"]);
  });

  it("gives every section a lead and a tail that fit between its neighbours", () => {
    for (const s of SECTIONS) {
      expect(s.lead).toBeGreaterThanOrEqual(0);
      expect(s.tail).toBeGreaterThanOrEqual(0);
      expect(s.screens).toBeGreaterThan(0);
    }
  });
});

describe("layoutSections", () => {
  const layout = layoutSections([
    fake("a", 2, 0.5, 0.5),
    fake("b", 3, 1, 0),
    fake("c", 1, 0, 0, "flow"),
  ]);
  const [a, b, c] = layout.placed;

  it("places sections one after another", () => {
    expect([a?.start, b?.start, c?.start]).toEqual([0, 2, 5]);
    expect([a?.end, b?.end, c?.end]).toEqual([2, 5, 6]);
    expect(layout.total).toBe(6);
  });

  it("computes the running range from the lead and the tail", () => {
    expect([a?.from, a?.to]).toEqual([-0.5, 2.5]);
    expect([b?.from, b?.to]).toEqual([1, 5]);
  });

  it("refuses a flowing section that is not the last", () => {
    expect(() => layoutSections([fake("a", 1, 0, 0, "flow"), fake("b", 1)])).toThrow(
      /only the last/,
    );
  });

  it("makes the document one screen longer than the story", () => {
    expect(documentScreens(layout)).toBe(7);
  });

  it("splits the page into the scroll room and the flowing block", () => {
    expect(trackScreens(layout)).toBe(5);
    expect(flowScreens(layout)).toBe(2);
    const plain = layoutSections([fake("a", 2), fake("b", 3)]);
    expect(trackScreens(plain)).toBe(6);
    expect(flowScreens(plain)).toBe(0);
  });
});

describe("the run rule", () => {
  const layout = layoutSections([fake("a", 2, 0.5, 0.5), fake("b", 3, 1, 0)]);
  const [a, b] = layout.placed as [(typeof layout.placed)[0], (typeof layout.placed)[0]];

  it("has local 0 at the start and 1 at the end, and runs on a little outside", () => {
    expect(localOf(a, 0)).toBe(0);
    expect(localOf(a, 2)).toBe(1);
    expect(localOf(a, -0.5)).toBeCloseTo(-0.25);
    expect(localOf(a, 2.5)).toBeCloseTo(1.25);
  });

  it("runs from the lead to the end of the tail, inclusive", () => {
    expect(isRunning(a, -0.5)).toBe(true);
    expect(isRunning(a, -0.51)).toBe(false);
    expect(isRunning(a, 2.5)).toBe(true);
    expect(isRunning(a, 2.51)).toBe(false);
    expect(isRunning(b, 1)).toBe(true);
  });

  it("is passed once the scroll is beyond the tail", () => {
    expect(isPassed(a, 2.5)).toBe(false);
    expect(isPassed(a, 2.51)).toBe(true);
  });

  it("mounts two screens ahead of its range", () => {
    expect(wantsMount(b, -1.01)).toBe(false);
    expect(wantsMount(b, -0.99)).toBe(true);
    expect(wantsMount(a, 0)).toBe(true);
  });

  it("mounts a carried section wherever the scroll is", () => {
    const carried = layoutSections([{ ...fake("c", 1), carry: true }]).placed[0]!;
    expect(wantsMount(carried, 500)).toBe(true);
  });

  it("finds the section that owns a position", () => {
    expect(sectionAt(layout, -3).id).toBe("a");
    expect(sectionAt(layout, 1.99).id).toBe("a");
    expect(sectionAt(layout, 2).id).toBe("b");
    expect(sectionAt(layout, 99).id).toBe("b");
  });
});
