import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { getCharacter } from "@/content/characters";

import {
  FAN_ART,
  galleryImagePath,
  galleryPosterPath,
  galleryThumbPath,
  galleryVideoPath,
  JLEN_POSTS,
  LINE_NINE,
  linesFor,
  MECHA_LINES,
  OFFICIAL,
  TIKTOKS,
  VIEWER_IMAGES,
} from "./gallery-data";
import { DAY_OF_ENDERS } from "./gallery-media";
import { GALLERY_IMAGES } from "./gallery-media.generated";

const publicDir = join(process.cwd(), "public");
const onDisk = (path: string) => existsSync(join(publicDir, path));
const numbers = getCharacter("selena").voice.map((l) => l.n);
const groups = [OFFICIAL, ...FAN_ART, ...JLEN_POSTS];
const pieces = groups.flatMap((g) => g.pieces);

describe("her voice lines by form", () => {
  it("gives the mecha form its 15 lines and the normal form the other 31 and the first part of line 9", () => {
    const mecha = linesFor(numbers, "mecha");
    const normal = linesFor(numbers, "normal");
    expect(mecha.map((l) => l.n)).toEqual([...MECHA_LINES].sort((a, b) => a - b));
    expect(mecha).toHaveLength(15);
    expect(normal).toHaveLength(32);
    expect(normal.some((l) => MECHA_LINES.includes(l.n) && l.n !== 9)).toBe(false);
  });

  it("splits line 9 into two parts, one for each form", () => {
    const nine = (form: "normal" | "mecha") => linesFor(numbers, form).find((l) => l.n === 9);
    expect(nine("normal")?.part).toBe(LINE_NINE.a);
    expect(nine("mecha")?.part).toBe(LINE_NINE.b);
    for (const part of Object.values(LINE_NINE)) {
      expect(onDisk(part.file), part.file).toBe(true);
      expect(part.jp).not.toBe("");
      expect(part.en).not.toBe("");
    }
  });

  it("keeps the lines in order", () => {
    for (const form of ["normal", "mecha"] as const) {
      const n = linesFor(numbers, form).map((l) => l.n);
      expect(n).toEqual([...n].sort((a, b) => a - b));
    }
  });
});

describe("the art", () => {
  it("has a full size and a small size on disk for every piece, with no id twice", () => {
    const ids = pieces.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(onDisk(galleryImagePath(id)), id).toBe(true);
      expect(onDisk(galleryThumbPath(id)), id).toBe(true);
      expect(GALLERY_IMAGES[id].w).toBeGreaterThan(0);
    }
  });

  it("describes every picture and credits every group", () => {
    for (const p of pieces) {
      expect(p.alt.length, p.id).toBeGreaterThan(12);
      expect(p.title, p.id).not.toBe("");
    }
    for (const g of groups) {
      expect(g.credit.name, g.id).not.toBe("");
      expect(g.credit.platform, g.id).not.toBe("");
    }
    // Fan art links to where it was posted. The official art names its maker.
    for (const g of [...FAN_ART, ...JLEN_POSTS]) {
      expect(g.credit.href, g.id).toMatch(/^https:\/\//);
    }
    expect(OFFICIAL.credit.name).toBe("Moonton");
  });

  it("keeps the four posts of jlen_ismyname: three pictures and a carousel of seven", () => {
    expect(JLEN_POSTS).toHaveLength(4);
    expect(JLEN_POSTS.filter((g) => g.pieces.length === 1)).toHaveLength(3);
    const carousel = JLEN_POSTS.filter((g) => g.process);
    expect(carousel).toHaveLength(1);
    expect(carousel[0]?.pieces).toHaveLength(7);
  });

  it("shows the official art first, then the fan art, and groups a carousel as one set", () => {
    expect(VIEWER_IMAGES).toHaveLength(pieces.length);
    const official = OFFICIAL.pieces.length;
    expect(VIEWER_IMAGES.slice(0, official).every((v) => v.credit.name === "Moonton")).toBe(true);
    expect(VIEWER_IMAGES.slice(official).some((v) => v.credit.name === "Moonton")).toBe(false);
    const process = VIEWER_IMAGES.filter((v) => v.set === "jlen-DeZuC3imbns");
    expect(process).toHaveLength(7);
  });
});

describe("the videos", () => {
  it("has both TikToks with their posters, credited by the name in the file", () => {
    expect(TIKTOKS.map((t) => t.credit.name)).toEqual(["@bomboclau_", "@hashirama1697"]);
    for (const t of TIKTOKS) {
      expect(onDisk(galleryVideoPath(t.id)), t.id).toBe(true);
      expect(onDisk(galleryPosterPath(t.id)), t.id).toBe(true);
      expect(t.credit.href).toContain("tiktok.com");
    }
  });

  it("has the trailer Day of Enders in both sizes, with its poster and captions", () => {
    expect(onDisk(DAY_OF_ENDERS.poster)).toBe(true);
    expect(onDisk(DAY_OF_ENDERS.captions)).toBe(true);
    for (const s of DAY_OF_ENDERS.sources) expect(onDisk(s.src), s.src).toBe(true);
  });
});
