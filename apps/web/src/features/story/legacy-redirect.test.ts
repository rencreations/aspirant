import { describe, expect, it } from "vitest";

import { legacyTarget } from "./legacy-redirect";

describe("legacyTarget", () => {
  it("sends a bare old address to the story", () => {
    expect(legacyTarget("")).toBe("/story/");
    expect(legacyTarget("#nonsense")).toBe("/story/");
  });

  it("sends an old chapter link to a chapter of the new book", () => {
    expect(legacyTarget("#c12")).toMatch(/^\/story\/(prologue|chapter-\d{2})$/u);
    expect(legacyTarget("#c12-p034")).toBe(legacyTarget("#c12"));
  });
});
