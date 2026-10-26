import { describe, expect, it } from "vitest";

import { LOCK_LIMIT_MS, isScrollKey } from "./scroll-lock";

describe("the scroll lock", () => {
  it("swallows the keys that scroll a page", () => {
    for (const key of [" ", "PageDown", "PageUp", "Home", "End", "ArrowUp", "ArrowDown"]) {
      expect(isScrollKey({ key })).toBe(true);
    }
  });

  it("leaves the other keys alone", () => {
    for (const key of ["a", "Enter", "Escape", "Tab", "ArrowLeft", "ArrowRight"]) {
      expect(isScrollKey({ key })).toBe(false);
    }
  });

  it("leaves a key typed in a field alone", () => {
    const input = document.createElement("input");
    const area = document.createElement("textarea");
    expect(isScrollKey({ key: " ", target: input })).toBe(false);
    expect(isScrollKey({ key: "ArrowDown", target: area })).toBe(false);
    expect(isScrollKey({ key: " ", target: document.body })).toBe(true);
  });

  it("is only ever held for a few seconds", () => {
    expect(LOCK_LIMIT_MS).toBeGreaterThanOrEqual(2000);
    expect(LOCK_LIMIT_MS).toBeLessThanOrEqual(4000);
  });
});
