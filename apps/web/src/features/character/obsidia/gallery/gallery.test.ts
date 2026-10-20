import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { voiceLines } from "@/content/voice.generated";

import { galleryImagePath, galleryThumbPath } from "./gallery-data";
import { FAN_ART, OFFICIAL, VIEWER_IMAGES, viewerIndex, VOICE_GROUPS } from "./gallery-data";
import { DAY_OF_ENDERS, galleryItems } from "./gallery-media";
import { GALLERY_IMAGES } from "./gallery-media.generated";

const publicDir = join(process.cwd(), "public");
const onDisk = (path: string) => existsSync(join(publicDir, path));

describe("Obsidia's voice groups", () => {
  it("hold every one of her lines exactly once", () => {
    const all = VOICE_GROUPS.flatMap((g) => g.lines);
    expect(new Set(all).size).toBe(all.length);
    expect([...all].sort((a, b) => a - b)).toEqual(voiceLines.obsidia.map((l) => l.n));
  });
});

describe("Obsidia's art", () => {
  const groups = [OFFICIAL, ...FAN_ART];

  it("lists the official art first, then the fan art, each piece with a file and its sizes", () => {
    expect(OFFICIAL.pieces).toHaveLength(3);
    expect(FAN_ART).toHaveLength(7);
    for (const g of groups) {
      for (const p of g.pieces) {
        expect(onDisk(galleryImagePath(p.id)), p.id).toBe(true);
        expect(onDisk(galleryThumbPath(p.id)), `${p.id} thumb`).toBe(true);
        expect(GALLERY_IMAGES[p.id].bytes).toBeGreaterThan(0);
        expect(p.alt.length).toBeGreaterThan(20);
      }
    }
    expect(VIEWER_IMAGES).toHaveLength(10);
    expect(viewerIndex("official-splash")).toBe(0);
  });

  it("credits every fan piece, with a link to where it was posted", () => {
    for (const g of FAN_ART) {
      expect(g.credit.name.length).toBeGreaterThan(0);
      expect(g.credit.href, g.id).toMatch(/^https:\/\//);
    }
    expect(OFFICIAL.credit.name).toBe("Moonton");
  });

  it("loads the pictures, the TikTok and the trailer for the loading bar", () => {
    const items = galleryItems();
    expect(items.length).toBeGreaterThanOrEqual(20);
    expect(DAY_OF_ENDERS.sources[0]?.src).toContain("day-of-enders");
    expect(onDisk(DAY_OF_ENDERS.sources[0].src)).toBe(true);
    expect(onDisk(DAY_OF_ENDERS.poster)).toBe(true);
  });

  it("follows the writing rules", () => {
    const text = groups
      .flatMap((g) => [g.label, ...g.pieces.flatMap((p) => [p.title, p.alt])])
      .concat(VOICE_GROUPS.flatMap((g) => [g.title, g.note]))
      .join(" ");
    const dashes = new RegExp(`[${String.fromCharCode(0x2013)}${String.fromCharCode(0x2014)}]`);
    expect(dashes.test(text)).toBe(false);
  });
});
