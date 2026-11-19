import { describe, expect, it } from "vitest";

import { CUE_AFTER_MS, cueShown, type CueInput } from "./rest-cue";

const base: CueInput = {
  open: true,
  held: false,
  idleMs: CUE_AFTER_MS + 100,
  scrollY: 9000,
  viewH: 900,
  docH: 26000,
};

describe("the cue at a rest", () => {
  it("shows once the visitor has stood still in the middle of the page", () => {
    expect(cueShown(base)).toBe(true);
  });

  it("waits for the stillness, and hides the moment the visitor moves", () => {
    expect(cueShown({ ...base, idleMs: CUE_AFTER_MS - 1 })).toBe(false);
    expect(cueShown({ ...base, idleMs: 0 })).toBe(false);
  });

  it("is not shown while a scene plays or anything holds the page", () => {
    expect(cueShown({ ...base, held: true })).toBe(false);
  });

  it("is not shown before the page is open", () => {
    expect(cueShown({ ...base, open: false })).toBe(false);
  });

  it("leaves the top (the hero's own cue) and the foot (the footer's own) alone", () => {
    expect(cueShown({ ...base, scrollY: 100 })).toBe(false);
    expect(cueShown({ ...base, scrollY: 26000 - 900 - 600 })).toBe(false);
    expect(cueShown({ ...base, scrollY: 26000 - 900 - 1200 })).toBe(true);
  });

  it("is not shown on a screen of no height", () => {
    expect(cueShown({ ...base, viewH: 0 })).toBe(false);
  });
});
