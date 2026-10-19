import { describe, expect, it } from "vitest";

import { pageFromPath, selenaRoute, selenaTitle } from "./routes";

describe("her addresses", () => {
  it("gives her own page and each of her pages an address with a trailing slash", () => {
    expect(selenaRoute(null)).toBe("/character/selena/");
    expect(selenaRoute("about")).toBe("/character/selena/about/");
    expect(selenaRoute("skills")).toBe("/character/selena/skills/");
    expect(selenaRoute("gallery")).toBe("/character/selena/gallery/");
  });

  it("reads the page from an address, with or without the deploy base path", () => {
    expect(pageFromPath("/character/selena/")).toBeNull();
    expect(pageFromPath("/character/selena")).toBeNull();
    expect(pageFromPath("/character/selena/about/")).toBe("about");
    expect(pageFromPath("/aspirant/character/selena/skills/")).toBe("skills");
    expect(pageFromPath("/aspirant/character/selena/gallery")).toBe("gallery");
    expect(pageFromPath("/character/selena/others/")).toBeNull();
    expect(pageFromPath("/character/fanny/about/")).toBeNull();
  });

  it("titles each page", () => {
    expect(selenaTitle(null)).toContain("Selena");
    expect(selenaTitle("about")).toBe("Selena, About");
  });
});
