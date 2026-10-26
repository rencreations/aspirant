import { describe, expect, it } from "vitest";

import { getCharacter } from "@/content/characters";

import { crop } from "./crop";
import { COPY, DUET, FRAME_SECONDS, PARTNER, TETRA_LINES, WHO, clock, isWho } from "./duo-data";
import { FRAMES, duoFirstPaint, duoLater, framePath, layerPath, voicePath } from "./duo-media";

/** The en and em dash, built so this file holds neither. */
const DASH = new RegExp(`[${String.fromCharCode(0x2013)}${String.fromCharCode(0x2014)}]`);

describe("the pair", () => {
  it("knows its two pages and that they are each other's partner", () => {
    expect(WHO).toEqual(["ruby", "angela"]);
    for (const who of WHO) {
      expect(PARTNER[PARTNER[who]]).toBe(who);
      expect(getCharacter(who).partnerSlug).toBe(PARTNER[who]);
    }
    expect(isWho("ruby")).toBe(true);
    expect(isWho("vexana")).toBe(false);
  });

  it("has a still for every second of the strip", () => {
    for (const who of WHO) expect(FRAME_SECONDS[who]).toHaveLength(FRAMES.length);
  });

  it("answers every Tetra line with a voice line of Angela", () => {
    const angela = getCharacter("angela");
    for (const n of TETRA_LINES) expect(angela.voice.some((l) => l.n === n)).toBe(true);
  });

  it("tells the exchange with both speakers and no dashes", () => {
    expect(new Set(DUET.map((b) => b.who))).toEqual(new Set(WHO));
    for (const beat of DUET) expect(beat.text).not.toMatch(DASH);
    for (const who of WHO)
      for (const text of Object.values(COPY[who])) expect(text).not.toMatch(DASH);
  });

  it("formats the time of a still", () => {
    expect(clock(4)).toBe("00:04");
    expect(clock(108)).toBe("01:48");
  });
});

describe("crop", () => {
  it("centres the point in a square box", () => {
    const style = crop("/a.webp", { x: 50, y: 50 }, 2);
    expect(style.backgroundSize).toBe("200% auto");
    // A point in the middle of the picture stays in the middle of the box at any zoom.
    expect(style.backgroundPosition).toBe("50.00% 50.00%");
  });
});

describe("paths and preloads", () => {
  it("names the pictures and voice lines", () => {
    expect(layerPath("ruby")).toBe("/img/ruby-angela/ruby/layer.webp");
    expect(framePath("angela", 3)).toBe("/img/ruby-angela/angela/frame-03.webp");
    expect(voicePath("ruby", 7)).toBe("/audio/voice/ruby/07.m4a");
  });

  it("waits for the hero only and defers the rest", () => {
    for (const who of WHO) {
      expect(duoFirstPaint(who).length).toBeLessThanOrEqual(3);
      const later = duoLater(who);
      expect(later.map((g) => g.priority)).toEqual(
        [...later.map((g) => g.priority)].sort((a, b) => a - b),
      );
      expect(later.flatMap((g) => g.items).length).toBeGreaterThan(40);
    }
  });
});
