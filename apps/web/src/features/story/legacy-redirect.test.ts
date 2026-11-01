import { describe, expect, it } from "vitest";

import { legacyTarget } from "./legacy-redirect";

describe("legacyTarget", () => {
  it("sends a bare old address to the story", () => {
    expect(legacyTarget("")).toBe("/story/");
    expect(legacyTarget("#nonsense")).toBe("/story/");
  });

  it("sends an old chapter link to the chapter's Part", () => {
    expect(legacyTarget("#c12")).toBe("/story/part-03/#c12");
    expect(legacyTarget("#c12-p034")).toBe("/story/part-03/#c12-p034");
  });
});
