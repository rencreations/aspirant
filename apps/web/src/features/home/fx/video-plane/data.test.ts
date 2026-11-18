import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { PREVIEWS, PREVIEW_ASPECT, STRIPS, STRIP_POSTER, TRAILER_FILM, pickStrip } from "./data";

interface Picks {
  trailer: {
    strip: Array<{ repo: string; w: number; h: number; bytes: number }>;
    poster: { repo: string };
    film: { id: string; title: string; href: string; durLabel: string };
  };
  previews: Array<{
    id: string;
    title: string;
    href: string;
    color: string;
    video: { repo: string; w: number; h: number; bytes: number };
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
    expect(STRIPS.map((s) => [s.path, s.w, s.h, s.bytes])).toEqual(
      picks.trailer.strip.map((s) => [s.repo, s.w, s.h, s.bytes]),
    );
    expect(STRIP_POSTER).toBe(picks.trailer.poster.repo);
    expect(PREVIEWS.map((p) => [p.id, p.title, p.href, p.path, p.bytes, p.color])).toEqual(
      picks.previews.map((p) => [p.id, p.title, p.href, p.video.repo, p.video.bytes, p.color]),
    );
    expect(TRAILER_FILM).toMatchObject({
      id: picks.trailer.film.id,
      title: picks.trailer.film.title,
      href: picks.trailer.film.href,
      durLabel: picks.trailer.film.durLabel,
    });
  });

  it("are ten previews, each a clip of 560 by 286", () => {
    expect(PREVIEWS).toHaveLength(10);
    for (const p of picks.previews) {
      expect(p.video.w).toBe(560);
      expect(p.video.h).toBe(286);
    }
    expect(PREVIEW_ASPECT).toBeCloseTo(560 / 286, 9);
    expect(new Set(PREVIEWS.map((p) => p.id)).size).toBe(10);
  });
});

describe("the strip a display gets", () => {
  it("is the 1280 file under 1920 physical pixels and the 1920 file from there on, by the display only", () => {
    expect(pickStrip(1440, 1).w).toBe(1280);
    expect(pickStrip(1706, 1.5).w).toBe(1920);
    expect(pickStrip(1706, 1).w).toBe(1280);
    expect(pickStrip(1920, 1).w).toBe(1920);
    expect(pickStrip(1440, 2).w).toBe(1920);
    expect(pickStrip(390, 3).w).toBe(1280);
    expect(pickStrip(1440, 0).w).toBe(1280);
  });
});
