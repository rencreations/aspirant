import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { getCharacter } from "@/content/characters";

import { CONFIG } from "./config";
import { FILMS, HERO, MUSIC, PARTNER, officialArt, sourcesOf, type Who } from "./media";

const publicDir = join(process.cwd(), "public");
const onDisk = (path: string) => existsSync(join(publicDir, path));
const WHO: readonly Who[] = ["layla", "fanny"];

describe("what the pair's pages load", () => {
  it("has the music, the heroes and every official picture on disk", () => {
    expect(onDisk(MUSIC)).toBe(true);
    for (const who of WHO) {
      expect(onDisk(HERO[who].src), who).toBe(true);
      for (const a of officialArt(who)) expect(onDisk(a.src), a.src).toBe(true);
    }
  });

  it("has every film, its poster and its captions", () => {
    for (const f of Object.values(FILMS)) {
      for (const s of sourcesOf(f)) expect(onDisk(s.src), s.src).toBe(true);
      expect(onDisk(f.poster), f.poster).toBe(true);
      if (f.captions) expect(onDisk(f.captions), f.captions).toBe(true);
    }
  });

  it("has the audio file of every voice line", () => {
    for (const who of WHO)
      for (const l of getCharacter(who).voice) expect(onDisk(l.file), l.file).toBe(true);
  });
});

describe("the pair", () => {
  it("points each page at the other", () => {
    expect(PARTNER.layla).toBe("fanny");
    expect(PARTNER.fanny).toBe("layla");
    for (const who of WHO) expect(getCharacter(who).partnerSlug).toBe(PARTNER[who]);
  });

  it("gives each page six titles for six notes, and different colours", () => {
    for (const who of WHO) expect(new Set(CONFIG[who].topics).size).toBe(6);
    expect(CONFIG.layla.vars).not.toEqual(CONFIG.fanny.vars);
  });
});
