import { describe, expect, it } from "vitest";

import { CHARACTER_SLUGS } from "@/lib/slugs";

import * as content from "./content";

/** Every string in the content object, with where it is. */
function strings(value: unknown, at = "content"): Array<{ at: string; text: string }> {
  if (typeof value === "string") return [{ at, text: value }];
  if (Array.isArray(value)) return value.flatMap((v, i) => strings(v, `${at}[${i}]`));
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([k, v]) => strings(v, `${at}.${k}`));
  }
  return [];
}

const BANNED = ["con", "viction"].join("");
const DASHES = new RegExp(`[${String.fromCharCode(0x2013)}${String.fromCharCode(0x2014)}]`, "u");

const all = strings({ ...content });

describe("the copy of the home page", () => {
  it("has no em dash and no en dash anywhere (the owner's rule)", () => {
    for (const { at, text } of all) expect(text, at).not.toMatch(DASHES);
  });

  it("does not use the banned word", () => {
    for (const { at, text } of all) expect(text.toLowerCase(), at).not.toContain(BANNED);
  });

  it("says what the owner said", () => {
    expect(content.ASPIRANTS.button.label).toBe("About Aspirant");
    expect(content.STRIP.button.label).toBe("See All");
    expect(content.STRIP.expand.button.label).toBe("See Collections");
    expect(content.STRIP.expand.body).toBe(
      "10 official animated films produced in the last 4 years.",
    );
    expect(content.STRIP.bottomLeft.hover).toEqual(["Our", "Collections"]);
    expect(content.STRIP.topRight).toBe(
      "Trailer video for the new Selena & Obsidia Aspirant skin.",
    );
    expect(content.SELENA.title).toBe("Immersive Interaction");
    expect(content.SELENA.button.label).toBe("See All Animations");
    expect(content.FUNNY.title).toBe("What's going on?");
    expect(content.FUNNY.button.label).toBe("Read The Story");
    expect(content.CHASE.button.label).toBe("See all comics");
    expect(content.BEND.fanart.label).toBe("See all fanart");
    expect(content.BEND.artwork.label).toBe("See all artwork");
    expect(content.FOOTER.buttonName).toBe("Continue to About");
  });

  it("leads the buttons to the pages the owner named", () => {
    expect(content.ASPIRANTS.button.href).toBe("/about");
    expect(content.STRIP.expand.button.href).toBe("/collection/video/films");
    expect(content.SELENA.button.href).toBe("/collection/animation");
    expect(content.VOICES.button.href).toBe("/collection/voicelines");
    expect(content.FUNNY.button.href).toBe("/story");
    expect(content.CHASE.button.href).toBe("/collection/comic");
    expect(content.BEND.fanart.href).toBe("/collection/arts/fanart");
  });

  it("links only to routes of this site", () => {
    for (const { at, text } of all) {
      if (at.endsWith(".href") || at.includes("ROUTES")) expect(text, at).toMatch(/^\//u);
    }
  });

  it("lists the ten Aspirants once each, in the owner's order, ending on Selena", () => {
    expect(content.LIST_ORDER).toHaveLength(10);
    expect(new Set(content.LIST_ORDER).size).toBe(10);
    expect([...content.LIST_ORDER].sort()).toEqual([...CHARACTER_SLUGS].sort());
    expect(content.LIST_ORDER[0]).toBe("obsidia");
    expect(content.LIST_ORDER[9]).toBe("selena");
  });

  it("picks one voice line for each Aspirant", () => {
    expect(content.VOICE_PICKS).toHaveLength(10);
    expect(new Set(content.VOICE_PICKS.map((p) => p.slug)).size).toBe(10);
    const selena = content.VOICE_PICKS.find((p) => p.slug === "selena");
    expect(selena).toMatchObject({ line: 43, japanese: 42 });
    expect(content.VOICE_PICKS.find((p) => p.slug === "fanny")?.line).toBe(18);
    for (const p of content.VOICE_PICKS) {
      expect(CHARACTER_SLUGS).toContain(p.slug);
      expect(p.line).toBeGreaterThan(0);
    }
  });

  it("counts the characters the way the page says them", () => {
    expect(CHARACTER_SLUGS.length).toBe(10);
  });

  it("has a description of a length a search result can show", () => {
    expect(content.HOME_DESCRIPTION.length).toBeGreaterThan(60);
    expect(content.HOME_DESCRIPTION.length).toBeLessThan(320);
    expect(content.HOME_DESCRIPTION).toMatch(/not affiliated with Moonton/);
  });
});
