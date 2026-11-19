import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { PREVIEWS, PREVIEW_ASPECT, TRAILER_FILM, previewAspect } from "./data";

interface Picks {
  trailer: {
    film: {
      id: string;
      title: string;
      href: string;
      durLabel: string;
      lib: { video: string };
      w: number;
      h: number;
      aspect: number;
      dur: number;
      bytes: number;
      start: number;
      warm: { seconds: number };
    };
  };
  previews: Array<{
    id: string;
    title: string;
    href: string;
    color: string;
    video: { repo: string; w: number; h: number; bytes: number; dur: number };
  }>;
}

const picks = JSON.parse(
  readFileSync(
    path.resolve(import.meta.dirname, "../../../../../public/data/home/picks.json"),
    "utf8",
  ),
) as Picks;

describe("the film's files", () => {
  it("are the media workstream's picks, in the same order", () => {
    expect(
      PREVIEWS.map((p) => [p.id, p.title, p.href, p.path, p.bytes, p.w, p.h, p.color]),
    ).toEqual(
      picks.previews.map((p) => [
        p.id,
        p.title,
        p.href,
        p.video.repo,
        p.video.bytes,
        p.video.w,
        p.video.h,
        p.color,
      ]),
    );
  });

  it("the trailer is the library's whole film, as the picks say", () => {
    const film = picks.trailer.film;
    expect(TRAILER_FILM).toMatchObject({
      id: film.id,
      title: film.title,
      href: film.href,
      durLabel: film.durLabel,
      key: film.lib.video,
      w: film.w,
      h: film.h,
      dur: film.dur,
      bytes: film.bytes,
      start: film.start,
      warmSeconds: film.warm.seconds,
    });
    expect(TRAILER_FILM.aspect).toBeCloseTo(film.aspect, 3);
    expect(TRAILER_FILM.aspect).toBeCloseTo(TRAILER_FILM.w / TRAILER_FILM.h, 9);
    // It rests inside the film, with room to play after it.
    expect(TRAILER_FILM.start).toBeGreaterThan(0);
    expect(TRAILER_FILM.start).toBeLessThan(TRAILER_FILM.dur - 10);
  });

  it("are ten previews, each a clip 1280 wide at its film's own shape", () => {
    expect(PREVIEWS).toHaveLength(10);
    for (const p of picks.previews) {
      expect(p.video.w).toBe(1280);
      // Even sizes (H.264 4:2:0) and a real shape: 16 to 9 or about 2.37 to 1.
      expect(p.video.h % 2).toBe(0);
      const aspect = p.video.w / p.video.h;
      expect(aspect).toBeGreaterThan(1.7);
      expect(aspect).toBeLessThan(2.4);
    }
    expect(new Set(PREVIEWS.map((p) => p.id)).size).toBe(10);
    expect(new Set(PREVIEWS.map((p) => p.path)).size).toBe(10);
  });

  it("keeps every preview at 1 to 2.5 MB and the whole set under 20 MB", () => {
    let total = 0;
    for (const p of PREVIEWS) {
      expect(p.bytes).toBeGreaterThan(500_000);
      expect(p.bytes).toBeLessThan(2_500_000);
      total += p.bytes;
    }
    expect(total).toBeLessThan(20_000_000);
  });

  it("gives each card its own film's shape", () => {
    for (const p of PREVIEWS) expect(previewAspect(p)).toBeCloseTo(p.w / p.h, 9);
    // The ring is laid out for one nominal card, so it does not move with the shapes.
    expect(PREVIEW_ASPECT).toBeCloseTo(560 / 286, 9);
  });
});
