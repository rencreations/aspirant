import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { LIST_ORDER } from "../../content";

import { PICTURE_FRAMES, SELENA_FRAME } from "./frames";

interface Loop {
  slug: string;
  name: string;
  kind: string;
  video?: { repo: string; w: number; h: number; bytes: number };
  window: { x: number; y: number; w: number; h: number };
  poster45: { repo: string; bytes: number };
  posterFull?: { repo: string; bytes: number };
  full?: { lib: string; w: number; h: number; bytes: number };
  alt?: string;
}

const picks = JSON.parse(
  readFileSync(join(process.cwd(), "public/data/home/picks.json"), "utf8"),
) as { loops: Loop[]; hero: { portrait: Array<{ id: string; bytes: number }> } };

const close = (a: number, b: number) => Math.abs(a - b) < 1e-4;

describe("list frames", () => {
  it("are the nine pictures of the owner's order, then Selena", () => {
    expect(PICTURE_FRAMES.map((f) => f.slug)).toEqual(LIST_ORDER.slice(0, 9));
    expect(SELENA_FRAME.slug).toBe(LIST_ORDER[9]);
  });

  it("equal the media workstream's picks", () => {
    expect(PICTURE_FRAMES).toHaveLength(picks.loops.length);
    PICTURE_FRAMES.forEach((f, i) => {
      const l = picks.loops[i]!;
      expect(f.slug).toBe(l.slug);
      expect(f.name).toBe(l.name);
      expect(f.poster).toBe(l.poster45.repo);
      expect(f.posterBytes).toBe(l.poster45.bytes);
      for (const k of ["x", "y", "w", "h"] as const) {
        expect(close(f.window[k], l.window[k])).toBe(true);
      }
      if (f.kind === "video") {
        expect(l.video).toBeDefined();
        expect(f.video).toEqual({
          path: l.video!.repo,
          w: l.video!.w,
          h: l.video!.h,
          bytes: l.video!.bytes,
        });
        expect(f.posterFull).toBe(l.posterFull!.repo);
      } else {
        expect(f.full).toEqual({
          lib: l.full!.lib,
          w: l.full!.w,
          h: l.full!.h,
          bytes: l.full!.bytes,
        });
        expect(f.alt).toBe(l.alt);
      }
    });
    const sel = picks.hero.portrait.find((p) => p.id === "selena");
    expect(SELENA_FRAME.posterBytes).toBe(sel?.bytes);
  });

  it("keep every window 4:5 on its picture", () => {
    for (const f of PICTURE_FRAMES) {
      const pw = f.kind === "video" ? f.video.w : f.full.w;
      const ph = f.kind === "video" ? f.video.h : f.full.h;
      const ratio = (f.window.w * pw) / (f.window.h * ph);
      expect(ratio).toBeGreaterThan(0.77);
      expect(ratio).toBeLessThan(0.83);
      expect(f.window.x + f.window.w).toBeLessThanOrEqual(1.001);
      expect(f.window.y + f.window.h).toBeLessThanOrEqual(1.001);
    }
  });

  it("have no dash in the words", () => {
    for (const f of PICTURE_FRAMES) {
      expect(f.alt.includes(String.fromCharCode(0x2013))).toBe(false);
      expect(f.alt.includes(String.fromCharCode(0x2014))).toBe(false);
    }
  });
});
