import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { HERO_PORTRAITS } from "../../fx/image-field/picks-data";

import {
  ART_MAX_SIDE,
  DRONE_CROP,
  FAN_MAX_SIDE,
  FAN_PICS,
  SPIRAL_ORDER,
  artSources,
  decodedSize,
  droneSource,
  fanSource,
  hexToRgb,
} from "./pictures";

interface Picks {
  fanart: {
    items: Array<{
      id: string;
      title: string;
      alt: string;
      chars: string[];
      canon: string;
      lib: { p: string };
      w: number;
      h: number;
      color: string;
      bytes: { p: number };
      creditLine: string;
      credit: { by: string; platform: string; url: string };
      artistLink: string;
      report: { item: string; title: string };
    }>;
  };
  spiral: Array<{ chars: string[] }>;
}

const picks = JSON.parse(
  readFileSync(
    path.resolve(import.meta.dirname, "../../../../../public/data/home/picks.json"),
    "utf8",
  ),
) as Picks;

describe("the fan pictures", () => {
  it("are the same as the media workstream's picks, in the same order", () => {
    expect(FAN_PICS.map((p) => p.id)).toEqual(picks.fanart.items.map((p) => p.id));
    FAN_PICS.forEach((pic, i) => {
      const p = picks.fanart.items[i]!;
      expect(pic.title).toBe(p.title);
      expect(pic.alt).toBe(p.alt);
      expect(pic.chars).toEqual(p.chars);
      expect(pic.canon).toBe(p.canon);
      expect(pic.key).toBe(p.lib.p);
      expect([pic.w, pic.h, pic.bytes, pic.color]).toEqual([p.w, p.h, p.bytes.p, p.color]);
      expect(pic.creditLine).toBe(p.creditLine);
      expect(pic.credit).toEqual({
        by: p.credit.by,
        platform: p.credit.platform,
        url: p.credit.url,
      });
      expect(pic.artistLink).toBe(p.artistLink);
      expect(pic.report).toEqual(p.report);
    });
  });

  it("are group pictures only, each with a credit and a place to report it", () => {
    expect(FAN_PICS).toHaveLength(15);
    for (const pic of FAN_PICS) {
      expect(pic.chars.length).toBeGreaterThanOrEqual(3);
      expect(pic.credit.by.length).toBeGreaterThan(0);
      expect(pic.credit.url).toMatch(/^https:\/\//);
      expect(pic.report.item).toBe(pic.id);
    }
  });

  it("have ids that are unique and addresses in the library", () => {
    expect(new Set(FAN_PICS.map((p) => p.id)).size).toBe(15);
    for (const pic of FAN_PICS) {
      const src = fanSource(pic);
      expect(src.url).toContain("/library/v1/fanart/");
      expect(src.id).toBe(`bend:fan:${pic.id}`);
      expect(src.premultiply).toBe(false);
    }
  });

  it("are decoded small enough for the GPU budget and never enlarged", () => {
    let texels = 0;
    for (const pic of FAN_PICS) {
      const src = fanSource(pic);
      const size = decodedSize(src);
      expect(Math.max(size.w, size.h)).toBeLessThanOrEqual(FAN_MAX_SIDE);
      expect(size.w / size.h).toBeCloseTo(pic.w / pic.h, 1);
      texels += size.w * size.h;
    }
    // With mips: 4 bytes a texel, a third more. About 40 MB for the fifteen.
    expect((texels * 4 * 4) / 3 / 1e6).toBeLessThan(45);
  });
});

describe("the splash cards", () => {
  it("are the ten Aspirants in the order of the spiral", () => {
    const sources = artSources();
    expect(sources).toHaveLength(10);
    expect(SPIRAL_ORDER).toHaveLength(10);
    expect(sources.map((s) => s.id)).toEqual(SPIRAL_ORDER.map((id) => `bend:art:${id}`));
    // The spiral of the media picks is in the same order (one character each).
    expect(picks.spiral.map((p) => p.chars[0])).toEqual([...SPIRAL_ORDER]);
  });

  it("are the hero's own 4:5 files, so the browser has them already", () => {
    for (const src of artSources()) {
      const id = src.id.replace("bend:art:", "");
      const pic = HERO_PORTRAITS.find((p) => p.id === id)!;
      expect(src.url).toContain(pic.path);
      expect(src.aspect).toBeCloseTo(0.8, 6);
      const size = decodedSize(src);
      expect(Math.max(size.w, size.h)).toBeLessThanOrEqual(ART_MAX_SIDE);
    }
  });
});

describe("the drone's picture", () => {
  it("keeps only the drone and is premultiplied (it has a see-through ground)", () => {
    const src = droneSource();
    expect(src.premultiply).toBe(true);
    expect(src.crop).toEqual(DRONE_CROP);
    expect(src.aspect).toBeCloseTo(DRONE_CROP.sw / DRONE_CROP.sh, 6);
    const size = decodedSize(src);
    expect(size.w / size.h).toBeCloseTo(src.aspect, 1);
  });

  it("is the file of the About page's still, at the size the loading list says", () => {
    const file = path.resolve(import.meta.dirname, "../../../../../public/img/about/drone.webp");
    expect(readFileSync(file).byteLength).toBe(droneSource().bytes);
  });
});

describe("hexToRgb", () => {
  it("reads a colour as raw bytes over 255", () => {
    expect(hexToRgb("#ff8000")).toEqual([1, 128 / 255, 0]);
    expect(hexToRgb("794d46")[0]).toBeCloseTo(0x79 / 255, 6);
    expect(hexToRgb("nonsense")).toHaveLength(3);
  });
});
