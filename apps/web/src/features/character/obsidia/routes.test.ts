import { describe, expect, it } from "vitest";

import { obsidiaPageFromPath, obsidiaRoute, obsidiaTitle } from "./routes";

describe("her addresses", () => {
  it("gives her own page and each of her pages an address with a trailing slash", () => {
    expect(obsidiaRoute(null)).toBe("/character/obsidia/");
    expect(obsidiaRoute("about")).toBe("/character/obsidia/about/");
    expect(obsidiaRoute("skills")).toBe("/character/obsidia/skills/");
    expect(obsidiaRoute("gallery")).toBe("/character/obsidia/gallery/");
  });

  it("reads the page from an address, with or without the deploy base path", () => {
    expect(obsidiaPageFromPath("/character/obsidia/")).toBeNull();
    expect(obsidiaPageFromPath("/character/obsidia")).toBeNull();
    expect(obsidiaPageFromPath("/character/obsidia/about/")).toBe("about");
    expect(obsidiaPageFromPath("/aspirant/character/obsidia/skills/")).toBe("skills");
    expect(obsidiaPageFromPath("/aspirant/character/obsidia/gallery")).toBe("gallery");
    expect(obsidiaPageFromPath("/character/obsidia/others/")).toBeNull();
    // Selena's pages are not hers.
    expect(obsidiaPageFromPath("/character/selena/about/")).toBeNull();
  });

  it("titles each page", () => {
    expect(obsidiaTitle(null)).toContain("Obsidia");
    expect(obsidiaTitle("about")).toBe("Obsidia, About");
  });
});
