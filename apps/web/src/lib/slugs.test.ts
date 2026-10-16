import { characterRoute, isActiveRoute, navItems } from "./site";
import {
  CHARACTER_NAMES,
  CHARACTER_SLUGS,
  isCharacterSlug,
  nextSlug,
  prevSlug,
  type CharacterSlug,
} from "./slugs";

describe("character slugs", () => {
  it("keeps the queue order from the roster", () => {
    expect(CHARACTER_SLUGS).toEqual([
      "fanny",
      "layla",
      "ruby",
      "angela",
      "lesley",
      "change",
      "guinevere",
      "vexana",
      "obsidia",
      "selena",
    ]);
  });

  it("loops forward and backward", () => {
    expect(nextSlug("fanny")).toBe("layla");
    expect(nextSlug("obsidia")).toBe("selena");
    expect(nextSlug("selena")).toBe("fanny");
    expect(prevSlug("fanny")).toBe("selena");
    expect(prevSlug("layla")).toBe("fanny");
  });

  it("visits every character once in a full loop", () => {
    const seen = new Set<string>();
    let slug: CharacterSlug = CHARACTER_SLUGS[0];
    for (const _ of CHARACTER_SLUGS) {
      seen.add(slug);
      slug = nextSlug(slug);
    }
    expect(seen.size).toBe(10);
    expect(slug).toBe("fanny");
  });

  it("guards route params", () => {
    expect(isCharacterSlug("layla")).toBe(true);
    expect(isCharacterSlug("tigreal")).toBe(false);
    expect(isCharacterSlug("")).toBe(false);
  });

  it("has a display name for every slug", () => {
    for (const slug of CHARACTER_SLUGS) expect(CHARACTER_NAMES[slug]).toBeTruthy();
    expect(CHARACTER_NAMES.change).toBe("Chang'e");
  });
});

describe("routes", () => {
  it("builds character routes", () => {
    expect(characterRoute("vexana")).toBe("/character/vexana");
  });

  it("lists the five destinations in order", () => {
    expect(navItems.map((n) => n.label)).toEqual([
      "Home",
      "Experience",
      "Story",
      "Characters",
      "Collection",
    ]);
  });

  it("matches the active section with or without a trailing slash", () => {
    expect(isActiveRoute("/", "/")).toBe(true);
    expect(isActiveRoute("/story/", "/")).toBe(false);
    expect(isActiveRoute("/story/", "/story")).toBe(true);
    expect(isActiveRoute("/character/layla/", "/character")).toBe(true);
    expect(isActiveRoute("/characters/", "/character")).toBe(false);
  });
});
