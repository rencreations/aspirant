import { describe, expect, it } from "vitest";

import { SPLASH_ITEMS } from "./data";
import {
  NOT_OFFICIAL,
  toneOf,
  captionLines,
  dateLabel,
  hrefOf,
  isMade,
  metaLine,
  namesOf,
  rowCells,
  spoken,
  whoOf,
  yearOf,
} from "./labels";

const base = SPLASH_ITEMS[0]!;
const made = {
  ...base,
  canon: "fan" as const,
  facts: { ...base.facts, kind: "Made for this site" },
};

describe("the words of the stage", () => {
  it("splits a title at its first comma into the people and the rest", () => {
    expect(captionLines("Fanny, Blade of Kibou")).toEqual(["Fanny", "Blade of Kibou"]);
    expect(captionLines("Guinevere and Vexana, fighting moment")).toEqual([
      "Guinevere and Vexana",
      "Fighting moment",
    ]);
    expect(captionLines("Terrinia skyline")).toEqual(["Terrinia skyline", ""]);
    expect(captionLines("A, b, c")).toEqual(["A", "B, c"]);
  });

  it("spells the Aspirants as canon", () => {
    expect(namesOf(["change"])).toBe("Chang'e");
    expect(namesOf(["fanny", "layla"])).toBe("Fanny, Layla");
    expect(namesOf([])).toBe("");
  });

  it("the meta line is the artist and the kind, or the kind alone, and never says Unknown", () => {
    expect(
      metaLine({ ...base, facts: { ...base.facts, artist: "A. Hand", kind: "Pair art" } }),
    ).toBe("A. Hand / Pair art");
    expect(metaLine({ ...base, facts: { ...base.facts, artist: null, kind: "Pair art" } })).toBe(
      "Pair art",
    );
    expect(metaLine({ ...base, facts: { ...base.facts, artist: null, kind: null } })).toBe(
      "Splash art",
    );
    for (const item of SPLASH_ITEMS) {
      expect(metaLine(item)).not.toMatch(/unknown|null|undefined/iu);
    }
  });

  it("the year is empty when the data has no date", () => {
    expect(yearOf({ facts: { ...base.facts, date: "2022-01-22" } })).toBe("2022");
    expect(yearOf({ facts: { ...base.facts, date: null } })).toBe("");
    expect(yearOf({ facts: { ...base.facts, date: "soon" } })).toBe("");
  });

  it("writes a day out in words", () => {
    expect(dateLabel("2022-01-22")).toBe("22 January 2022");
    expect(dateLabel("2026-10-09")).toBe("9 October 2026");
    expect(dateLabel(null)).toBe("");
    expect(dateLabel("2022")).toBe("");
    expect(dateLabel("2022-13-01")).toBe("");
  });

  it("calls official art Official when no artist is named, and a made picture never official", () => {
    expect(whoOf(base)).toBe("Official");
    expect(whoOf({ ...base, facts: { ...base.facts, artist: "A. Hand" } })).toBe("A. Hand");
    expect(isMade(base)).toBe(false);
    expect(isMade(made)).toBe(true);
    expect(whoOf(made)).not.toBe("Official");
    expect(whoOf(made)).toBe("Not official");
  });

  it("makes the five cells of a row", () => {
    expect(rowCells(base, 0)).toEqual({
      no: "01",
      title: "Fanny, Blade of Kibou",
      chars: "Fanny",
      who: "Official",
      year: "2022",
    });
    expect(rowCells(base, 11).no).toBe("12");
  });

  it("a row link is the room with ?i=<id>", () => {
    expect(hrefOf("arts-splash-x")).toBe("/collection/arts/?i=arts-splash-x");
  });

  it("a screen reader hears the mark of a made picture", () => {
    expect(spoken(base, 0, 14)).toBe("Fanny, Blade of Kibou. Skin splash art. Picture 1 of 14.");
    expect(spoken(made, 3, 14)).toContain(NOT_OFFICIAL);
  });
});

describe("the words on a picture's colour", () => {
  it("are white on a dark colour and ink on a light one", () => {
    expect(toneOf("#667799")).toBe("dark");
    expect(toneOf("#1a1a24")).toBe("dark");
    expect(toneOf("#e8eef8")).toBe("light");
    expect(toneOf("#8e98b9")).toBe("light");
    expect(toneOf("nope")).toBe("light");
  });
});

describe("the data of the room", () => {
  it("is in order, with unique ids, and has what the stage needs", () => {
    expect(SPLASH_ITEMS.length).toBeGreaterThanOrEqual(5);
    const ids = new Set(SPLASH_ITEMS.map((i) => i.id));
    expect(ids.size).toBe(SPLASH_ITEMS.length);
    SPLASH_ITEMS.forEach((item, i) => {
      if (i > 0) expect(item.order).toBeGreaterThan(SPLASH_ITEMS[i - 1]!.order);
      expect(item.img.c).toMatch(/^#[0-9a-f]{6}$/iu);
      expect(item.alt.length).toBeGreaterThan(10);
    });
  });

  it("every frame is a 16:9 window of its picture inside the picture", () => {
    for (const item of SPLASH_ITEMS) {
      const { frame, img } = item;
      expect(frame.x).toBeGreaterThanOrEqual(0);
      expect(frame.y).toBeGreaterThanOrEqual(0);
      expect(frame.x + frame.w).toBeLessThanOrEqual(1.0001);
      expect(frame.y + frame.h).toBeLessThanOrEqual(1.0001);
      const ratio = (frame.w * img.w) / (frame.h * img.h);
      expect(Math.abs(ratio - 16 / 9)).toBeLessThan(0.02);
    }
  });

  it("every picture that is not official carries the made mark in its data", () => {
    for (const item of SPLASH_ITEMS) {
      if (item.canon === "official") continue;
      expect(item.credit?.by).toBeTruthy();
      expect(item.credit?.note ?? item.line).toMatch(/not official/iu);
    }
  });
});
