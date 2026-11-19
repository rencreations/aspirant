import { describe, expect, it } from "vitest";

import { SECTIONS } from "./sections";
import {
  documentScreens,
  flowScreens,
  isPassed,
  isRunning,
  layoutSections,
  localOf,
  navOwnerAt,
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

  it("starts each section where the one before it ends, from the sections' own lengths", () => {
    // The lengths are the sections' (their `index.ts`): nothing here may pin where a section is.
    const layout = layoutSections(SECTIONS);
    let at = 0;
    for (const p of layout.placed) {
      expect(p.start, p.id).toBeCloseTo(at, 9);
      expect(p.def.screens, p.id).toBeGreaterThan(0);
      at += p.def.screens;
      expect(p.end, p.id).toBeCloseTo(at, 9);
    }
    expect(layout.total).toBeCloseTo(at, 9);
    expect(layout.placed[0]?.start).toBe(0);
  });

  it("keeps every lead and tail inside the page and inside the neighbours it overlaps", () => {
    const layout = layoutSections(SECTIONS);
    for (const p of layout.placed) {
      // A lead can reach back into the previous section at most, a tail into the next one at most.
      const before = layout.placed[p.index - 1];
      const after = layout.placed[p.index + 1];
      if (before)
        expect(p.def.lead, p.id).toBeLessThanOrEqual(before.def.screens + before.def.tail);
      if (after) expect(p.def.tail, p.id).toBeLessThanOrEqual(after.def.screens + after.def.lead);
    }
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

  it("mounts a section that asks for it further ahead", () => {
    const early = layoutSections([fake("a", 1), { ...fake("b", 1), mountAhead: 6 }]).placed[1]!;
    expect(wantsMount(early, early.from - 6.01)).toBe(false);
    expect(wantsMount(early, early.from - 5.99)).toBe(true);
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

describe("navOwnerAt", () => {
  it("is the section owner unless a later section asks for the bar early", () => {
    const early = fake("b", 2);
    (early as { nav: { theme: string; early?: number } }).nav = { theme: "daybreak", early: 0.3 };
    const layout = layoutSections([fake("a", 3), early, fake("c", 1)]);
    expect(navOwnerAt(layout, 2.6).id).toBe("a");
    expect(navOwnerAt(layout, 2.7).id).toBe("b");
    expect(navOwnerAt(layout, 3.5).id).toBe("b");
    expect(navOwnerAt(layout, 5.1).id).toBe("c");
    // Without `early` it is the section the scroll is in.
    for (const S of [0, 1, 2.99, 3, 4.9, 5, 5.5]) {
      const plain = layoutSections([fake("a", 3), fake("b", 2), fake("c", 1)]);
      expect(navOwnerAt(plain, S).id).toBe(sectionAt(plain, S).id);
    }
  });
});
